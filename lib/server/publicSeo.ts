import "server-only";
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const SEO_SITE = "https://goongram.com";
export const SEO_BRAND = "Goon Gram";
export const SEO_FALLBACK_IMAGE = "/icons/logo7.png";

export type PublicMediaSeo = {
  id: number;
  owner_id: string;
  media_type: "video" | "image";
  title: string | null;
  description: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  tags: string[] | null;
  created_at: string;
  view_count: number | null;
  username: string;
  avatar_url: string | null;
  verified: boolean | null;
};
export type PublicProfileSeo = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  follower_count: number;
  created_at: string;
};

export function absoluteSeoUrl(path: string) {
  return new URL(path.startsWith("/") ? path : `/${path}`, SEO_SITE).toString();
}
export function isSafeSeoId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}
export function safeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
export function publicStorageUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      // Sitemaps and JSON-LD must NEVER publish signed, expiring URLs,
      // storage API endpoints or URLs with embedded authentication.
      if (url.username || url.password || url.search || url.hash ||
          url.hostname.endsWith(".r2.cloudflarestorage.com") ||
          url.pathname.includes("/storage/v1/object/sign/")) return null;
      return url.toString();
    } catch { return null; }
  }
  if (/^[a-z]+:\/\//i.test(path) || path.startsWith("//")) return null;
  return getSupabaseAdmin().storage.from("media").getPublicUrl(path).data.publicUrl;
}
export function mediaSeoPath(media: {id:number;media_type:string}) {
  return media.media_type === "image" ? `/images/${media.id}` : `/watch/${media.id}`;
}
export function mediaSeoTitle(media: PublicMediaSeo) {
  const actual = media.title?.trim() || media.description?.trim().slice(0, 90);
  if (actual) return actual.slice(0, 125);
  const tags = (media.tags || []).filter(t => typeof t === "string" && t.trim()).slice(0,3);
  const prefix = tags.join(", ");
  const type = media.media_type === "image" ? "Image" : "Video";
  return prefix ? `${prefix} · ${type} by @${media.username}` : `${type} by @${media.username}`;
}
export function mediaSeoDescription(media: PublicMediaSeo) {
  const original = media.description?.trim();
  if (original) return original.slice(0,250);
  const tags = (media.tags||[]).filter(t => t?.trim()).slice(0,6);
  return `${media.media_type === "image" ? "Image" : "Video"} uploaded by @${media.username} on Goon Gram${tags.length ? `. Tagged: ${tags.join(", ")}` : ""}.`;
}
export function seoIsoDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.ceil(seconds);
  const hours = Math.floor(total/3600);
  const minutes = Math.floor((total%3600)/60);
  const secs = total%60;
  return `PT${hours ? hours + "H" : ""}${minutes ? minutes+"M" : ""}${secs || (!hours&&!minutes) ? secs + "S" : ""}`;
}
export const getPublicMediaSeo = cache(async (id:number):Promise<PublicMediaSeo|null> => {
  if (!isSafeSeoId(id)) return null;
  const { data,error } = await getSupabaseAdmin().from("public_seo_media")
    .select("id,owner_id,media_type,title,description,storage_path,thumbnail_path,duration_seconds,width,height,tags,created_at,view_count,username,avatar_url,verified")
    .eq("id",id).maybeSingle();
  if (error) throw error;
  return data as PublicMediaSeo|null;
});
export const getPublicProfileSeo = cache(async (username:string):Promise<PublicProfileSeo|null> => {
  if (!/^[a-z0-9._]{1,40}$/.test(username)) return null;
  const {data,error}=await getSupabaseAdmin().from("public_seo_profiles")
    .select("id,username,bio,avatar_url,verified,follower_count,created_at")
    .eq("username",username).maybeSingle();
  if (error) throw error;
  return data as PublicProfileSeo|null;
});
export async function getProfilePublicMedia(id:string,limit=24):Promise<PublicMediaSeo[]> {
  const {data,error}=await getSupabaseAdmin().from("public_seo_media")
    .select("id,owner_id,media_type,title,description,storage_path,thumbnail_path,duration_seconds,width,height,tags,created_at,view_count,username,avatar_url,verified")
    .eq("owner_id",id).order("created_at",{ascending:false}).limit(limit);
  if(error)throw error;
  return (data||[]) as PublicMediaSeo[];
}
export async function getLatestPublicMedia(limit=24,type?:"video"|"image"):Promise<PublicMediaSeo[]> {
  let query=getSupabaseAdmin().from("public_seo_media")
    .select("id,owner_id,media_type,title,description,storage_path,thumbnail_path,duration_seconds,width,height,tags,created_at,view_count,username,avatar_url,verified")
    .order("created_at",{ascending:false}).limit(limit);
  if(type)query=query.eq("media_type",type);
  const {data,error}=await query;
  if(error)throw error;
  return (data||[]) as PublicMediaSeo[];
}
