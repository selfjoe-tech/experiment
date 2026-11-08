import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { parseExternalVideoUrl, type VideoQuality } from "@/lib/external-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = parseExternalVideoUrl(input?.url);
  if (!parsed) return NextResponse.json({ error: "Invalid video URL." }, { status: 400 });

  const quality: VideoQuality = input?.quality === "best"
    ? "best"
    : [1080, 720, 480, 360, 240].includes(Number(input?.quality))
      ? Number(input.quality) as VideoQuality
      : "best";

  const origin = process.env.VIDEO_DOWNLOADER_API_URL?.replace(/\/+$/, "");
  const secret = process.env.VIDEO_DOWNLOADER_SECRET;
  if (!origin || !secret) {
    return NextResponse.json({ error: "The download service is not configured." }, { status: 503 });
  }

  const expires = Math.floor(Date.now() / 1000) + 120;
  const message = `${parsed.url}\n${quality}\n${expires}`;
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  const search = new URLSearchParams({
    url: parsed.url,
    quality: String(quality),
    expires: String(expires),
    signature,
  });

  return NextResponse.json(
    { downloadUrl: `${origin}/download?${search.toString()}` },
    { headers: { "Cache-Control": "no-store" } }
  );
}
