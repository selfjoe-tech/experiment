# Goongram public discovery and SEO deployment

This describes the code in `feature/public-media-seo-discovery`. It is a
**discovery architecture**, not a claim that any URLs are indexed by Google.
The implementation is stacked on download/UI PR #5.

## 1. Audit and resolved problems

| Previous issue | Change |
| --- | --- |
| Sitemap only listed **verified** creators | RLS-aware public creator view; verification is not required |
| No video/image XML sitemap | Paginated media sitemaps with image entries and video entries when genuine posters exist |
| Empty and arbitrary tag pages could be indexed | Populated public topic view, indexed only when content exists |
| Client-side metadata for Explore | App Router server metadata in the dynamic tab layout |
| Generic brand logo used as every video thumbnail | Dedicated `thumbnail_path`, real poster extraction from new video uploads |
| Video preview length could be confused with original length | `duration_seconds` feeds metadata and ISO 8601 video durations |
| Image posts only opened in client overlays | Canonical server-generated `/images/[id]` landing pages |
| Profiles lacked stable searchable post lists | SSR profile metadata, ProfilePage JSON-LD, and real links to posts |
| No public creator directory | Paginated `/creators` with meaningful links |
| Sitemaps included auth and verification routes | Static sitemap now contains public URLs only |
| Root layout forced a homepage canonical onto child routes | Removed root-wide canonical; explicit canonical on public pages |
| Auth pages were indexable | `noindex` and defensive X-Robots-Tag on private routes |
| Storage paths assumed Supabase only | Preserve existing HTTPS R2/CDN URLs |
| Old usernames permanently disappeared | Server-side 308 redirect records after profile renames |
| No publisher-notification log | Service-only event queue and optional IndexNow |
| No operational view of SEO eligibility | Protected `/admin/seo` dashboard |

The search engine may take days or weeks to index a page. Sitemap inclusion is
only submission of a discovery hint.

## 2. Current eligibility

Postgres RLS-aware views:
- `public.public_seo_media`: existing public video/image records with a real
  storage path, valid public creator and at least an actual title/description or
  three creator-provided tags.
- `public.public_seo_profiles`: valid creator handles with substantial public
  biography or one qualifying public media item. **No verified-only restriction.**
- `public.public_seo_tags`: real tag labels associated with eligible media.

A bare signup without a biography or media is not submitted as a search doorway
page. A creator becomes eligible automatically when they complete a bio or
publish qualifying media. No false biography or title is written into Postgres.

**Moderation limitation:** The live media/profile schema currently has no explicit
published/private/suspended/moderated status fields. These views inherit the
application's existing public SELECT policies, but **cannot prove moderation or
consent status**. Before broader public indexing, implement reliable content
visibility/moderation policies that govern both app access and SEO views.
Do not publish restricted or non-consensual content merely to gain SEO reach.

## 3. Automatic discovery timeline

1. Successful video/image upload stores media in Supabase, writes the public
   record and (for videos) attempts to create a real JPG poster.
2. Client calls `POST /api/seo/notify` without delaying upload completion.
3. The endpoint checks the signed-in user and public media eligibility, then
   upserts the canonical into the private idempotent SEO event queue.
4. If IndexNow is configured, the authenticated event is submitted after the
   HTTP response; failure stays recorded for retry.
5. A daily Vercel Cron attempts failed/queued IndexNow submissions.
6. Public sitemap caches expire after at most five minutes; public links on
   profiles, topics and creator directory provide additional crawl paths.
7. Profile biography/username updates also notify public discovery. Renames
   preserve historical URLs by a permanent redirect.
8. Google discovers normal profiles, images, and prerecorded videos through
   the sitemap and crawlable links. Its restricted Indexing API is **not used**.

## 4. Sitemap URLs

- `https://goongram.com/robots.txt`
- `https://goongram.com/sitemap.xml` (index)
- `https://goongram.com/sitemap/0.xml` (static)
- `https://goongram.com/sitemap/1.xml` onward (public creator, video,
  image, populated niche chunks of 500 URLs each)

Chunk generation uses select pagination, filters, stable created timestamps,
5-minute CDN caching, 503 on database outages, no massive response building,
and XML escaping.

Video sitemaps include `video:family_friendly=no`. The required
`video:thumbnail_loc` only appears when a **genuine video-specific** thumbnail
exists. Until then, a video remains in a standard URL sitemap but cannot rely on
enhanced Google Videos metadata or rich results.

## 5. External deployment setup (Vercel)

Configure production environment variables without checking values into Git:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://goongram.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Connected production Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server public API access |
| `SUPABASE_SECRET_KEY` | Server-only sitemap and public SEO queries |
| `GOOGLE_SITE_VERIFICATION` | Google Search Console HTML-tag token |
| `BING_SITE_VERIFICATION` | Bing Webmaster Tools HTML-tag token |
| `INDEXNOW_KEY` | Optional 8–128 character IndexNow key |
| `CRON_SECRET` | Required to authenticate the Vercel daily retry endpoint |

After deployment:
1. In Google Search Console, verify the `goongram.com` domain property (DNS)
   or use the HTML meta-tag token. Submit `https://goongram.com/sitemap.xml`.
2. In Bing Webmaster Tools, verify ownership, add that sitemap, and enable
   IndexNow if desired.
3. If IndexNow is enabled, verify
   `https://goongram.com/indexnow-key.txt` returns precisely the configured
   key. Never put `SUPABASE_SECRET_KEY` or `CRON_SECRET` in the browser.
4. Deploy `vercel.json` with a daily retry job. On Vercel, `CRON_SECRET`
   is used to authenticate scheduled invocations.
5. Run Google Rich Results Test and URL Inspection on a real, eligible
   profile, video **with poster**, and image landing page.
6. Configure publicly reachable HTTPS media assets and any necessary R2
   cross-origin headers. Do not expose private/signed storage URLs in sitemaps.
7. For existing videos missing poster files, visit `/admin/seo` and select
   **Generate missing video posters**. This is an admin-only FFmpeg task,
   processes one old Supabase-hosted video at a time, and requires an executable
   FFmpeg binary on Vercel. Already-public full CDN/R2 URLs need a separate
   authorised backfill path; this task deliberately does not fetch arbitrary
   external hosts on the server.

## 6. Monitoring

`/admin/seo` distinguishes public eligibility, posters missing, queued and
failed publisher notifications. It does **not** report confirmed indexing.

Monitor externally:
- Google Search Console: page indexing, crawled/discovered not indexed, video
  indexing, Search appearance, Performance queries/clicks/impressions.
- Bing Webmaster Tools: sitemap ingestion, index coverage and IndexNow reports.
- PageSpeed Insights and Search Console Core Web Vitals: LCP, INP, CLS.
- Vercel logs: SEO route failures, thumbnail backfill, IndexNow delivery.
- Supabase: public views, queue failures, storage errors and policy compliance.

## 7. Important limitations and launch blockers

**Age confirmation:** The existing `AdultAgeGate` deliberately does not
render page content until the visitor confirms adulthood. This protects the
existing age-confirmation flow, but can prevent Googlebot from seeing the
actual video/player and visible content. It has **not been bypassed**, even for
bots; deceptive Googlebot-only content would be cloaking. A separate,
consent-compliant, server-visible public preview architecture is still needed
for strong video indexing. Public metadata and sitemaps alone cannot guarantee
Google Video indexing.

**Visibility and consent:** No underlying moderated/privacy state exists yet.
Approval, takedown and suspension rules need to be made machine-readable and
reflected in both public access and SEO eligibility. This must be addressed
before claiming all indexed content meets rights and moderation rules.

**Existing thumbnails:** Most older videos do not have real per-video posters.
An administrator must run the supplied backfill after deployment. Poster
generation for new uploads is best effort and should be monitored.

**No instant indexing:** IndexNow targets participating search engines; it does
not force Google to index content. Google Search Console verification, video
rich-result recognition, site indexing and crawler coverage remain external,
observable states.

**Performance:** Next.js build and TypeScript feature checks validate the
source. Live Lighthouse/PageSpeed, real media CDN requests, signed-in upload
flows, age-gate crawler inspection and third-party discovery API deliveries
require deployed browser and search-console tests.

## 8. Reversibility

Each new migration includes a rollback comment or uses an additive field/view.
Before rollback, disable SEO publishing and record current queue contents.
Drop dependent views in reverse order:
`public_seo_tags`, `public_seo_profiles`, `public_seo_media`.
Then drop `seo_discovery_events`, `profile_username_redirects` and trigger,
and the SEO-specific media indexes. Only drop `thumbnail_path` after
confirming that generated posters have been copied/preserved.

No authentication tables, user credentials or private verification images
are exposed by the public SEO views.
