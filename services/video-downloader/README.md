# Goongram external-link video downloader

Handles public individual-video URLs from X/Twitter, Instagram, Pornhub and Redgifs with yt-dlp and FFmpeg.

**This service has not been deployed by this PR.** The Next.js page responds with a configuration error until the worker is deployed and connected.

## Deploy on a VPS (Docker + Docker Compose)

1. Create a DNS **A record** for your chosen downloader domain, for example `downloads.goongram.com`, pointing to the VPS IPv4 address.
2. Ensure inbound ports 80 and 443 are open, install Docker and Docker Compose, and copy this `services/video-downloader` directory to the VPS.
3. Copy `.env.example` to `.env`; edit `DOWNLOAD_DOMAIN`, then generate a long random secret with `python -c "import secrets; print(secrets.token_hex(32))"`.
4. Run `docker compose up -d --build` in this directory. Caddy issues the HTTPS certificate automatically.
5. Check `https://downloads.goongram.com/health` (or your selected hostname) returns `{"ok":true}`.
6. In Vercel > Goongram project > Settings > Environment Variables, set **server-only** variables:
   - `VIDEO_DOWNLOADER_API_URL=https://downloads.goongram.com` (no trailing slash)
   - `VIDEO_DOWNLOADER_SECRET=<the exact same long secret as on the VPS>`
   Never prefix these with `NEXT_PUBLIC_`.
7. Redeploy the Next.js application.

## Limits and safeguards

- Supports **public, accessible, single-video links** only. Does not use cookies, bypass logins, or decrypt DRM.
- Max duration 20 minutes and max file size 250 MB.
- The Next.js API only handles metadata and short-lived HMAC-signed links; **video bytes go directly from the worker to the browser**, avoiding Vercel transfer/function limits.
- Two simultaneous metadata/download operations maximum per worker process. Run only **one Uvicorn worker** with the provided Docker command.
- Video output prefers MP4 where available; some sources may deliver WebM/MKV when MP4 is unavailable.
- Temporary files are removed after each download response. If a worker process is interrupted during a request, cleanup the temporary directory manually if required (the container uses ephemeral tmpfs).
- Rate-limit requests at the reverse proxy/WAF before public launch. Use bandwidth/storage caps and monitor failures. Keep yt-dlp updated because site extractors regularly change.
- For stronger SSRF protection, apply **network egress firewall rules** on the worker so it cannot reach private, loopback, link-local, or cloud metadata IP ranges. Domain validation alone is not complete SSRF protection.
- Users must have the necessary rights or permission to save content. Platform terms and regional restrictions can apply.

## Configuration errors

If the UI shows "Video downloads are not configured yet", verify both environment variables and redeploy. Errors from unsupported, deleted, blocked or login-required videos are expected for some URLs.
