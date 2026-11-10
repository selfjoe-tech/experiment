# Goongram mobile performance and sitemap audit — 10 November 2026

## Background

Google Search Console flagged the homepage for mobile LCP longer than 2.5 seconds. LCP is the time until the largest above-the-fold content element is painted (75th percentile of real-user visits in Core Web Vitals). This code audit cannot establish the exact failing LCP element or a new measured LCP value. Check PageSpeed Insights' mobile breakdown and Search Console after sufficient traffic accumulates.

## Applied improvements

- **Home initial HTML:** The home server page now fetches the first 7 feed items and passes initial data to HomeTimeline. This removes hydration, browser auth check, and browser media query from the critical path when the server query succeeds. Client loading remains a fallback.
- **Correct feed state:** User identity/preferences and starting page index are preserved so the first batch isn't duplicated and the Following tab still works.
- **Home media memory:** PostCard attaches video sources only to visible videos, detaches inactive sources to free media buffers, uses a stored video poster when available, and uses Next.js responsive image resizing for pictures. The first feed image receives priority and offscreen article rendering is deferred.
- **Explore/profile thumbnail memory:** Touch devices now retain up to 24 object URL thumbnails, create one at a time with a 144px target size, and release failed video decoding resources.
- **Reels:** VideoFeed already mounts only the active video using placeholders for inactive cards; retained.
- **Grid lists:** VirtualizedSquareGrid already limits the number of DOM tiles; retained.
- **Ad behavior:** Existing JuicyAds placements, scripts and the five-second interstitial remain unchanged.

## Sitemap

- The sitemap index uses dynamic 500-item chunks for public creator profiles, videos, images and niches.
- The static sitemap now includes /reels and /ads in addition to home, directories/explore, creator monetization and download pages.
- Do not list admin/user-account routes, /ad-break (noindex), uploads or search-query pages.
- Submit one sitemap to Search Console: https://goongram.com/sitemap.xml. Child sitemaps are already linked in the index.

## Remaining work / further validation

1. Some videos have no stored thumbnail. Generating small WebP/AVIF posters during upload would improve first paint and avoid video decoding for previews.
2. Long Home sessions accumulate PostCard React elements; implementing a tested windowed list would reduce long-session DOM memory, but must preserve scroll position and interactions.
3. The ad script, its placements and the age gate may affect LCP/INP. They were not changed to avoid unexpected monetization or access regressions. Measure the actual LCP element and resource contention first.
4. Lower-bitrate responsive video renditions, fast-start MP4s and R2 cache/range settings should be addressed in the media pipeline.
5. Next.js 16 warns about unsupported matcher and eslint keys in next.config.ts; move the proxy matcher separately after regression tests. TypeScript build errors are currently ignored.
6. Run a mobile Lighthouse trace, inspect Chrome memory and network, and watch the rolling 28-day field metrics. A measured LCP of 2.5s or less cannot be asserted from a static code review.

## Preview checks

Vercel preview returned HTTP 200 for Home, Reels, Monetization, Watch, and both sitemap routes. Home initial HTML includes post cards without preattached video src values. Public monetization rates render as USD $0.20/$0.30 per 1,000 qualifying Watch visits. The child static sitemap includes /ads and /reels; the Supabase rate migration was verified separately.
