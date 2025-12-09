// lib/actions/saved.ts
"use server";

import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCookies } from "./auth";

// Only gifs/videos & images needed here
type SavedTab = "gifs" | "images";

type GetSavedArgs = {
  tab: SavedTab;
  sortBy?: string; // we don't really use it yet, but kept for API parity
  limit?: number;
  page?: number;
};

/**
 * Fetch media that the current user has liked, paginated.
 * Returns items shaped like ExploreGrid expects ("image" | "video"/"gif").
 */
export async function getSavedItemsForTab({
  tab,
  sortBy,
  limit = 9,
  page = 0,
}: GetSavedArgs) {
  const userId = await getUserIdFromCookies();
  if (!userId) {
    // not logged in -> nothing saved
    return [];
  }

  const offset = page * limit;
  const mediaType = tab === "images" ? "image" : "video";

  // We query media_likes and join the media row
  let query = supabase
    .from("media_likes")
    .select(
      `
      created_at,
      media:media (
        id,
        media_type,
        storage_path,
        view_count,
        like_count,
        tags,
        description,
        created_at,
        owner:profiles!media_owner_id_fkey (
          id,
          username,
          avatar_url
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("media.media_type", mediaType);

  // Sort newest-liked first (you can change later)
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("getSavedItemsForTab error", error);
    return [];
  }

  const rows = (data ?? []) as any[];

  return rows
    .map((row) => {
      const m = row.media;
      if (!m || !m.storage_path) return null;

      const { data: pub } = supabase
        .storage
        .from("media")
        .getPublicUrl(m.storage_path);

      const url = pub.publicUrl;
      if (!url) return null;

      const base = {
        id: String(m.id),
        src: url,
        views: m.view_count ?? 0,
        score: m.view_count ?? 0,
        date: m.created_at
          ? new Date(m.created_at as string).getTime()
          : undefined,
        likes: m.like_count ?? 0,
        description: m.description ?? "",
        hashtags: m.tags ?? [],
        ownerId: m.owner?.id,
        username: m.owner?.username ?? "unknown",
        avatar: m.owner?.avatar_url ?? "/avatar-placeholder.png",
      };

      if (mediaType === "image") {
        return {
          ...base,
          type: "image" as const,
        };
      }

      // treat all saved video as "video" ExploreItem (lazy video will handle it)
      return {
        ...base,
        type: "video" as const,
      };
    })
    .filter(Boolean);
}
