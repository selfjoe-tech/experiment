import { createClient } from "@/lib/supabase/server";

export const SITE = "https://goongram.com";
export const BRAND = "Goon Gram";
export const DEFAULT_IMAGE = `${SITE}/icons/logo7.png`;

export function absolute(path: string): string {
  return `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
}
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  if (/^http:|^\/\//i.test(path)) return null;
  // Public media references may point to Supabase Storage or an HTTPS R2 URL.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
export function publicHttps(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : undefined; }
  catch { return undefined; }
}
export function encodeUsername(username: string): string {
  return `/${encodeURIComponent(username)}`;
}
export function mediaTitle(title: string | null | undefined, description: string | null | undefined, type: string, id: number): string {
  return title?.trim() || description?.trim().slice(0, 110) || `${type === "video" ? "Video" : "Image"} ${id}`;
}
export function isoDuration(value: unknown): string | undefined {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const rounded = Math.ceil(seconds);
  return `PT${Math.floor(rounded / 3600)}H${Math.floor(rounded % 3600 / 60)}M${rounded % 60}S`;
}
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
export type PublicMedia = {
  id: number; media_type: string; title: string | null; description: string | null;
  storage_path: string | null; thumbnail_path: string | null;
  duration_seconds: number | null; width: number | null; height: number | null;
  created_at: string; tags: string[] | null; audience: string | null;
  view_count: number | null; like_count: number | null;
  owner: { username: string; avatar_url: string | null } | null;
};
export async function getPublicMedia(id: number, type?: "video" | "image"): Promise<PublicMedia | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const db = await createClient();
  let query = db.from("media")
    .select("id,media_type,title,description,storage_path,thumbnail_path,duration_seconds,width,height,created_at,tags,audience,view_count,like_count,owner:profiles!media_owner_id_fkey(username,avatar_url)")
    .eq("id", id).not("storage_path", "is", null);
  if (type) query = query.eq("media_type", type);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as unknown as PublicMedia;
}
export type PublicProfile = {
  id: string; username: string; avatar_url: string | null; bio: string | null;
  verified: boolean; created_at: string; follower_count: number;
};
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  if (!username || username.length > 80) return null;
  const db = await createClient();
  const { data, error } = await db.from("profiles")
    .select("id,username,avatar_url,bio,verified,created_at,follower_count")
    .ilike("username", username).maybeSingle();
  return error ? null : data as PublicProfile | null;
}
export async function getPublicCreatorMedia(ownerId: string, limit = 16) {
  const db = await createClient();
  const { data, error } = await db.from("media")
    .select("id,media_type,title,description,storage_path,thumbnail_path,created_at")
    .eq("owner_id", ownerId).in("media_type", ["video","image"])
    .not("storage_path","is",null)
    .order("created_at", { ascending: false }).limit(limit);
  return error ? [] : data ?? [];
}
export function seoEligibleProfile(profile: PublicProfile, posts: unknown[]): boolean {
  // An otherwise empty account should not become a thin search landing page.
  return Boolean(profile.username.trim()) && posts.length > 0;
}
