// lib/actions/mediaFeed.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type { Video } from "@/app/components/feed/types";
import { getUserIdFromCookies, getUserPreferencesFromCookies } from "./auth";

const MEDIA_BUCKET = "media";

const ALLOWED_PREFERENCES = [
  "straight",
  "gay",
  "bisexual",
  "trans",
  "lesbian",
  "animated",
] as const;

type Preference = (typeof ALLOWED_PREFERENCES)[number];


export async function fetchRandomAdForFeed(): Promise<Video | null> {
  const nowIso = new Date().toISOString();

  // 1) Find all *active* ad buyers
  const { data: buyers, error: buyersError } = await supabase
    .from("ad_buyers")
    .select("user_id")
    .gt("expires_at", nowIso);

  if (buyersError) {
    console.error("fetchRandomAdForFeed ad_buyers error", buyersError);
    return null;
  }

  const activeUserIds = Array.from(
    new Set((buyers ?? []).map((b) => b.user_id).filter(Boolean))
  );

  if (activeUserIds.length === 0) {
    // no active buyers → no ads
    return null;
  }

  // 2) Fetch video ads owned by those active buyers
  const { data, error } = await supabase
    .from("ads")
    .select(
      `
      id,
      storage_path,
      landing_url,
      owner_id,
      like_count,
      view_count,
      owner:profiles!ads_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("media_type", "video")
    .in("owner_id", activeUserIds)
    .limit(50);

  if (error) {
    console.error("fetchRandomAdForFeed ads error", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const rows = data as any[];

  // shuffle a bit and pick one
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const picked = rows[0];
  if (!picked) return null;

  const src = picked.storage_path ? buildPublicUrl(picked.storage_path) : "";
  if (!src) return null;

  const adVideo: Video = {
    id: picked.id,
    mediaId: picked.id, // this is ads.id, not media.id
    src,
    title: "",
    description: "",
    username: picked.owner?.username ?? "Sponsored",
    avatar: picked.owner?.avatar_url ?? "/avatar-placeholder.png",
    likes: picked.like_count ?? 0,
    views: picked.view_count ?? 0,
    hashtags: [],
    verified: picked.owner?.verified ?? false,

    _isAd: true,
    _adLandingUrl: picked.landing_url ?? null,
    _adId: picked.id,
  };

  return adVideo;
}

export function normalizePreferences(raw: string[] | null | undefined): Preference[] {
  if (!raw || !raw.length) return [];

  const lower = raw
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);

  const dedup = Array.from(new Set(lower));

  return ALLOWED_PREFERENCES.filter((pref) => dedup.includes(pref));
}


async function getEffectivePreferences(): Promise<Preference[]> {
  try {
    const cookiePrefs = await getUserPreferencesFromCookies();
    const normalized = normalizePreferences(cookiePrefs ?? []);
    if (normalized.length) return normalized;
  } catch (err) {
    console.error("getEffectivePreferences error", err);
  }
  return ["straight"];
}



export function buildPublicUrl(path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Fetch a batch of "trending" videos.
 * For now: newest first, filtered by media_type=video,
 * and excluding any IDs we've already shown this session.
 */
export async function fetchTrendingVideosBatch(opts: {
  limit: number;
  excludeIds?: number[]; // db IDs from media.id
}): Promise<Video[]> {
  const { limit, excludeIds = [] } = opts;

  const preferences = await getEffectivePreferences();

  // Bigger pool helps mixing work well
  const OVERFETCH_MULTIPLIER = 10;
  const overfetchLimit = Math.max(limit * OVERFETCH_MULTIPLIER, limit);

  let query = supabase
    .from("media")
    .select(
      `
      id,
      storage_path,
      title,
      description,
      like_count,
      view_count,
      created_at,
      tags,
      audience,
      owner:profiles!media_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("media_type", "video");

  // apply audience preferences
  if (preferences.length === 1) {
    query = query.eq("audience", preferences[0]);
  } else {
    query = query.in("audience", preferences);
  }

  // Avoid repeating media we've already shown this session
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  // Make sure high-view stuff is actually in the pool
  query = query
    .order("view_count", { ascending: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query.limit(overfetchLimit);

  if (error) {
    console.error("fetchTrendingVideosBatch error", error);
    throw new Error(error.message || "Failed to fetch videos");
  }

  if (!data || data.length === 0) return [];

  const rows = data as any[];

  // --- helpers ---
  const shuffleInPlace = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const pickFromTopWindow = <T,>(ranked: T[], count: number, windowSize: number) => {
    if (count <= 0 || ranked.length === 0) return { picked: [] as T[], remaining: ranked };
    const w = Math.max(1, Math.min(windowSize, ranked.length));
    const window = ranked.slice(0, w);
    const rest = ranked.slice(w);

    shuffleInPlace(window);
    const picked = window.slice(0, Math.min(count, window.length));
    const leftoverWindow = window.slice(picked.length);

    return { picked, remaining: [...leftoverWindow, ...rest] };
  };

  // --- buckets ---
  // random bucket: views==0 OR likes==0 (you requested ratio not applied + random)
  const randomBucket: any[] = [];

  // ratio eligible: views>0 AND likes>0 (ratio applies)
  const ratioRanked: { row: any; score: number }[] = [];

  for (const row of rows) {
    const views = Number(row.view_count ?? 0);
    const likes = Number(row.like_count ?? 0);

    if (views <= 0 || likes <= 0) {
      randomBucket.push(row);
      continue;
    }

    const ratio = views / likes; // view_count : like_count
    const score = Math.abs(ratio - 1); // closer to 1 is better
    ratioRanked.push({ row, score });
  }

  // Ratio ranking: closest to 1 first
  ratioRanked.sort((a, b) => a.score - b.score);

  // High-views ranking: ONLY from ratio-eligible rows (likes>0 && views>0)
  // so we don't violate your rule that likes==0 should be random.
  const highViewsRanked = [...ratioRanked]
    .sort((a, b) => Number(b.row.view_count ?? 0) - Number(a.row.view_count ?? 0))
    .map((x) => x.row);

  const ratioRows = ratioRanked.map((x) => x.row);

  // --- mix policy (tweak these) ---
  const RATIO_SHARE = 0.6;
  const HIGHVIEWS_SHARE = 0.3;
  const RANDOM_SHARE = 0.1;

  let ratioCount = Math.round(limit * RATIO_SHARE);
  let highCount = Math.round(limit * HIGHVIEWS_SHARE);
  let randCount = Math.max(0, limit - ratioCount - highCount);

  // ensure totals add up
  const total = ratioCount + highCount + randCount;
  if (total !== limit) ratioCount += limit - total;

  // We only want ONE of each row
  const picked: any[] = [];
  const pickedIds = new Set<number>();

  const pushUnique = (r: any) => {
    const id = Number(r?.id);
    if (!Number.isFinite(id)) return false;
    if (pickedIds.has(id)) return false;
    pickedIds.add(id);
    picked.push(r);
    return true;
  };

  // Pick from ranked pools with randomness inside a "top window"
  // Windows control how “stable” vs “random” it feels.
  const ratioWindow = Math.min(ratioRows.length, Math.max(limit * 6, 40));
  const highWindow = Math.min(highViewsRanked.length, Math.max(limit * 6, 40));

  // 1) Ratio-first picks (random within the best window)
  let ratioRemaining = ratioRows;
  {
    const { picked: rPicked, remaining } = pickFromTopWindow(ratioRemaining, ratioCount, ratioWindow);
    ratioRemaining = remaining;
    for (const r of rPicked) pushUnique(r);
  }

  // 2) Inject high-view picks (random within top high-view window)
  let highRemaining = highViewsRanked;
  {
    const { picked: hPicked, remaining } = pickFromTopWindow(highRemaining, highCount, highWindow);
    highRemaining = remaining;
    for (const r of hPicked) pushUnique(r);
  }

  // 3) Random bucket picks (shuffle then take)
  shuffleInPlace(randomBucket);
  for (const r of randomBucket) {
    if (picked.length >= limit) break;
    pushUnique(r);
  }

  // 4) Fill if we still don't have enough (fallback order: ratio -> high -> random)
  if (picked.length < limit) {
    // remaining ratio
    shuffleInPlace(ratioRemaining); // extra randomness once quota is satisfied
    for (const r of ratioRemaining) {
      if (picked.length >= limit) break;
      pushUnique(r);
    }
  }
  if (picked.length < limit) {
    shuffleInPlace(highRemaining);
    for (const r of highRemaining) {
      if (picked.length >= limit) break;
      pushUnique(r);
    }
  }
  if (picked.length < limit) {
    // if somehow still short (rare), just take from original rows
    const tail = rows.filter((r) => !pickedIds.has(Number(r.id)));
    shuffleInPlace(tail);
    for (const r of tail) {
      if (picked.length >= limit) break;
      pushUnique(r);
    }
  }

  // Map to your existing Video shape (unchanged)
  return picked.slice(0, limit).map((row) => {
    const publicUrl = buildPublicUrl(row.storage_path);
    const tags: string[] = row.tags ?? [];

    return {
      id: String(row.id),
      mediaId: row.id as number,
      src: publicUrl,
      title: row.title,
      description: row.description ?? "",
      username: row.owner?.username ?? "unknown",
      avatar: row.owner?.avatar_url ?? "/avatar-placeholder.png",
      likes: row.like_count ?? 0,
      views: row.view_count ?? 0,
      hashtags: tags,
      verified: row.owner?.verified,
      ownerId: row.owner.id,
    } satisfies Video;
  });
}



/**
 * Record a view for a video.
 * This just inserts into media_views; your trigger bumps media.view_count.
 */
export async function registerView(mediaId: number): Promise<void> {
  try {
    const { error } = await supabase.rpc("increment_media_view_count", {
      p_media_id: mediaId,
    });

    if (error) {
      console.error("registerView rpc error", error);
    }
  } catch (err) {
    console.error("registerView thrown error", err);
  }
}

/**
 * Toggle like for current user.
 * Inserts/deletes from media_likes; your trigger updates media.like_count.
 */
export async function toggleMediaLike(
  mediaId: number
): Promise<{ liked: boolean; likeCount: number | null }> {
  const userId = await getUserIdFromCookies();

  // Does a like already exist?
  const { data: existing, error: existingError } = await supabase
    .from("media_likes")
    .select("media_id")
    .eq("media_id", mediaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    // PGRST116 = no rows
    console.error("toggleMediaLike existingError", existingError);
    throw new Error(existingError.message);
  }

  let liked: boolean;

  if (existing) {
    // Unlike
    const { error: delError } = await supabase
      .from("media_likes")
      .delete()
      .eq("media_id", mediaId)
      .eq("user_id", userId);

    if (delError) {
      console.error("toggleMediaLike delete error", delError);
      throw new Error(delError.message);
    }
    liked = false;
  } else {
    // Like
    const { error: insError } = await supabase
      .from("media_likes")
      .insert({ media_id: mediaId, user_id: userId });

    if (insError) {
      console.error("toggleMediaLike insert error", insError);
      throw new Error(insError.message);
    }
    liked = true;
  }

  // Fetch the updated like_count
  const { data: mediaRow, error: mediaError } = await supabase
    .from("media")
    .select("like_count")
    .eq("id", mediaId)
    .single();

  if (mediaError) {
    console.error("toggleMediaLike mediaError", mediaError);
    return { liked, likeCount: null };
  }

  return {
    liked,
    likeCount: mediaRow.like_count as number,
  };
}

export async function fetchVideoForEmbed(
  mediaId: number
): Promise<Video | null> {
  const { data, error } = await supabase
    .from("media")
    .select(
      `
      id,
      storage_path,
      title,
      description,
      like_count,
      view_count,
      created_at,
      tags,
      owner:profiles!media_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("media_type", "video")
    .eq("id", mediaId)
    .single();

  if (error) {
    console.error("fetchVideoForEmbed error", error);
    return null;
  }
  if (!data) return null;

  const publicUrl = buildPublicUrl(data.storage_path);
  const tags: string[] = data.tags ?? [];

  return {
    id: String(data.id),
    mediaId: data.id as number,
    src: publicUrl,
    title: data.title,
    description: data.description ?? "",
    username: data.owner?.username ?? "unknown",
    avatar: data.owner?.avatar_url ?? "/avatar-placeholder.png",
    likes: data.like_count ?? 0,
    views: data.view_count ?? 0,
    hashtags: tags,
    verified: data.owner?.verified

  } satisfies Video;
}

export async function fetchVideoById(mediaId: number): Promise<Video | null> {
  const { data, error } = await supabase
    .from("media")
    .select(
      `
      id,
      storage_path,
      title,
      description,
      like_count,
      view_count,
      created_at,
      tags,
      owner:profiles!media_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("media_type", "video")
    .eq("id", mediaId)
    .single();

  if (error) {
    console.error("fetchVideoById error", error);
    return null;
  }
  if (!data) return null;

  const publicUrl = buildPublicUrl(data.storage_path);
  const tags: string[] = data.tags ?? [];

  return {
    id: String(data.id),
    mediaId: data.id as number,
    src: publicUrl,
    title: data.title,
    description: data.description ?? "",
    username: data.owner?.username ?? "unknown",
    avatar: data.owner?.avatar_url ?? "/avatar-placeholder.png",
    likes: data.like_count ?? 0,
    views: data.view_count ?? 0,
    verified: data.owner?.verified,
    hashtags: tags,
  } satisfies Video;
}

function slugToLabel(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function fetchVideosByTagBatch(opts: {
  slug: string; // e.g. "gaming-fever"
  limit: number;
  excludeIds?: number[];
}): Promise<Video[]> {
  const { slug, limit, excludeIds = [] } = opts;
  const label = slugToLabel(slug); // e.g. "Gaming Fever"

  let query = supabase
    .from("media")
    .select(
      `
      id,
      storage_path,
      title,
      description,
      like_count,
      view_count,
      created_at,
      tags,
      owner:profiles!media_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("media_type", "video")
    // media.tags is text[] of labels, e.g. ["Gaming Fever", "Fresh Stuff"]
    .contains("tags", [label]);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  // trending-ish: views first, then recency
  query = query
    .order("view_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("fetchVideosByTagBatch error", error);
    throw new Error(error.message || "Failed to fetch tagged videos");
  }

  if (!data || data.length === 0) return [];

  return (data as any[]).map((row) => {
    const publicUrl = buildPublicUrl(row.storage_path);
    const tags: string[] = row.tags ?? [];

    return {
      id: String(row.id),
      mediaId: row.id as number,
      src: publicUrl,
      title: row.title,
      description: row.description ?? "",
      username: row.owner?.username ?? "unknown",
      avatar: row.owner?.avatar_url ?? "/avatar-placeholder.png",
      likes: row.like_count ?? 0,
      views: row.view_count ?? 0,
      hashtags: tags,
      verified: row.owner?.verified,

    } satisfies Video;
  });
}

// Images

export type ImageMedia = {
  id: string;
  mediaId: number;
  src: string;
  title: string;
  description: string;
  username: string;
  avatar: string;
  likes: number;
  views: number;
  hashtags: string[];
  ownerId?: string;
  likedByMe?: boolean;
  verifed?: boolean;
};

export async function fetchImageById(
  mediaId: number
): Promise<ImageMedia | null> {
  if (!mediaId || Number.isNaN(mediaId)) return null;

  const { data, error } = await supabase
    .from("media")
    .select(
      `
      id,
      storage_path,
      title,
      description,
      like_count,
      view_count,
      created_at,
      tags,
      owner:profiles!media_owner_id_fkey (
        id,
        username,
        avatar_url,
        verified
      )
    `
    )
    .eq("id", mediaId)
    .eq("media_type", "image")
    .single();

  if (error) {
    console.error("fetchImageById error", error);
    return null;
  }

  if (!data) return null;

  const publicUrl = buildPublicUrl(data.storage_path);
  if (!publicUrl) return null;

  const tags: string[] = data.tags ?? [];

  const userId = await getUserIdFromCookies();

  let likedByMe: boolean | undefined = undefined;
  if (userId) {
    const { data: likeRow, error: likeError } = await supabase
      .from("media_likes")
      .select("id")
      .eq("media_id", mediaId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!likeError) {
      likedByMe = !!likeRow;
    }
  }

  return {
    id: String(data.id),
    mediaId: data.id as number,
    src: publicUrl,
    title: data.title ?? "",
    description: data.description ?? "",
    username: data.owner?.username ?? "unknown",
    avatar: data.owner?.avatar_url ?? "/avatar-placeholder.png",
    likes: data.like_count ?? 0,
    views: data.view_count ?? 0,
    hashtags: tags,
    ownerId: data.owner?.id ?? undefined,
    likedByMe,
    verified: data.owner?.verified,

  };
}

// Helper: map rows (used in For You feed)

function mapRowToVideo(row: any): Video {
  const src = row.storage_path ? buildPublicUrl(row.storage_path) : "";
  if (!src) {
    // You can choose to filter these out
    return null as any;
  }

  return {
    id: row.id,
    mediaId: row.id,
    src,
    type: "video",
    views: row.view_count ?? 0,
    likes: row.like_count ?? 0,
    description: row.description ?? "",
    hashtags: row.tags ?? [],
    ownerId: row.owner_id,
    username: row.owner?.username ?? "unknown",
    avatar: row.owner?.avatar_url ?? "/avatar-placeholder.png",
    likedByMe: row.likedByMe ?? false,
    verified: row.owner?.verified ?? false
  };
}

type ForYouParams = {
  limit: number;
  excludeIds?: number[];
};

export async function fetchForYouVideosBatch({
  limit,
  excludeIds = [],
}: ForYouParams): Promise<Video[]> {
  const userId = await getUserIdFromCookies();
  const preferences = await getEffectivePreferences();

  // If not logged in, just behave like trending (still filtered by preferences)
  if (!userId) {
    return fetchTrendingVideosBatch({ limit, excludeIds });
  }

  // 1) load rec tags
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("recs")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("fetchForYouVideosBatch profile error", profileError);
    return fetchTrendingVideosBatch({ limit, excludeIds });
  }

  const recs: string[] = (profile?.recs ?? []).filter(Boolean);

  // If they haven't liked anything yet → pure trending (still uses preferences)
  if (!recs.length) {
    return fetchTrendingVideosBatch({ limit, excludeIds });
  }

  // 2) get followees
  const { data: followRows, error: followError } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId);

  if (followError) {
    console.error("fetchForYouVideosBatch follows error", followError);
  }

  const followeeIds = (followRows ?? []).map((f) => f.followee_id);
  const recommendedRows: any[] = [];
  const excludeSet = new Set(excludeIds || []);

  // 3) by tags overlap
  {
    let tagQuery = supabase
      .from("media")
      .select(
        `
        id,
        owner_id,
        media_type,
        storage_path,
        view_count,
        like_count,
        created_at,
        description,
        tags,
        audience,
        owner:profiles!media_owner_id_fkey(
          id,
          username,
          avatar_url,
          verified
        )
      `
      )
      .eq("media_type", "video")
      .overlaps("tags", recs)
      .order("view_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    // apply audience filter
    if (preferences.length === 1) {
      tagQuery = tagQuery.eq("audience", preferences[0]);
    } else {
      tagQuery = tagQuery.in("audience", preferences);
    }

    const { data: tagRows, error: tagError } = await tagQuery;

    if (tagError) {
      console.error("fetchForYouVideosBatch tags media error", tagError);
    } else if (tagRows) {
      recommendedRows.push(...tagRows);
    }
  }

  // 4) by followees (creators they follow)
  if (followeeIds.length) {
    let followMediaQuery = supabase
      .from("media")
      .select(
        `
          id,
          owner_id,
          media_type,
          storage_path,
          view_count,
          like_count,
          created_at,
          description,
          tags,
          audience,
          owner:profiles!media_owner_id_fkey(
            id,
            username,
            avatar_url,
            verified
          )
        `
      )
      .eq("media_type", "video")
      .in("owner_id", followeeIds)
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    // apply audience filter here as well
    if (preferences.length === 1) {
      followMediaQuery = followMediaQuery.eq("audience", preferences[0]);
    } else {
      followMediaQuery = followMediaQuery.in("audience", preferences);
    }

    const { data: followMediaRows, error: followMediaError } = await followMediaQuery;

    if (followMediaError) {
      console.error(
        "fetchForYouVideosBatch follow media error",
        followMediaError
      );
    } else if (followMediaRows) {
      recommendedRows.push(...followMediaRows);
    }
  }

  // 5) merge, de-dup by id, drop already-excluded, sort
  const byId = new Map<number, any>();
  for (const row of recommendedRows) {
    if (!row || excludeSet.has(row.id)) continue;
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }

  const merged = Array.from(byId.values());

  if (!merged.length) {
    // nothing from tags/follows → fallback to trending (still uses preferences)
    return fetchTrendingVideosBatch({ limit, excludeIds });
  }

  merged.sort((a, b) => {
    const av = a.view_count ?? 0;
    const bv = b.view_count ?? 0;
    if (bv !== av) return bv - av;
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  });

  const sliced = merged.slice(0, limit);

  return sliced
    .map(mapRowToVideo)
    .filter((v) => v && v.src) as Video[];
}




// lib/actions/mediaFeed.ts
export async function registerAdView(adId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc("increment_ad_view_count", {
      p_ad_id: adId,
    });
    if (error) {
      console.error("registerAdView rpc error", error);
    }
  } catch (err) {
    console.error("registerAdView thrown error", err);
  }
}



