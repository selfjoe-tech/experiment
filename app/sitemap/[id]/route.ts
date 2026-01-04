// app/sitemap/[id]/route.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 3600;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const CHUNK_SIZE = 45_000;

const TAGS_TABLE = "tags";
const TAGS_SLUG_COL = "slug";
const TAGS_DATE_COL = "created_at"; // ✅ you said updated_at doesn't exist

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

// Ensures the XML starts EXACTLY with "<?xml" (no whitespace, no BOM)
function buildUrlset(urls: Array<{ loc: string; lastmod?: string | null }>) {
  const items = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : "";
      return `  <url><loc>${xmlEscape(u.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    items +
    `\n</urlset>\n`;

  // Strip any accidental BOM at the start (just in case)
  return xml.replace(/^\uFEFF/, "");
}

async function countExact(table: string, filter?: (q: any) => any): Promise<number> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) throw res.error;
  return res.count ?? 0;
}

function xmlResponse(body: string, extraHeaders: Record<string, string> = {}) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      ...extraHeaders,
    },
  });
}

export async function GET(req: Request, context: { params?: { id?: string } }) {
  const fromParams = context?.params?.id;
  const fromPath = new URL(req.url).pathname.split("/").pop();
  const raw = String(fromParams ?? fromPath ?? "");

  // supports /sitemap/0 and /sitemap/0.xml
  const idStr = raw.toLowerCase().endsWith(".xml") ? raw.slice(0, -4) : raw;
  const m = idStr.match(/^(\d+)$/);
  const n = m ? Number.parseInt(m[1], 10) : Number.NaN;

  const debugHeaders = {
    "X-Sitemap-Id-Raw": raw,
    "X-Sitemap-Id-Parsed": String(n),
  };

  // invalid id -> 404 (not an empty urlset)
  if (!Number.isFinite(n) || n < 0) {
    return new Response("Not Found", { status: 404, headers: debugHeaders });
  }

  const nowIso = new Date().toISOString();

  // /sitemap/0.xml => static urls
  if (n === 0) {
    const urls = [
      { loc: abs("/"), lastmod: nowIso },
      { loc: abs("/explore/gifs"), lastmod: nowIso },
      { loc: abs("/explore/images"), lastmod: nowIso },
      { loc: abs("/explore/niches"), lastmod: nowIso },
      { loc: abs("/verify"), lastmod: nowIso },
      { loc: abs("/ads"), lastmod: nowIso },
      { loc: abs("/auth/login"), lastmod: nowIso },
      { loc: abs("/auth/signup"), lastmod: nowIso },
    ];

    return xmlResponse(buildUrlset(urls), debugHeaders);
  }

  // dynamic chunks (profiles then tags)
  try {
    const [verifiedProfiles, tags] = await Promise.all([
      countExact("profiles", (q) => q.eq("verified", true).not("username", "is", null)),
      countExact(TAGS_TABLE),
    ]);

    const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
    const tagPages = Math.ceil(tags / CHUNK_SIZE);
    const totalPages = profilePages + tagPages;

    // out of range -> 404
    if (n > totalPages) {
      return new Response("Not Found", { status: 404, headers: debugHeaders });
    }

    const supabase = getSupabaseAdmin();

    // 1..profilePages => profiles
    if (n >= 1 && n <= profilePages) {
      const chunkIndex = n - 1;
      const from = chunkIndex * CHUNK_SIZE;
      const to = from + CHUNK_SIZE - 1;

      const res = await supabase
        .from("profiles")
        .select("username, updated_at, created_at") // safe fallback
        .eq("verified", true)
        .not("username", "is", null)
        .order("username", { ascending: true })
        .range(from, to);

      if (res.error) throw res.error;

      const urls = (res.data ?? [])
        .map((r: any) => {
          const uname = String(r.username || "").trim();
          if (!uname) return null;

          const lastmod =
            safeIsoDate(r.updated_at) ?? safeIsoDate(r.created_at) ?? nowIso;

          return { loc: abs(`/${encodeURIComponent(uname)}`), lastmod };
        })
        .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

      // If this ever happens, return 404 instead of empty urlset (prevents GSC “missing url tag”)
      if (urls.length === 0) {
        return new Response("Not Found", { status: 404, headers: debugHeaders });
      }

      return xmlResponse(buildUrlset(urls), debugHeaders);
    }

    // remaining => tags
    const tagId = n - profilePages; // 1..tagPages
    if (tagId >= 1 && tagId <= tagPages) {
      const chunkIndex = tagId - 1;
      const from = chunkIndex * CHUNK_SIZE;
      const to = from + CHUNK_SIZE - 1;

      const res = await supabase
        .from(TAGS_TABLE)
        .select(`${TAGS_SLUG_COL}, ${TAGS_DATE_COL}`)
        .order(TAGS_SLUG_COL, { ascending: true })
        .range(from, to);

      if (res.error) throw res.error;

      const urls = (res.data ?? [])
        .map((r: any) => {
          const slug = String(r[TAGS_SLUG_COL] || "").trim();
          if (!slug) return null;

          const lastmod = safeIsoDate(r[TAGS_DATE_COL]) ?? nowIso;

          return {
            loc: abs(`/explore/niches/${encodeURIComponent(slug)}`),
            lastmod,
          };
        })
        .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

      if (urls.length === 0) {
        return new Response("Not Found", { status: 404, headers: debugHeaders });
      }

      return xmlResponse(buildUrlset(urls), debugHeaders);
    }

    return new Response("Not Found", { status: 404, headers: debugHeaders });
  } catch {
    // ✅ Supabase failed or other upstream issue:
    // return 503 so Google retries (instead of caching an empty/broken sitemap).
    return new Response("Upstream error", {
      status: 503,
      headers: {
        ...debugHeaders,
        "Cache-Control": "no-store",
      },
    });
  }
}
