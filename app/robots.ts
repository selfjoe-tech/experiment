// app/robots.ts
import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BASE =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

export const runtime = "nodejs";
export const revalidate = 60 * 60;

const CHUNK_SIZE = 45_000;
const NICHE_TABLE = "tags";
const NICHE_SLUG_COL = "slug";

async function countVerifiedCreators() {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .eq("verified", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countNichesSafe() {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(NICHE_TABLE)
    .select(NICHE_SLUG_COL, { head: true, count: "exact" });

  if (error) return 0;
  return count ?? 0;
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [creatorCount, nicheCount] = await Promise.all([
    countVerifiedCreators(),
    countNichesSafe(),
  ]);

  const dynamicTotal = creatorCount + nicheCount;
  const dynamicPages = dynamicTotal > 0 ? Math.ceil(dynamicTotal / CHUNK_SIZE) : 0;

  const sitemapUrls = [
    `${BASE}/sitemap/0.xml`,
    ...Array.from({ length: dynamicPages }, (_, i) => `${BASE}/sitemap/${i + 1}.xml`),
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/_next"] },
    ],
    sitemap: sitemapUrls,
    host: BASE,
  };
}
