import { createHmac, timingSafeEqual } from "node:crypto";
import { parseExternalVideoUrl, type VideoQuality } from "@/lib/external-download";
import { streamHlsAsMp4 } from "@/lib/external-download/hls";
import {
  downloadFilename, EXTRACTOR_USER_AGENT, isSafeProxySource,
  resolveExternalVideo, selectSource, isSafeHlsSource,
} from "@/lib/external-download/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_RELAY_BYTES = 150 * 1024 * 1024;
const Q = ["best", "1080", "720", "480", "360", "240"];

function validSignature(input: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const a = Buffer.from(createHmac("sha256", secret).update(input).digest("hex"), "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a,b);
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const raw = search.get("url") || "";
  const quality = search.get("quality") || "best";
  const expires = search.get("expires") || "";
  const signature = search.get("signature") || "";
  const parsed = parseExternalVideoUrl(raw);
  if (!parsed || !Q.includes(quality)) return bad("Invalid video request.");
  if (!/^\d{10}$/.test(expires) || Number(expires) < Date.now() / 1000 ||
      Number(expires) > Date.now() / 1000 + 120) return bad("Download link expired.", 403);
  const secret = process.env.VIDEO_DOWNLOADER_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret || !validSignature([parsed.url, quality, expires].join("\n"), signature, secret)) {
    return bad("Unauthorized download link.", 403);
  }

  try {
    const info = await resolveExternalVideo(parsed.url);
    const source = selectSource(info, quality === "best" ? "best" : Number(quality) as VideoQuality);
    if (parsed.platform === "pornhub" && source.format === "hls") {
      if (!isSafeHlsSource(source.url)) return bad("Invalid HLS source.", 422);
      const filename = downloadFilename(parsed.platform, parsed.url);
      return streamHlsAsMp4(source.url, filename, request.signal);
    }
    if (!isSafeProxySource(source.url, parsed.platform)) return bad("This media host does not support the download relay.", 422);

    let currentUrl = source.url;
    let response: Response | null = null;
    for (let redirects = 0; redirects < 3; redirects++) {
      response = await fetch(currentUrl, {
        headers: {
          "User-Agent": EXTRACTOR_USER_AGENT,
          Accept: "video/mp4,video/webm,application/octet-stream,*/*",
          Referer: parsed.platform === "redgifs" ? "https://www.redgifs.com/" :
            parsed.platform === "x" ? "https://x.com/" : "https://www.pornhub.com/",
        },
        cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(90000),
      });
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get("location");
        if (!location) return bad("Video host returned an invalid redirect.", 502);
        const redirected = new URL(location, currentUrl).href;
        if (!isSafeProxySource(redirected, parsed.platform)) return bad("Video redirect was blocked.", 502);
        currentUrl = redirected;
        continue;
      }
      break;
    }
    if (!response || !response.ok || !response.body) return bad("Could not retrieve the video file from the source.", 502);
    const mime = (response.headers.get("content-type") || "").toLowerCase();
    if (/text\/html|application\/json|mpegurl|dash\+xml|text\/xml/.test(mime)) return bad("The source returned a webpage or playlist, not a video file.", 422);
    const length = Number(response.headers.get("content-length") || "0");
    if (length > MAX_RELAY_BYTES) return bad("Video exceeds the relay size limit.", 413);

    let transferred = 0;
    const limited = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        transferred += chunk.byteLength;
        if (transferred > MAX_RELAY_BYTES) {
          controller.error(new Error("Video exceeded the relay size limit."));
          return;
        }
        controller.enqueue(chunk);
      },
    }));

    const filename = downloadFilename(parsed.platform, parsed.url);
    const headers = new Headers({
      "Content-Type": mime.startsWith("video/") ? mime : "application/octet-stream",
      "Content-Disposition": "attachment; filename=\"" + filename + "\"",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (length > 0) headers.set("Content-Length", String(length));
    return new Response(limited, { status: 200, headers });
  } catch {
    return bad("The media host could not stream this video. Try another public post.", 502);
  }
}
