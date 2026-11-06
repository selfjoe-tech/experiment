"use client";

import { createClient } from "@/lib/supabase/client";
import { getUserPreferencesFromCookies } from "@/lib/actions/auth";
import { normalizePreferences } from "@/lib/actions/mediaFeed";

const supabase = createClient();

export type HomeFeedMode = "forYou" | "following";

export type HomePost = {
  id: number;
  type: "video" | "image";
  src: string;
  title: string;
  description: string;
  username: string;
  avatar: string;
  ownerId: string | null;
  verified: boolean;
  likes: number;
  views: number;
  likedByMe: boolean;
  createdAt: string;
  /** Original uploaded video duration, not the 30-second Home feed preview. */
  durationSeconds: number | null;
  hashtags: string[];
  width: number | null;
  height: number | null;
};

export type SuggestedCreator = {
  id: string;
  username: string;
  avatar: string;
  verified: boolean;
  followerCount: number;
};

async function viewerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function publicMediaUrl(path: string): string {
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function fetchHomeFeedBatch(options: {
  mode: HomeFeedMode;
  page: number;
  limit?: number;
}): Promise<HomePost[]> {
  const { mode, page, limit = 8 } = options;
  const userId = await viewerId();

  if (mode === "following" && !userId) return [];

  let query = supabase
    .from("media")
    .select(`
      id, media_type, storage_path, title, description, created_at,
      width, height, duration_seconds, like_count, view_count, tags, audience,
      owner:profiles!media_owner_id_fkey (
        id, username, avatar_url, verified
      )
    `)
    .in("media_type", ["image", "video"])
    .not("storage_path", "is", null);

  if (mode === "following") {
    const { data: follows, error: followError } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId!);
    if (followError) throw new Error(followError.message);

    const ids = (follows ?? []).map((item) => item.followee_id as string);
    if (!ids.length) return [];
    query = query.in("owner_id", ids);
  } else {
    // Reuse the same audience preferences as the original reels feed.
    let preferences: string[] = [];
    if (userId) {
      try {
        preferences = normalizePreferences(
          await getUserPreferencesFromCookies()
        );
      } catch {
        preferences = [];
      }
    }

    if (!preferences.length) preferences = ["straight"];
    query = preferences.length === 1
      ? query.eq("audience", preferences[0])
      : query.in("audience", preferences);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    media_type: string;
    storage_path: string;
    title: string | null;
    description: string | null;
    created_at: string;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
    like_count: number | null;
    view_count: number | null;
    tags: string[] | null;
    owner: {
      id: string;
      username: string | null;
      avatar_url: string | null;
      verified: boolean | null;
    } | null;
  }>;

  let likedIds = new Set<number>();
  if (userId && rows.length) {
    const { data: likes, error: likesError } = await supabase
      .from("media_likes")
      .select("media_id")
      .eq("user_id", userId)
      .in("media_id", rows.map((row) => row.id));
    if (likesError) console.warn("Could not load like state:", likesError.message);
    else likedIds = new Set((likes ?? []).map((item) => Number(item.media_id)));
  }

  return rows
    .filter((row) => row.storage_path && (row.media_type === "image" || row.media_type === "video"))
    .map((row) => ({
      id: Number(row.id),
      type: row.media_type as "video" | "image",
      src: publicMediaUrl(row.storage_path),
      title: row.title ?? "",
      description: row.description ?? "",
      username: row.owner?.username ?? "unknown",
      avatar: row.owner?.avatar_url || "/avatar-placeholder.png",
      ownerId: row.owner?.id ?? null,
      verified: Boolean(row.owner?.verified),
      likes: Number(row.like_count ?? 0),
      views: Number(row.view_count ?? 0),
      likedByMe: likedIds.has(Number(row.id)),
      createdAt: row.created_at,
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      hashtags: row.tags ?? [],
      width: row.width,
      height: row.height,
    }));
}

export async function fetchSuggestedCreators(): Promise<SuggestedCreator[]> {
  const userId = await viewerId();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, verified, follower_count")
    .not("username", "is", null)
    .order("follower_count", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  const followed = new Set<string>();
  if (userId) {
    const { data: follows } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId);
    (follows ?? []).forEach((row) => followed.add(row.followee_id));
  }

  return (data ?? [])
    .filter((p) => p.id !== userId && !followed.has(p.id) && Boolean(p.username))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      username: p.username!,
      avatar: p.avatar_url || "/avatar-placeholder.png",
      verified: Boolean(p.verified),
      followerCount: Number(p.follower_count ?? 0),
    }));
}


export async function fetchHomePostById(id: number): Promise<HomePost | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const userId = await viewerId();
  const { data: row, error } = await supabase
    .from("media")
    .select(`
      id, media_type, storage_path, title, description, created_at,
      width, height, duration_seconds, like_count, view_count, tags,
      owner:profiles!media_owner_id_fkey (
        id, username, avatar_url, verified
      )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !row.storage_path || (row.media_type !== "image" && row.media_type !== "video")) return null;

  let likedByMe = false;
  if (userId) {
    const { data } = await supabase.from("media_likes").select("media_id")
      .eq("media_id", id).eq("user_id", userId).maybeSingle();
    likedByMe = Boolean(data);
  }
  const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  return {
    id: Number(row.id),
    type: row.media_type as "video" | "image",
    src: publicMediaUrl(row.storage_path),
    title: row.title ?? "",
    description: row.description ?? "",
    username: owner?.username ?? "unknown",
    avatar: owner?.avatar_url ?? "/avatar-placeholder.png",
    ownerId: owner?.id ?? null,
    verified: Boolean(owner?.verified),
    likes: Number(row.like_count ?? 0),
    views: Number(row.view_count ?? 0),
    likedByMe,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    hashtags: row.tags ?? [],
    width: row.width,
    height: row.height,
  };
}
