# Goongram R2 migration — deployment checklist

**Status: WIP. Do not merge to production until credentials, data backfill and preview tests are complete.**

## Resources configured
- Public R2 bucket: goongram-media (Standard, WEUR)
- Custom CDN hostname: https://media.goongram.com (SSL active)
- Private R2 bucket: goongram-private (no public hostname, verification selfies)
- Vercel: experiment-iitq, GitHub: selfjoe-tech/experiment
- Supabase source: tkplsmxyouexyirhkqlf; 7 videos + 1 avatar (~108 MB) at inventory; verification and staging empty.

## Vercel environment variables

Already installed: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PRIVATE_BUCKET_NAME, NEXT_PUBLIC_R2_PUBLIC_URL.

**Still missing, and must be entered privately in Vercel Settings > Environment Variables:**
- R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (S3 object Read & Write token for goongram-media).
- R2_PRIVATE_ACCESS_KEY_ID and R2_PRIVATE_SECRET_ACCESS_KEY (separate S3 object Read & Write token for goongram-private).

If a token was scoped only to goongram-media it will not work for goongram-private. Never use NEXT_PUBLIC_ for credentials.

The PR has no new npm dependencies. R2 S3 URL signing uses Node's built-in crypto.

## Updated code

- Videos and images: direct browser PUT to R2 with signed URLs, followed by authenticated R2 HEAD size/MIME validation.
- Ads and avatars: direct/server-side R2 uploads.
- Verification selfies: private R2 object key prefixed with r2-private: in Supabase database, temporary signed GET only for admin review.
- R2-aware deletion for ordinary uploads, reports, and user cleanup. Legacy object paths still supported.
- No schema changes: media.storage_path and thumbnail_path, ads.storage_path, profiles.avatar_url stay in Supabase.
- Legacy stage-upload and trim-video API routes retired (the current upload screen does not use them).
- Existing read paths accept full HTTPS URLs for Reels, images, download, embeds and SEO.

## Data backfill — Windows / local computer

This tool environment cannot download Supabase binary objects (outbound network access denied). Use the committed script locally with Node 20+.

Set these private environment values in your terminal, without committing secrets:
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, NEXT_PUBLIC_R2_PUBLIC_URL.

From the migration branch:
1. Run: node scripts/migrate-supabase-r2.mjs
   Dry-run, inventory only.
2. Run: node scripts/migrate-supabase-r2.mjs --execute
   Copy every original public-media object and HEAD-verify size and MIME. NO database URLs changed.
3. Inspect report and check video Range playback, thumbnails, and avatars.
4. Run: node scripts/migrate-supabase-r2.mjs --execute --update-db
   Verify again, then atomically condition each row update on its old value. Updates media, ads, thumbnails and avatars.
5. Repeat source inventory to catch uploads since initial listing. Keep Supabase originals for rollback.

## Final release gates

- [ ] Public and private R2 secrets set server-side in Vercel.
- [ ] Branch preview build passes.
- [ ] Browser PUT signatures, object HEAD verification and upload progress tested.
- [ ] Private selfies cannot be viewed publicly.
- [ ] 8 old files copied and verified, references changed; recheck for new files.
- [ ] All user upload, verification, advertising, download, delete and moderator flows tested.
- [ ] Video streaming and Range seeking verified; CDN caching configured.
- [ ] No critical Supabase Storage writes remain in active endpoints.
- [ ] Main branch merged only after working preview is approved.
- [ ] Disable r2.dev once the custom CDN has been proven.

Never delete the Supabase source objects during the initial migration.
