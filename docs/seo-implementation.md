# Goongram technical SEO implementation and deployment checklist

## Audit: major blockers corrected

- The global age-confirmation component previously replaced the entire application server output with a placeholder. It now leaves crawlable HTML in the response while preserving the age-verification overlay and preventing unconfirmed visitors from interacting with content.
- All public pages previously inherited the homepage canonical. The global canonical was removed; individual routes now supply their own.
- Profile pages were mainly client-rendered, and profile JSON-LD/head tags were duplicated. Eligible profiles now have server-rendered structured data, links to real uploads, accurate unique metadata and permanent redirects from recorded username history.
- The existing XML sitemap indexed only *verified* creators and tags. It now divides publicly eligible profiles, videos, images and topics into 500-record chunks, while excluding account, payout, verification and form pages. Video sitemap entries include video-specific metadata only if a real thumbnail exists.
- The old video metadata used the same generic brand image for every upload. VideoObject JSON-LD is now conditional on a real thumbnail and accessible content URL. Original video duration comes from `media.duration_seconds`, never the 30-second Home preview.
- Images previously lacked individual crawlable landing pages. `/image/[id]` renders a public HTML page, descriptive image, original creator and ImageObject.
- The Explore client previously used `next/head` to construct metadata; its collection layout now uses the App Router Metadata API. Valid public niche pages have server-rendered text links; thin topics are noindexed.
- The platform relied heavily on infinite-scroll and JavaScript-only actions. New `/creators`, `/videos` and `/images` pages have genuine public content and ordinary pagination links. Profiles link to their own public media.
- Existing Supabase `public_seo_media`, `public_seo_profiles` and `public_seo_tags` security-invoker views were verified, versioned in a migration and reused across metadata, directories and sitemaps.
- Media source resolution now recognises existing complete HTTPS URLs (including Cloudflare R2) as well as Supabase Storage object keys.

## Canonical URLs and discovery

| Resource | Canonical page | Sitemap |
|---|---|---|
| Creator | `https://goongram.com/USERNAME` | `/sitemap/profiles-N.xml` |
| Video | `https://goongram.com/watch/ID` | `/sitemap/videos-N.xml` |
| Image | `https://goongram.com/image/ID` | `/sitemap/images-N.xml` |
| Topic | `https://goongram.com/explore/niches/SLUG` | `/sitemap/niches-N.xml` |
| Static directories | `/creators`, `/videos`, `/images` | `/sitemap/static.xml` |

The sitemap index is `https://goongram.com/sitemap.xml` and is advertised through `robots.txt`. Chunk size is 500; HTTP cache is approximately five minutes. Only eligible, public data is returned. A URL appearing in a sitemap indicates eligibility/discovery, **not confirmed Google indexing**.

## Publication pipeline

Successful public media publication and eligible profile changes enqueue canonical URLs in `public.seo_discovery_events` via nonblocking database triggers. The queue is accessible only to trusted backend services. `/api/seo/dispatch` processes pending entries and submits to IndexNow, subject to configured credentials. IndexNow is **for Bing and participating services**, not Google's general-page indexing. A failed request remains queued for limited retries with an error record.

The Vercel Cron entry runs daily (compatible with basic plans). For faster submission, use a supported paid Vercel Cron cadence or an external authenticated scheduler every 15 minutes. The sitemap itself makes new eligible public entries discoverable after cache refresh without requiring IndexNow.

## Deployment settings (must be configured manually)

Set these **server-side** Vercel Environment Variables:

- `SUPABASE_SECRET_KEY` or the existing service-role secret required by `getSupabaseAdmin` for private sitemap reads and the dispatch queue. It must **never** have a `NEXT_PUBLIC_` prefix.
- `CRON_SECRET`: at least 20 random characters; Vercel Cron supplies `Authorization: Bearer ...`.
- `INDEXNOW_KEY`: random alphanumeric (or hyphen) 8–128 characters. Its verification page becomes `/indexnow/KEY.txt`.
- `GOOGLE_SITE_VERIFICATION`: Search Console HTML tag token, if choosing meta-tag verification.
- `BING_SITE_VERIFICATION`: Bing Webmaster Tools HTML tag token, if choosing meta-tag verification.

Google: verify the canonical host `https://goongram.com` (ideally domain property via DNS), submit `/sitemap.xml`, use URL Inspection to test actual renderability, and monitor Pages and Video indexing. Google Indexing API must not be used for ordinary prerecorded videos, images or profiles.

Bing: verify the site, submit the same sitemap, optionally enable IndexNow with the key above and inspect the queue/IndexNow reports.

Do not promise automatic placement in search results. Indexing and ranking depend on engine scheduling, access, content quality, and SafeSearch policies.

## Important limitations and follow-up

1. **Missing real video thumbnails.** At audit time the connected project contained five video rows and **zero** non-null `media.thumbnail_path` values. Neither a company logo nor a frame timestamp is a genuine video thumbnail. Add thumbnail extraction to the upload/processing pipeline, save a public HTTPS URL or storage key to `thumbnail_path`, verify crawler access, and retest VideoObject/video sitemap entries. Until then, videos remain in ordinary XML sitemaps without fabricated video extensions.
2. **No moderation/visibility field in the inspected public media schema.** The security-invoker public eligibility views filter real media and avoid empty/invalid records, but they cannot distinguish unreported deleted/unauthorised content beyond the fields present. Add a publication/moderation status before exposing restricted private content; do not automatically SEO-index unmoderated uploads if your policy requires review.
3. **No automatic Google Indexing API integration**: it is unsupported for these content types. Sitemap refresh and ordinary HTML links are the compliant mechanisms.
4. **No live crawler confirmation** was obtained from Google Search Console/Bing. Vercel production browser testing, Search Console inspection, Supabase/R2 CDN CORS and thumbnail access still need verification.
5. **Username redirects** rely on `profile_username_redirects`; historic username changes not recorded there cannot be reconstructed.
6. **Private rows** must be protected by Supabase RLS and publication rules, not just `noindex` or robots.txt. Never expose verification/selfie images.
7. Existing private/admin pages are marked noindex or disallowed appropriately. Do not block a noindex page in robots.txt if it must be crawled for deindexing.
8. Review Core Web Vitals using field data after deployment. The site's third-party ads, media playback and client-side UI can materially affect LCP/INP/CLS; this implementation does not claim measured performance gains.

## Monitoring

- Google Search Console: Page indexing and Video indexing coverage, sitemap fetch errors, canonical conflicts, discovered-not-indexed vs crawled-not-indexed, Search performance by page type.
- Bing Webmaster Tools: IndexNow accepted URLs, crawl errors, indexing reports, and sitemap status.
- Supabase: `select kind,status,count(*) from public.seo_discovery_events group by kind,status;` and failures/attempts. A delivered IndexNow event is not an indexed URL.
- Media data quality: `select count(*) filter (where thumbnail_path is null) as missing_thumbnails from public.media where media_type='video';`
- CDN: compare crawled content URLs and thumbnails against public HTTP 200, correct MIME types, stable URLs and no auth/cookie requirements.
- Rich Results Test: validate conditional VideoObject/ProfilePage/ImageObject and ensure represented metadata actually exists.

## Recovery and rollback

All changes are isolated on the SEO feature branch; avoid merging without preview deployment validation. To revert, roll back the SEO PR and restore the previous view definitions/trigger functions from the database schema backup. Migration-created indexes can be removed individually; the discovery queue trigger can be dropped without affecting publishing. Do not disable RLS or drop user media tables.
