import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { HomePost } from "@/lib/actions/homeFeed";

const PAGE_SIZE = 7;
const KNOWN_PREFERENCES = ["straight", "gay", "bisexual", "trans", "lesbian", "animated"] as const;

function normalize(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const values = raw.filter((p): p is string => typeof p === "string").map(p => p.toLowerCase().trim());
  return KNOWN_PREFERENCES.filter(p => values.includes(p));
}

function cookiePreferences(value: string | undefined): string[] {
  if (!value) return [];
  try { return normalize(JSON.parse(value)); }
  catch { return normalize(value.split(",")); }
}

/**
 * Populate visible Home content in the server HTML, rather than waiting for
 * hydration, an auth server action and then the browser database request.
 */
export async function getHomeInitialFeed(): Promise<{
  posts: HomePost[];
  viewerId: string | null;
} | null> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    const viewerId = user?.id ?? null;
    let preferences: string[] = [];

    if (viewerId) {
      const { data } = await db.from("user_preferences").select("preferences")
        .eq("user_id", viewerId).maybeSingle();
      preferences = normalize(data?.preferences);
    }
    if (!preferences.length) {
      const store = await cookies();
      preferences = cookiePreferences(store.get("preferences")?.value);
    }
    if (!preferences.length) preferences = ["straight"];

    let query = db.from("media").select(
      "id,media_type,storage_path,thumbnail_path,title,description,created_at,width,height," +
      "duration_seconds,like_count,view_count,tags," +
      "owner:profiles!media_owner_id_fkey(id,username,avatar_url,verified)"
    ).in("media_type", ["image", "video"])
      .not("storage_path", "is", null);

    query = preferences.length === 1
      ? query.eq("audience", preferences[0])
      : query.in("audience", preferences);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) throw error;

    const rows = data ?? [];
    let liked = new Set<number>();
    if (viewerId && rows.length) {
      const ids = rows.map(r => Number(r.id));
      const { data: likes } = await db.from("media_likes")
        .select("media_id").eq("user_id", viewerId).in("media_id", ids);
      liked = new Set((likes ?? []).map(l => Number(l.media_id)));
    }

    const publicMediaUrl = (path: string) =>
      /^https:\/\//i.test(path)
        ? path
        : db.storage.from("media").getPublicUrl(path).data.publicUrl;

    return {
      viewerId,
      posts: rows.filter(r => r.storage_path).map(row => {
        const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
        return {
          id: Number(row.id),
          type: row.media_type as "video" | "image",
          src: publicMediaUrl(row.storage_path),
          poster: row.thumbnail_path ? publicMediaUrl(row.thumbnail_path) : null,
          title: row.title ?? "",
          description: row.description ?? "",
          username: owner?.username ?? "unknown",
          avatar: owner?.avatar_url || "/avatar-placeholder.png",
          ownerId: owner?.id ?? null,
          verified: Boolean(owner?.verified),
          likes: Number(row.like_count ?? 0),
          views: Number(row.view_count ?? 0),
          likedByMe: liked.has(Number(row.id)),
          createdAt: row.created_at,
          durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
          hashtags: row.tags ?? [],
          width: row.width,
          height: row.height,
        } satisfies HomePost;
      }),
    };
  } catch (error) {
    console.error("[home] Initial feed unavailable; falling back to client loading", error);
    return null;
  }
}
