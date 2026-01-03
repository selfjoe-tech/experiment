// app/sitemap.xml/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

const CHUNK_SIZE = 45_000;

// must match your sitemap.ts
const NICHES_TABLE = "tags";

async function countExact(table: string, filter?: (q: any) => any) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) return 0;
  return res.count ?? 0;
}

export async function GET() {
  const nowIso = new Date().toISOString();

  const verifiedProfiles = await countExact("profiles", (q) =>
    q.eq("verified", true).not("username", "is", null)
  );

  // if niches table doesn't exist, treat as 0
  let niches = 0;
  try {
    niches = await countExact(NICHES_TABLE);
  } catch {
    niches = 0;
  }

  const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
  const nichePages = Math.ceil(niches / CHUNK_SIZE);
  const totalPages = profilePages + nichePages;

  // id=0 static + 1..totalPages dynamic
  const sitemapUrls = [`${BASE}/sitemap/0.xml`, ...Array.from({ length: totalPages }, (_, i) => `${BASE}/sitemap/${i + 1}.xml`)];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((loc) => `  <sitemap><loc>${loc}</loc><lastmod>${nowIso}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
