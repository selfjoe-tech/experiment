"use server";

import { supabase } from "@/lib/supabaseClient";

/** Public discovery uses Supabase's publishable key and existing row-level security. */
export type CreatorSearchResult = {
  id: string;
  username: string;
  avatarUrl: string | null;
  followerCount: number;
  verified: boolean;
};
export type TagSearchResult = {
  id: string | number;
  label: string;
  slug: string;
  postCount: number;
};
export type MediaSearchResult = {
  id: string | number;
  src: string;
  mediaType: "image" | "video";
  title: string;
  description: string;
  username: string;
  avatarUrl: string | null;
  views: number;
  tags: string[];
  ownerId: string | null;
};
export type GlobalSearchResult = {
  creators: CreatorSearchResult[];
  tags: TagSearchResult[];
  images: MediaSearchResult[];
  videos: MediaSearchResult[];
};

const EMPTY: GlobalSearchResult = { creators: [], tags: [], images: [], videos: [] };
type MediaRow = {
  id: number;
  owner_id: string | null;
  media_type: string;
  storage_path: string | null;
  title: string | null;
  description: string | null;
  view_count: number | null;
  tags: string[] | null;
  created_at?: string | null;
};
type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  follower_count: number | null;
  verified: boolean | null;
};
type TagRow = {
  id: number;
  label: string;
  slug: string;
  created_at?: string;
  post_count?: number;
};

/** Disallow PostgREST expression punctuation in user text. */
function normalizeQuery(input: string): string {
  return input.replace(/[#@]/g, "").replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ").trim().slice(0, 80);
}
function publicMediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl || null;
}
function creator(row: ProfileRow): CreatorSearchResult {
  return {
    id: String(row.id),
    username: row.username,
    avatarUrl: row.avatar_url || null,
    followerCount: row.follower_count ?? 0,
    verified: Boolean(row.verified),
  };
}
function media(row: MediaRow, owners: Map<string, ProfileRow>): MediaSearchResult | null {
  const src = publicMediaUrl(row.storage_path);
  if (!src) return null;
  const owner = row.owner_id ? owners.get(row.owner_id) : undefined;
  return {
    id: row.id,
    src,
    mediaType: row.media_type as "image" | "video",
    title: row.title || "",
    description: row.description || "",
    username: owner?.username ?? "unknown",
    avatarUrl: owner?.avatar_url ?? null,
    views: row.view_count ?? 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    ownerId: row.owner_id ?? null,
  };
}
function logQueryError(label: string, error: { message: string } | null | undefined) {
  if (error) console.warn(`[Search] ${label}:`, error.message);
}

/**
 * Ranked cross-category discovery:
 * - title and description matches
 * - exact tag matches (label / slug / normalized input)
 * - uploads from matching creators
 * - creators and niches connected to matching uploads
 *
 * Every query is bounded, and all rows remain subject to existing RLS.
 */
export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const q = normalizeQuery(query);
  if (q.length < 2) return EMPTY;
  const pattern = `%${q}%`;
  const [creatorsResult, tagsResult, textResult] = await Promise.all([
    supabase.from("profiles")
      .select("id, username, avatar_url, follower_count, verified")
      .ilike("username", pattern).order("follower_count", { ascending: false }).limit(10),
    supabase.from("tags").select("id, label, slug")
      .or(`label.ilike.${pattern},slug.ilike.${pattern}`).limit(12),
    supabase.from("media")
      .select("id, owner_id, media_type, storage_path, title, description, view_count, tags")
      .in("media_type", ["video", "image"])
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order("view_count", { ascending: false }).limit(30),
  ]);
  logQueryError("profiles", creatorsResult.error);
  logQueryError("niches", tagsResult.error);
  logQueryError("descriptions", textResult.error);

  const matchingCreators = (creatorsResult.data ?? []) as ProfileRow[];
  const matchingTags = (tagsResult.data ?? []) as TagRow[];
  const normalizedTag = q.toLowerCase().replace(/\s+/g, "-");
  const alternatives = new Set<string>([
    q, q.toLowerCase(), normalizedTag, q.replace(/\b\w/g, c => c.toUpperCase()),
  ]);
  for (const t of matchingTags.slice(0, 8)) {
    alternatives.add(t.label);
    alternatives.add(t.slug);
    alternatives.add(t.label.toLowerCase());
    alternatives.add(t.slug.replace(/-/g, " "));
  }
  const tagCandidates = Array.from(alternatives).filter(Boolean).slice(0, 28);
  const ownerIds = matchingCreators.map(row => row.id).slice(0, 6);

  const [taggedResult, ownerMediaResult] = await Promise.all([
    supabase.from("media")
      .select("id, owner_id, media_type, storage_path, title, description, view_count, tags")
      .in("media_type", ["video", "image"])
      .overlaps("tags", tagCandidates)
      .order("view_count", { ascending: false }).limit(30),
    ownerIds.length ? supabase.from("media")
      .select("id, owner_id, media_type, storage_path, title, description, view_count, tags")
      .in("media_type", ["video", "image"]).in("owner_id", ownerIds)
      .order("view_count", { ascending: false }).limit(20) : Promise.resolve({ data: [] as MediaRow[], error: null }),
  ]);
  logQueryError("tagged uploads", taggedResult.error);
  logQueryError("creator uploads", ownerMediaResult.error);

  const ranked = new Map<number, { row: MediaRow; score: number }>();
  const put = (rows: MediaRow[], bonus: number) => {
    for (const row of rows) {
      if (row.media_type !== "video" && row.media_type !== "image") continue;
      const text = `${row.title || ""} ${row.description || ""}`.toLowerCase();
      const tags = (row.tags || []).map(t => t.replace(/^#/, "").toLowerCase());
      let score = bonus;
      if ((row.title || "").toLowerCase().includes(q.toLowerCase())) score += 32;
      if (text.includes(q.toLowerCase())) score += 18;
      if (tags.some(tag => tag === normalizedTag || tag === q.toLowerCase())) score += 45;
      if (tags.some(tag => tag.includes(q.toLowerCase()))) score += 20;
      if (row.owner_id && ownerIds.includes(row.owner_id)) score += 10;
      score += Math.log10(1 + Math.max(0, row.view_count ?? 0)) * 2;
      if (!ranked.has(row.id) || ranked.get(row.id)!.score < score) ranked.set(row.id, { row, score });
    }
  };
  put((textResult.data ?? []) as MediaRow[], 14);
  put((taggedResult.data ?? []) as MediaRow[], 24);
  put((ownerMediaResult.data ?? []) as MediaRow[], 8);

  const selected = [...ranked.values()].sort((a,b) => b.score - a.score).slice(0, 36);
  const foundOwners = [...new Set(selected.map(({ row }) => row.owner_id).filter((v): v is string => Boolean(v)))];
  const [ownersResult, nicheStatsResult] = await Promise.all([
    foundOwners.length ? supabase.from("profiles")
      .select("id, username, avatar_url, follower_count, verified")
      .in("id", foundOwners.slice(0, 36)) : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    supabase.rpc("get_niche_cards_page", { p_limit: 48, p_offset: 0, p_sort: "trending" }),
  ]);
  logQueryError("upload owners", ownersResult.error);
  const ownerRows = (ownersResult.data ?? []) as ProfileRow[];
  const ownerMap = new Map(ownerRows.map(row => [row.id, row]));
  const resultCreators = new Map<string, CreatorSearchResult>();
  for (const row of [...matchingCreators, ...ownerRows]) {
    if (!resultCreators.has(row.id)) resultCreators.set(row.id, creator(row));
  }

  const stats = new Map<string, number>(
    ((nicheStatsResult.data ?? []) as Array<{ slug: string; post_count: number }>)
      .map(t => [t.slug.toLowerCase(), Number(t.post_count ?? 0)])
  );
  const relatedTagSlugs = new Set<string>();
  for (const { row } of selected.slice(0, 14)) {
    for (const t of row.tags || []) {
      const slug = t.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-");
      if (slug) relatedTagSlugs.add(slug);
    }
  }
  const [relatedTagsResult] = await Promise.all([
    relatedTagSlugs.size ? supabase.from("tags").select("id, label, slug")
      .in("slug", Array.from(relatedTagSlugs).slice(0, 30)) : Promise.resolve({ data: [] as TagRow[], error: null }),
  ]);
  const tagMap = new Map<string, TagSearchResult>();
  for (const row of [...matchingTags, ...((relatedTagsResult.data ?? []) as TagRow[])]) {
    const slug = row.slug.toLowerCase();
    if (!tagMap.has(slug)) tagMap.set(slug, {
      id: row.id, label: row.label, slug: row.slug, postCount: stats.get(slug) ?? 0,
    });
  }
  const termLower = q.toLowerCase();
  const tags = Array.from(tagMap.values()).sort((a,b) => {
    const am = a.label.toLowerCase().includes(termLower) || a.slug.includes(normalizedTag);
    const bm = b.label.toLowerCase().includes(termLower) || b.slug.includes(normalizedTag);
    return Number(bm) - Number(am) || b.postCount - a.postCount;
  }).slice(0, 12);
  const mediaResults = selected
    .map(({ row }) => media(row, ownerMap))
    .filter((m): m is MediaSearchResult => m !== null);
  return {
    creators: Array.from(resultCreators.values()).slice(0, 10),
    tags,
    videos: mediaResults.filter(m => m.mediaType === "video").slice(0, 12),
    images: mediaResults.filter(m => m.mediaType === "image").slice(0, 12),
  };
}

export async function getSearchSuggestions(): Promise<GlobalSearchResult> {
  const [profiles, niches, videos, images] = await Promise.all([
    supabase.from("profiles")
      .select("id, username, avatar_url, follower_count, verified")
      .order("follower_count", { ascending: false }).limit(5),
    supabase.rpc("get_niche_cards_page", { p_limit: 8, p_offset: 0, p_sort: "trending" }),
    supabase.from("media")
      .select("id, owner_id, media_type, storage_path, title, description, view_count, tags")
      .eq("media_type", "video").order("view_count", { ascending: false }).limit(9),
    supabase.from("media")
      .select("id, owner_id, media_type, storage_path, title, description, view_count, tags")
      .eq("media_type", "image").order("view_count", { ascending: false }).limit(6),
  ]);
  logQueryError("suggested creators", profiles.error);
  logQueryError("suggested niches", niches.error);
  logQueryError("suggested videos", videos.error);
  logQueryError("suggested images", images.error);
  const rows = [...((videos.data ?? []) as MediaRow[]), ...((images.data ?? []) as MediaRow[])];
  const ids = [...new Set(rows.map(r => r.owner_id).filter((v): v is string => Boolean(v)))];
  const ownersResult = ids.length
    ? await supabase.from("profiles").select("id, username, avatar_url, follower_count, verified").in("id", ids)
    : { data: [] as ProfileRow[], error: null };
  const ownerMap = new Map(((ownersResult.data ?? []) as ProfileRow[]).map(row => [row.id, row]));
  return {
    creators: ((profiles.data ?? []) as ProfileRow[]).map(creator),
    tags: ((niches.data ?? []) as Array<{ tag_id: number; label: string; slug: string; post_count: number }>).map(t => ({
      id: t.tag_id, label: t.label, slug: t.slug, postCount: Number(t.post_count ?? 0),
    })),
    videos: ((videos.data ?? []) as MediaRow[]).map(row => media(row, ownerMap)).filter((m): m is MediaSearchResult => m !== null),
    images: ((images.data ?? []) as MediaRow[]).map(row => media(row, ownerMap)).filter((m): m is MediaSearchResult => m !== null),
  };
}
