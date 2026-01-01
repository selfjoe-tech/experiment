// app/api/oembed/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseMediaIdFromResourceUrl(raw: string): number | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  // allow www + non-www
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "upskirtcandy.com") return null;

  const parts = u.pathname.split("/").filter(Boolean);
  // support /watch/:id (and optionally /embed/:id)
  if (parts.length < 2) return null;
  if (parts[0] !== "watch" && parts[0] !== "embed") return null;

  const id = Number(parts[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const urlParam = searchParams.get("url");
    const format = (searchParams.get("format") ?? "json").toLowerCase();

    // oEmbed defines format=json|xml; if you only support json, return 501 for xml :contentReference[oaicite:2]{index=2}
    if (format !== "json") {
      return new NextResponse(null, { status: 501 });
    }

    if (!urlParam) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const mediaId = parseMediaIdFromResourceUrl(urlParam);
    if (!mediaId) {
      // Spec encourages 404 when you have no representation for that url :contentReference[oaicite:3]{index=3}
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const maxwidth = searchParams.get("maxwidth");
    const maxheight = searchParams.get("maxheight");

    // Defaults: your vertical video footprint
    const requestedW = maxwidth ? clamp(parseInt(maxwidth, 10) || 720, 200, 1920) : 720;
    const requestedH = maxheight ? clamp(parseInt(maxheight, 10) || 1280, 200, 1920) : 1280;

    // IMPORTANT: make sure these env vars exist on Vercel (Production env)
    

    // Create client INSIDE handler (avoids import-time crashes)
    const supabase = getSupabaseAdmin(); 
    // TODO: adapt columns/table to your schema
    const { data, error } = await supabase
      .from("media")
      .select("id,title,description,thumbnail_url,width,height")
      .eq("id", mediaId)
      .maybeSingle();

    if (error) {
      console.error("Supabase error", error);
      return NextResponse.json({ error: `Database error ${error}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const siteUrl = "https://www.upskirtcandy.com"; // keep consistent with your canonical domain
    const width = data.width ?? requestedW;
    const height = data.height ?? requestedH;

    // oEmbed video type requires html + width + height :contentReference[oaicite:4]{index=4}
    const embedSrc = `${siteUrl}/embed/${mediaId}`;
    const html = `<iframe src="${embedSrc}" width="${width}" height="${height}" frameborder="0" scrolling="no" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;

    return NextResponse.json(
      {
        version: "1.0",
        type: "video",
        provider_name: "Upskirt Candy",
        provider_url: siteUrl,
        title: data.title ?? `UpskirtCandy video #${mediaId}`,
        author_name: "Upskirt Candy",
        author_url: siteUrl,
        width,
        height,
        html,
        thumbnail_url: data.thumbnail_url ?? undefined,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("oEmbed fatal", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
