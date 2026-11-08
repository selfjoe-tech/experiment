# Goongram Cloudflare R2 migration (staging branch)

This branch is **not production-ready** until credentials, domain setup, migration verification and full site-wide storage audit are complete.

## Cloudflare resources

- Account: `65ca42da1b9474dcc4e329177d793b07`
- Bucket: `goongram-media` (Standard, WEUR)
- Test-only public domain: `https://pub-e5af36c8b6704171aea10099e184c95c.r2.dev`
- Preferred production delivery: `https://media.goongram.com` (add goongram.com as an active Cloudflare zone before attaching this custom R2 domain)
- Bucket CORS allows PUT/GET/HEAD for goongram.com, www.goongram.com, and localhost:3000.

## Required Vercel variables

Configure **server-only**:
- `R2_ACCOUNT_ID=65ca42da1b9474dcc4e329177d793b07`
- `R2_BUCKET_NAME=goongram-media`
- `R2_ACCESS_KEY_ID`: R2 object read/write scoped token's access key ID
- `R2_SECRET_ACCESS_KEY`: matching secret, NEVER exposed with NEXT_PUBLIC_

Configure **public**:
- `NEXT_PUBLIC_R2_PUBLIC_URL=https://media.goongram.com` once the custom domain is configured.
  Temporarily use the test-only r2.dev domain on preview deployments.

Install AWS SDK packages and update/commit the project lockfile:
```sh
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Migration and rollout (do not skip)

1. Freeze old writes or enable dual-read until the backfill and new upload deployment can coexist.
2. Copy all **eight** objects from Supabase's public `media` bucket to the same keys in R2, preserving Content-Type. Source inventory is 7 videos + 1 image (~108 MB). The two private buckets are empty at audit time; keep private buckets private if files appear later.
3. Verify every destination using HEAD (size, Content-Type) and sampled GET/range requests for videos. Do not assume copying R2 bytes automatically changes the database.
4. For each row in public.media, replace `storage_path` with the HTTPS R2 URL only after its R2 object passes validation. Update profiles.avatar_url similarly. Preserve IDs and all other fields. Check all other URL/path columns before treating the migration as complete.
5. Audit all other Supabase Storage writers/readers and deletion flows, including verification media, ad uploads, watermark/trim/staging routes, and account deletion. New writes must not use Supabase Storage.
6. Test video seeking, download, thumbnail, images, avatars, embeds, SEO, admin deletion, upload progress, and authorization on both mobile and desktop.
7. Release to production only after all fetches work against R2 and no write path still points to Supabase Storage. Keep originals until a verified rollback window has passed.

## Notes

This migration deliberately does NOT delete or modify any current Supabase object or database row.
Presigned uploads require **S3 R2 API credentials**, which are separate from the Cloudflare account connector login.
`r2.dev` is intended only for development/testing and is rate limited; a production R2 custom domain is required.
