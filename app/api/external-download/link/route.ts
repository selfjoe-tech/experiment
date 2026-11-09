import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { parseExternalVideoUrl, type VideoQuality } from "@/lib/external-download";
import { downloadFilename, ExtractorError, isSafeHlsSource, isSafeProxySource, resolveExternalVideo, selectSource } from "@/lib/external-download/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseQuality(value: unknown): VideoQuality {
  return value === "best" ? "best" :
    [1080, 720, 480, 360, 240].includes(Number(value)) ? Number(value) as VideoQuality : "best";
}

async function getLink(url: unknown, rawQuality: unknown) {
  const parsed = parseExternalVideoUrl(url);
  if (!parsed) return NextResponse.json({ error: "Invalid video post link." }, { status: 400 });
  const quality = parseQuality(rawQuality);
  try {
    const video = await resolveExternalVideo(parsed.url);
    const source = selectSource(video, quality);
    const filename = downloadFilename(parsed.platform, parsed.url);

    // Existing Supabase server secret is used only to authenticate the
    // short-lived optional fallback. It is never exposed to the browser.
    // No new downloader environment variables are required.
    const secret = process.env.VIDEO_DOWNLOADER_SECRET || process.env.SUPABASE_SECRET_KEY;
    let fallbackUrl: string | null = null;
    if (secret && (isSafeProxySource(source.url, parsed.platform) || (parsed.platform === "pornhub" && source.format === "hls" && isSafeHlsSource(source.url)))) {
      const expires = Math.floor(Date.now() / 1000) + 120;
      const message = [parsed.url, String(quality), String(expires)].join("\n");
      const signature = createHmac("sha256", secret).update(message).digest("hex");
      const params = new URLSearchParams({
        url: parsed.url, quality: String(quality),
        expires: String(expires), signature,
      });
      fallbackUrl = "/api/external-download/file?" + params.toString();
    }

    return NextResponse.json({
      downloadUrl: source.format === "hls" ? fallbackUrl : source.url,
      kind: source.format === "hls" ? "hls" : "file", filename, fallbackUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ExtractorError ? error.message : "Unable to prepare this download.",
    }, { status: error instanceof ExtractorError ? error.status : 502 });
  }
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  return getLink(data?.url, data?.quality);
}

// Preview-only extraction probe, disabled on live production.
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response(null, { status: 405 });
  const params = new URL(request.url).searchParams;
  return getLink(params.get("url"), params.get("quality"));
}
