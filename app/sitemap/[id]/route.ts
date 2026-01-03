// app/sitemap/[id]/route.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.upskirtcandy.com").replace(/\/$/, "");
const CHUNK_SIZE = 45_000;

const TAGS_TABLE = "tags";
const TAGS_SLUG_COL = "slug";
const TAGS_UPDATED_COL = "updated_at";

function abs(path: string) {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function xmlEscape(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeIsoDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function countOrZero(table: string, filter?: (q: any) => any): Promise<number> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) return 0;
  return res.count ?? 0;
}

function urlset(urls: Array<{ loc: string; lastmod?: string | null }>) {
  const items = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : "";
      return `  <url><loc>${xmlEscape(u.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    items +
    `\n</urlset>\n`
  );
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  // ctx.params is NOT a Promise in route handlers
  const raw = ctx.params?.id ?? "";

  // Support /sitemap/1 and /sitemap/1.xml (because [id] can be "1.xml")
  const idStr = raw.toLowerCase().endsWith(".xml") ? raw.slice(0, -4) : raw;
  const n = Number.parseInt(idStr, 10);

  const nowIso = new Date().toISOString();

  // If the id is junk, return empty urlset
  if (!Number.isFinite(n) || n < 0) {
    return new Response(urlset([]), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // Count totals so we can know whether this id belongs to profiles or tags
  const verifiedProfiles = await countOrZero("profiles", (q) =>
    q.eq("verified", true).not("username", "is", null)
  );
  const tags = await countOrZero(TAGS_TABLE);

  const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
  const tagPages = Math.ceil(tags / CHUNK_SIZE);
  const totalPages = profilePages + tagPages;

  // /sitemap/0(.xml) -> static urls
  if (n === 0) {
    const urls = [
      { loc: abs("/"), lastmod: nowIso },

      { loc: abs("/explore"), lastmod: nowIso },
      { loc: abs("/explore/gifs"), lastmod: nowIso },
      { loc: abs("/explore/images"), lastmod: nowIso },
      { loc: abs("/explore/niches"), lastmod: nowIso },

      { loc: abs("/verify"), lastmod: nowIso },
      { loc: abs("/ads"), lastmod: nowIso },

      // you wanted these indexed:
      { loc: abs("/auth/login"), lastmod: nowIso },
      { loc: abs("/auth/signup"), lastmod: nowIso },

      { loc: abs("/saved"), lastmod: nowIso },
      { loc: abs("/settings"), lastmod: nowIso },
    ];

    return new Response(urlset(urls), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  // Outside range -> empty
  if (n > totalPages) {
    return new Response(urlset([]), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const supabase = getSupabaseAdmin();

  // IDs 1..profilePages = profiles
  if (n >= 1 && n <= profilePages) {
    const chunkIndex = n - 1; // 0-based
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    const res = await supabase
      .from("profiles")
      .select("username, updated_at")
      .eq("verified", true)
      .not("username", "is", null)
      .order("username", { ascending: true })
      .range(from, to);

    if (res.error) {
      return new Response(urlset([]), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }

    const urls = (res.data ?? [])
      .map((r: any) => {
        const uname = String(r.username || "").trim();
        if (!uname) return null;
        return {
          loc: abs(`/${encodeURIComponent(uname)}`),
          lastmod: safeIsoDate(r.updated_at) ?? nowIso,
        };
      })
      .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

    return new Response(urlset(urls), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  // IDs after profiles are tags
  const tagId = n - profilePages; // 1..tagPages
  if (tagId >= 1 && tagId <= tagPages) {
    const chunkIndex = tagId - 1;
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    const res = await supabase
      .from(TAGS_TABLE)
      .select(`${TAGS_SLUG_COL}, ${TAGS_UPDATED_COL}`)
      .order(TAGS_SLUG_COL, { ascending: true })
      .range(from, to);

    if (res.error) {
      return new Response(urlset([]), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }

    const urls = (res.data ?? [])
      .map((r: any) => {
        const slug = String(r[TAGS_SLUG_COL] || "").trim();
        if (!slug) return null;
        return {
          loc: abs(`/explore/niches/${encodeURIComponent(slug)}`),
          lastmod: safeIsoDate(r[TAGS_UPDATED_COL]) ?? nowIso,
        };
      })
      .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

    return new Response(urlset(urls), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  return new Response(urlset([]), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
