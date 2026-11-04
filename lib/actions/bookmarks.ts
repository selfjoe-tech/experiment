"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to save posts.");
  return data.user.id;
}

export async function checkMediaBookmarked(mediaId: number): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: saved, error } = await supabase.from("media_bookmarks")
    .select("media_id")
    .eq("user_id", data.user.id)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(saved);
}

export async function toggleMediaBookmark(mediaId: number): Promise<boolean> {
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("Invalid post.");
  const userId = await requireUserId();
  const { data: existing, error: findError } = await supabase.from("media_bookmarks")
    .select("media_id")
    .eq("user_id", userId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  if (existing) {
    const { error } = await supabase.from("media_bookmarks")
      .delete().eq("user_id", userId).eq("media_id", mediaId);
    if (error) throw new Error(error.message);
    return false;
  }

  const { error } = await supabase.from("media_bookmarks")
    .insert({ user_id: userId, media_id: mediaId });
  if (error) throw new Error(error.message);
  return true;
}


export async function fetchBookmarkedPostsBatch(page: number, limit = 8) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("media_bookmarks")
    .select(`
      created_at,
      media:media (
        id, media_type, storage_path, title, description, created_at,
        width, height, like_count, view_count, tags,
        owner:profiles!media_owner_id_fkey (
          id, username, avatar_url, verified
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    media: {
      id: number; media_type: string; storage_path: string;
      title: string | null; description: string | null; created_at: string;
      width: number | null; height: number | null; like_count: number | null;
      view_count: number | null; tags: string[] | null;
      owner: { id: string; username: string; avatar_url: string | null; verified: boolean | null } | null;
    } | null;
  }>;
  const media = rows.map(row => row.media).filter((item): item is NonNullable<typeof item> => Boolean(item) && !!item!.storage_path);
  const ids = media.map(item => item.id);
  const { data: likes } = ids.length ? await supabase.from("media_likes")
    .select("media_id").eq("user_id", userId).in("media_id", ids)
    : { data: [] };
  const likedIds = new Set((likes ?? []).map(item => Number(item.media_id)));

  return media
    .filter(item => item.media_type === "image" || item.media_type === "video")
    .map(item => ({
      id: Number(item.id),
      type: item.media_type as "video" | "image",
      src: supabase.storage.from("media").getPublicUrl(item.storage_path).data.publicUrl,
      title: item.title || "",
      description: item.description || "",
      username: item.owner?.username || "unknown",
      avatar: item.owner?.avatar_url || "/avatar-placeholder.png",
      ownerId: item.owner?.id ?? null,
      verified: Boolean(item.owner?.verified),
      likes: Number(item.like_count || 0),
      views: Number(item.view_count || 0),
      likedByMe: likedIds.has(item.id),
      createdAt: item.created_at,
      hashtags: item.tags || [],
      width: item.width,
      height: item.height,
    }));
}
