// app/sitemap.xml/route.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const CHUNK_SIZE = 45_000;
const TAGS_TABLE = "tags";

function xmlEscape(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// ✅ Do NOT swallow errors. If counts fail, return 503 so Google retries.
async function countExact(table: string, filter?: (q: any) => any): Promise<number> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);

  const res = await q;
  if (res.error) throw res.error;
  return res.count ?? 0;
}

export async function GET() {
  const now = new Date().toISOString();

  try {
    const [verifiedProfiles, tags] = await Promise.all([
      countExact("profiles", (q) => q.eq("verified", true).not("username", "is", null)),
      countExact(TAGS_TABLE),
    ]);

    const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
    const tagPages = Math.ceil(tags / CHUNK_SIZE);
    const totalPages = profilePages + tagPages;

    // These MUST match what you serve in app/sitemap/[id]/route.ts
    // (your [id] route already supports both /sitemap/1 and /sitemap/1.xml)
    const sitemapUrls: string[] = [`${BASE}/sitemap/0.xml`];
    for (let i = 1; i <= totalPages; i++) {
      sitemapUrls.push(`${BASE}/sitemap/${i}.xml`);
    }

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemapUrls
        .map(
          (loc) =>
            `  <sitemap><loc>${xmlEscape(loc)}</loc><lastmod>${now}</lastmod></sitemap>`
        )
        .join("\n") +
      `\n</sitemapindex>\n`;

    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    // ✅ If Supabase is down / count failed, do NOT return a "valid but wrong" index.
    // Return 503 so Google retries.
    return new Response("Upstream error", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
