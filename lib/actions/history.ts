"use client";

import { createClient } from "@/lib/supabase/client";
import type { HomePost } from "@/lib/actions/homeFeed";

const supabase = createClient();

export type HistoryTab = "liked" | "bookmarked";
export type HistoryMediaType = "video" | "image";

type HistoryRow = {
  media: {
    id: number;
    media_type: string;
    storage_path: string | null;
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
  } | null;
};

function mediaUrl(storagePath: string): string {
  if (/^https:\/\//i.test(storagePath)) return storagePath;
  return supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Likes and bookmarks are independent relations.
 * Inner join + media-type filter happen BEFORE pagination, so changing the
 * video/image dropdown won't produce empty gaps when results are mixed.
 */
export async function fetchHistoryPostsBatch(options: {
  tab: HistoryTab;
  mediaType: HistoryMediaType;
  page: number;
  limit?: number;
}): Promise<HomePost[]> {
  const { tab, mediaType, page } = options;
  const limit = Math.min(24, Math.max(1, options.limit ?? 12));

  if (!Number.isInteger(page) || page < 0) return [];

  const { data: auth, error: authError } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (authError || !userId) throw new Error("Sign in to see your history.");

  const table = tab === "liked" ? "media_likes" : "media_bookmarks";
  const { data, error } = await supabase
    .from(table)
    .select(`
      created_at,
      media:media!inner (
        id, media_type, storage_path, title, description, created_at,
        width, height, duration_seconds, like_count, view_count, tags,
        owner:profiles!media_owner_id_fkey (
          id, username, avatar_url, verified
        )
      )
    `)
    .eq("user_id", userId)
    .eq("media.media_type", mediaType)
    .not("media.storage_path", "is", null)
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as HistoryRow[];
  const media = rows
    .map((row) => row.media)
    .filter((item): item is NonNullable<HistoryRow["media"]> =>
      Boolean(item?.storage_path && (item.media_type === "video" || item.media_type === "image"))
    );

  // Bookmarked posts may or may not be liked. Always show the correct heart.
  const ids = media.map((item) => Number(item.id));
  const likedIds = new Set<number>();
  if (ids.length) {
    const { data: likes, error: likesError } = await supabase
      .from("media_likes")
      .select("media_id")
      .eq("user_id", userId)
      .in("media_id", ids);
    if (likesError) console.warn("Unable to read history like state", likesError.message);
    else for (const item of likes ?? []) likedIds.add(Number(item.media_id));
  }

  return media.map((item): HomePost => ({
    id: Number(item.id),
    type: item.media_type as HistoryMediaType,
    src: mediaUrl(item.storage_path!),
    title: item.title || "",
    description: item.description || "",
    username: item.owner?.username || "creator",
    avatar: item.owner?.avatar_url || "/avatar-placeholder.png",
    ownerId: item.owner?.id || null,
    verified: Boolean(item.owner?.verified),
    likes: Number(item.like_count || 0),
    views: Number(item.view_count || 0),
    likedByMe: likedIds.has(Number(item.id)),
    createdAt: item.created_at,
    durationSeconds: item.duration_seconds == null ? null : Number(item.duration_seconds),
    hashtags: item.tags || [],
    width: item.width,
    height: item.height,
  }));
}
