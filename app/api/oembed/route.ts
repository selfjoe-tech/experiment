import { NextRequest, NextResponse } from "next/server";
import { fetchVideoForEmbed } from "@/lib/actions/mediaFeed";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const url = u.searchParams.get("url") || "";

  // expect: https://upskirtcandy.com/watch/123
  let id: number | null = null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    id = Number(parts[parts.length - 1]);
  } catch {
    id = null;
  }

  if (!id) return NextResponse.json({ error: "Invalid url" }, { status: 400 });

  const v = await fetchVideoForEmbed(id);
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canonical = `https://upskirtcandy.com/watch/${id}`;
  const embedUrl = `https://upskirtcandy.com/embed/${id}`;

  const width = 720;
  const height = 1280;

  const fallbackThumb =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

 const thumb =
    (v as any).poster ?? (v as any).thumbnailUrl ?? fallbackThumb;

  const payload = {
    // ✅ Standard oEmbed (snake_case) keys
    version: "1.0",
    type: "video",
    provider_name: "UpskirtCandy",
    provider_url: "https://upskirtcandy.com",
    author_name: "Upskirt Candy",
    author_url: "https://upskirtcandy.com",
    title: v.title ?? "Video",

    thumbnail_url: thumb,
    thumbnail_width: 1200,
    thumbnail_height: 630,

    width,
    height,
    html: `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,

    providerName: "UpskirtCandy",
    providerUrl: "https://upskirtcandy.com",
    authorName: "Upskirt Candy",
    authorUrl: "https://upskirtcandy.com",
    thumbnailUrl: thumb,
    thumbnailWidth: 1200,
    thumbnailHeight: 630,
  };

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}