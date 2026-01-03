import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const revalidate = 3600;

const BASE =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

const CHUNK_SIZE = 45_000;

const TAGS_TABLE = "tags";
const TAGS_SLUG_COL = "slug";
const TAGS_UPDATED_COL = "updated_at";

function abs(path: string) {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function safeDate(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function xmlEscape(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function countOrZero(table: string, filter?: (q: any) => any): Promise<number> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) return 0;
  return res.count ?? 0;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } } // <-- NOT a Promise
) {
  const n = Number.parseInt(params.id, 10);
  if (!Number.isFinite(n) || n < 0) return new Response("", { status: 404 });

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Count pages
  const verifiedProfiles = await countOrZero("profiles", (q) =>
    q.eq("verified", true).not("username", "is", null)
  );
  const tags = await countOrZero(TAGS_TABLE);

  const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
  const tagPages = Math.ceil(tags / CHUNK_SIZE);
  const totalPages = profilePages + tagPages;

  // 0 = static
  if (n === 0) {
    const urls = [
      { loc: abs("/"), lastmod: nowIso },
      { loc: abs("/explore"), lastmod: nowIso },
      { loc: abs("/explore/gifs"), lastmod: nowIso },
      { loc: abs("/explore/images"), lastmod: nowIso },
      { loc: abs("/explore/niches"), lastmod: nowIso },
      { loc: abs("/verify"), lastmod: nowIso },
      { loc: abs("/ads"), lastmod: nowIso },
      { loc: abs("/auth/login"), lastmod: nowIso },
      { loc: abs("/auth/signup"), lastmod: nowIso },
      { loc: abs("/saved"), lastmod: nowIso },
      { loc: abs("/settings"), lastmod: nowIso },
    ];

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
        )
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  if (n < 1 || n > totalPages) return new Response("", { status: 404 });

  // profiles: 1..profilePages, then tags
  const profileStart = 1;
  const profileEndExclusive = profileStart + profilePages;
  const tagStart = profileEndExclusive;

  // profiles chunk
  if (n >= profileStart && n < profileEndExclusive) {
    const chunkIndex = n - profileStart;
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    const res = await supabase
      .from("profiles")
      .select("username, updated_at")
      .eq("verified", true)
      .not("username", "is", null)
      .order("username", { ascending: true })
      .range(from, to);

    const rows = (res.data ?? []) as Array<{ username: string; updated_at?: string | null }>;
    const urls = rows
      .map((r) => {
        const u = String(r.username || "").trim();
        if (!u) return null;
        return {
          loc: abs(`/${encodeURIComponent(u)}`),
          lastmod: safeDate(r.updated_at) ?? nowIso,
        };
      })
      .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
        )
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // tags chunk
  if (n >= tagStart && n < tagStart + tagPages) {
    const chunkIndex = n - tagStart;
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    const res = await supabase
      .from(TAGS_TABLE)
      .select(`${TAGS_SLUG_COL}, ${TAGS_UPDATED_COL}`)
      .order(TAGS_SLUG_COL, { ascending: true })
      .range(from, to);

    const rows = (res.data ?? []) as Array<Record<string, any>>;
    const urls = rows
      .map((r) => {
        const slug = String(r[TAGS_SLUG_COL] || "").trim();
        if (!slug) return null;
        return {
          loc: abs(`/explore/niches/${encodeURIComponent(slug)}`),
          lastmod: safeDate(r[TAGS_UPDATED_COL]) ?? nowIso,
        };
      })
      .filter(Boolean) as Array<{ loc: string; lastmod: string }>;

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`
        )
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  return new Response("", { status: 404 });
}
