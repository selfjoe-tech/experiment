"use server";

import { Video } from "@/app/components/feed/types";
import { supabase } from "../supabaseClient";


const MEDIA_BUCKET = "media"

function buildPublicUrl(path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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