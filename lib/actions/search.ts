// lib/actions/search.ts
"use server";

import { supabase } from "@/lib/supabaseClient";

const MEDIA_BUCKET = "media";

function publicMediaUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

export type CreatorSearchResult = {
  id: string;
  username: string;
  avatarUrl: string | null;
  followerCount: number;
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
};

export type GlobalSearchResult = {
  creators: CreatorSearchResult[];
  tags: TagSearchResult[];
  images: MediaSearchResult[];
  videos: MediaSearchResult[];
};

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (!q || q.length < 2) {
    return { creators: [], tags: [], images: [], videos: [] };
  }

  const pattern = `%${q}%`;

  const [creatorRes, tagRes, imageRes, videoRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_url, follower_count")
      .ilike("username", pattern)
      .order("follower_count", { ascending: false })
      .limit(8),

    supabase
      .from("tags")
      .select("id, label, slug, created_at")
      .ilike("label", pattern)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("media")
      .select("id, media_type, storage_path, description")
      .eq("media_type", "image")
      .ilike("description", pattern)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("media")
      .select("id, media_type, storage_path, description")
      .eq("media_type", "video")
      .ilike("description", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const creators: CreatorSearchResult[] =
    creatorRes.data?.map((row) => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url ?? null,
      followerCount: row.follower_count ?? 0,
    })) ?? [];

  const tags: TagSearchResult[] =
    tagRes.data?.map((row) => ({
      id: row.id,
      label: row.label,
      slug: row.slug,
      postCount: row.post_count ?? 0,
    })) ?? [];


  const images: MediaSearchResult[] =
    imageRes.data
      ?.map((row) => {
        const src = publicMediaUrl(row.storage_path);
        if (!src) return null;
        return {
          id: row.id,
          src,
          mediaType: "image" as const,
        };
      })
      .filter(Boolean) ?? [];

  const videos: MediaSearchResult[] =
    videoRes.data
      ?.map((row) => {
        const src = publicMediaUrl(row.storage_path);
        if (!src) return null;
        return {
          id: row.id,
          src,
          mediaType: "video" as const,
        };
      })
      .filter(Boolean) ?? [];



  return { creators, tags, images, videos };
}
