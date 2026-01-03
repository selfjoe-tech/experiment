// app/sitemap.ts
import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Revalidate so sitemaps update as new verified creators / niches are added.
// Tune as you like (e.g. 3600 = hourly).
export const revalidate = 3600;

const BASE =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

// Keep comfortably under 50,000 URLs per sitemap.
const CHUNK_SIZE = 45_000;

// If your niches live somewhere else, change this:
const NICHES_TABLE = "tags";
const NICHES_SLUG_COL = "slug";
const NICHES_UPDATED_COL = "updated_at";

// ---------- helpers ----------
function abs(path: string) {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function safeDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function countOrZero(table: string, filter?: (q: any) => any): Promise<number> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select("id", { head: true, count: "exact" });
  if (filter) q = filter(q);
  const res = await q;
  if (res.error) return 0;
  return res.count ?? 0;
}

let _countsPromise:
  | Promise<{
      verifiedProfiles: number;
      niches: number;
      profilePages: number;
      nichePages: number;
      totalPages: number; // NOT including id=0
    }>
  | null = null;

async function getCounts() {
  if (_countsPromise) return _countsPromise;

  _countsPromise = (async () => {
    // Verified profiles count
    const verifiedProfiles = await countOrZero("profiles", (q) =>
      q.eq("verified", true).not("username", "is", null)
    );

    // Niches count (fail-safe to 0 if table doesn't exist)
    const niches = await countOrZero(NICHES_TABLE);

    const profilePages = Math.ceil(verifiedProfiles / CHUNK_SIZE);
    const nichePages = Math.ceil(niches / CHUNK_SIZE);
    const totalPages = profilePages + nichePages;

    return { verifiedProfiles, niches, profilePages, nichePages, totalPages };
  })();

  return _countsPromise;
}

// ---------- multi-sitemap entrypoint ----------
export async function generateSitemaps() {
  const { totalPages } = await getCounts();

  // id=0 is the static sitemap. ids 1..N are data-driven.
  const ids = [{ id: 0 }];

  for (let i = 1; i <= totalPages; i++) {
    ids.push({ id: i });
  }

  return ids;
}

// Next will call this for each /sitemap/[id].xml
export default async function sitemap({
  id,
}: {
  id: string | number | Promise<string | number>;
}): Promise<MetadataRoute.Sitemap> {
  const resolved = await id;
  const n = typeof resolved === "number" ? resolved : Number.parseInt(String(resolved), 10);
  const now = new Date();

  // ---------- /sitemap/0.xml (static) ----------
  if (!Number.isFinite(n) || n === 0) {
    const routes: MetadataRoute.Sitemap = [
      { url: abs("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },

      { url: abs("/explore"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: abs("/explore/gifs"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: abs("/explore/images"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: abs("/explore/niches"), lastModified: now, changeFrequency: "daily", priority: 0.9 },

      { url: abs("/verify"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
      { url: abs("/ads"), lastModified: now, changeFrequency: "daily", priority: 0.8 },

      // You explicitly asked these to be indexed, so they’re included:
      { url: abs("/auth/login"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },
      { url: abs("/auth/signup"), lastModified: now, changeFrequency: "weekly", priority: 0.4 },

      // Keep/adjust based on whether these are public pages:
      { url: abs("/saved"), lastModified: now, changeFrequency: "daily", priority: 0.6 },
      { url: abs("/settings"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ];

    return routes;
  }

  // ---------- /sitemap/1.xml+ (dynamic chunks) ----------
  const { profilePages, nichePages, totalPages } = await getCounts();

  if (n < 1 || n > totalPages) return [];

  const supabase = getSupabaseAdmin();

  // ids 1..profilePages are profiles
  const profileStartId = 1;
  const profileEndIdExclusive = profileStartId + profilePages;
  const nicheStartId = profileEndIdExclusive;

  // ----- profiles chunk -----
  if (n >= profileStartId && n < profileEndIdExclusive) {
    const chunkIndex = n - profileStartId; // 0-based
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    const res = await supabase
      .from("profiles")
      .select("username, updated_at")
      .eq("verified", true)
      .not("username", "is", null)
      .order("username", { ascending: true })
      .range(from, to);

    if (res.error) return [];

    const rows = (res.data ?? []) as Array<{ username: string; updated_at?: string | null }>;

    return rows
      .map((r) => {
        const uname = String(r.username || "").trim();
        if (!uname) return null;

        return {
          url: abs(`/${encodeURIComponent(uname)}`),
          lastModified: safeDate(r.updated_at) ?? now,
          changeFrequency: "daily",
          priority: 0.7,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;
  }

  // ----- niches chunk -----
  if (n >= nicheStartId && n < nicheStartId + nichePages) {
    const chunkIndex = n - nicheStartId; // 0-based
    const from = chunkIndex * CHUNK_SIZE;
    const to = from + CHUNK_SIZE - 1;

    // Fail-safe: if the niches table/columns aren’t there, just return empty for that sitemap.
    try {
      const res = await supabase
        .from(NICHES_TABLE)
        .select(`${NICHES_SLUG_COL}, ${NICHES_UPDATED_COL}`)
        .order(NICHES_SLUG_COL, { ascending: true })
        .range(from, to);

      if (res.error) return [];

      const rows = (res.data ?? []) as Array<Record<string, any>>;

      return rows
        .map((r) => {
          const slug = String(r[NICHES_SLUG_COL] || "").trim();
          if (!slug) return null;

          return {
            url: abs(`/explore/niches/${encodeURIComponent(slug)}`),
            lastModified: safeDate(r[NICHES_UPDATED_COL]) ?? now,
            changeFrequency: "weekly",
            priority: 0.6,
          };
        })
        .filter(Boolean) as MetadataRoute.Sitemap;
    } catch {
      return [];
    }
  }

  return [];
}
