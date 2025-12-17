// lib/server/watchOgMeta.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const MEDIA_BUCKET = "media"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


export function buildPublicUrl(path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function getWatchOgMeta(mediaId: number): Promise<{
  title: string | null;
  description: string | null;
  contentUrl: string | null;
  thumbnailUrl: string | null;
} | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("media")
    .select("id,title,description,storage_path")
    .eq("id", mediaId)
    .eq("media_type", "video")
    .maybeSingle();

  if (error || !data) return null;

  const contentUrl = data.storage_path ? buildPublicUrl(data.storage_path) : null;

  // If you don't have thumbnails yet, this will be null and the page will use /og-default.jpg

  return {
    title: (data.title ?? null) as string | null,
    description: (data.description ?? null) as string | null,
    contentUrl,
    thumbnailUrl: "/icons/logo7.png",
  };
}
