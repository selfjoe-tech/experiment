import { NextResponse } from "next/server";
import { parseExternalVideoUrl, type ExternalVideoInfo } from "@/lib/external-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = parseExternalVideoUrl(input?.url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Paste a valid, public video link from X, Instagram, Pornhub or Redgifs." },
      { status: 400 }
    );
  }

  const origin = process.env.VIDEO_DOWNLOADER_API_URL?.replace(/\/+$/, "");
  const secret = process.env.VIDEO_DOWNLOADER_SECRET;
  if (!origin || !secret) {
    return NextResponse.json(
      { error: "Video downloads are not configured yet. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const reply = await fetch(`${origin}/inspect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ url: parsed.url }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const data = await reply.json().catch(() => null);
    if (!reply.ok) {
      return NextResponse.json(
        { error: typeof data?.detail === "string" ? data.detail : "Unable to read this video. It may be private, unavailable or restricted." },
        { status: reply.status === 429 ? 429 : 422 }
      );
    }
    const qualities = Array.isArray(data?.qualities)
      ? data.qualities.filter((q: unknown) => q === "best" || [1080, 720, 480, 360, 240].includes(Number(q)))
      : ["best"];
    const info: ExternalVideoInfo = {
      title: typeof data.title === "string" ? data.title.slice(0, 180) : "Video",
      uploader: typeof data.uploader === "string" ? data.uploader.slice(0, 100) : null,
      duration: typeof data.duration === "number" ? data.duration : null,
      thumbnail: typeof data.thumbnail === "string" && /^https:\/\//.test(data.thumbnail) ? data.thumbnail : null,
      platform: parsed.platform,
      qualities: qualities.length ? qualities : ["best"],
    };
    return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "The video processing service is temporarily unavailable." },
      { status: 503 }
    );
  }
}
