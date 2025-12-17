// lib/server/watchOgMeta.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MEDIA_BUCKET = "media";


const FALLBACK_THUMBNAIL =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";


function buildPublicUrl(bucket: string, objectPath: string): string {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function getWatchOgMeta(
  mediaId: number
): Promise<{
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

  const contentUrl = data.storage_path
    ? buildPublicUrl(MEDIA_BUCKET, data.storage_path)
    : null;

  // Always return ABSOLUTE thumbnail (scrapers hate relative)
  const thumbnailUrl = FALLBACK_THUMBNAIL;

  return {
    title: data.title ?? null,
    description: data.description ?? null,
    contentUrl,
    thumbnailUrl,
  };
}
