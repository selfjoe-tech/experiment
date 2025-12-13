// lib/actions/ads.ts

import { supabase } from "@/lib/supabaseClient";

export type AdBuyerSlot = {
  id: string;
  user_id: string;
  expires_at: string | null;
  status: string | null;
};

export type AdMediaType = "video" | "image" | "banner";

const MEDIA_BUCKET = "media";

/**
 * Fetch a single ad_buyers row by id
 * Used to verify the slot is still active before upload.
 */
export async function fetchAdBuyerSlotById(
  id: string
): Promise<AdBuyerSlot | null> {
  const { data, error } = await supabase
    .from("ad_buyers")
    .select("id, user_id, expires_at, status")
    .eq("id", id)
    .maybeSingle<AdBuyerSlot>();

  if (error) {
    console.error("fetchAdBuyerSlotById error", error);
    return null;
  }

  return data ?? null;
}

/**
 * Uploads the ad file to storage and inserts into `ads` table.
 * This keeps all DB + storage logic out of the client component.
 */
export async function uploadAdForSlot(args: {
  adBuyerId: string;
  ownerId: string | null;
  file: File;
  mediaType: AdMediaType;
  landingUrl: string;
  description?: string | null;
}): Promise<{ storagePath: string }> {
  const { adBuyerId, ownerId, file, mediaType, landingUrl, description } = args;

  // 1) decide folder
  const folder =
    mediaType === "video"
      ? "videos"
      : mediaType === "banner"
      ? "banners"
      : "images";

  // 2) pick extension
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext =
    extMatch && extMatch[1]
      ? extMatch[1]
      : mediaType === "video"
      ? "mp4"
      : "jpg";

  const storagePath = `ads/${folder}/${adBuyerId}/${Date.now()}.${ext}`;

  // 3) upload to storage
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadAdForSlot storage error", uploadError);
    throw new Error("Failed to upload file. Please try again.");
  }

  // 4) insert into ads table
  const { error: insertError } = await supabase.from("ads").insert({
    owner_id: ownerId,
    media_type: mediaType,
    storage_path: storagePath,
    landing_url: landingUrl,
    description: description ?? null,
  });

  if (insertError) {
    console.error("uploadAdForSlot insert error", insertError);
    throw new Error("Failed to save ad in the database.");
  }

  return { storagePath };
}


// lib/actions/ads.ts
export type SidebarAd = {
  id: string;
  storage_path: string | null;
  media_type: "image" | "video" | "banner";
  landing_url: string | null;
  owner_username: string | null;
};

export async function fetchRandomMobileBannerAd(): Promise<SidebarAd | null> {
  const nowIso = new Date().toISOString();

  // 1) Active ad buyers
  const { data: buyers, error: buyersError } = await supabase
    .from("ad_buyers")
    .select("user_id")
    .gt("expires_at", nowIso);

  if (buyersError) {
    console.error("fetchRandomMobileBannerAd ad_buyers error", buyersError);
    return null;
  }

  const activeUserIds = Array.from(
    new Set((buyers ?? []).map((b) => b.user_id).filter(Boolean))
  );

  if (activeUserIds.length === 0) return null;

  // 2) **BANNER ONLY** ads for those users
  const { data, error } = await supabase
    .from("ads")
    .select(
      `
      id,
      storage_path,
      media_type,
      landing_url,
      owner:profiles!ads_owner_id_fkey (
        username
      )
    `
    )
    .eq("media_type", "banner")          // 👈 change here: banners only
    .in("owner_id", activeUserIds)
    .limit(50);

  if (error) {
    console.error("fetchRandomMobileBannerAd ads error", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const rows = data as any[];

  // shuffle & pick one
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const picked = rows[0];
  if (!picked) return null;

  return {
    id: picked.id,
    storage_path: picked.storage_path,
    media_type: picked.media_type,
    landing_url: picked.landing_url ?? null,
    owner_username: picked.owner?.username ?? null,
  };
}

export async function fetchDesktopSidebarAds(): Promise<SidebarAd[]> {
  const nowIso = new Date().toISOString();

  // 1) Find active ad buyers (their slots not expired)
  const { data: buyers, error: buyersError } = await supabase
    .from("ad_buyers")
    .select("user_id")
    .gt("expires_at", nowIso);

  if (buyersError) {
    console.error("fetchDesktopSidebarAds ad_buyers error", buyersError);
    return [];
  }

  const activeUserIds = Array.from(
    new Set((buyers ?? []).map((b) => b.user_id).filter(Boolean))
  );

  if (activeUserIds.length === 0) {
    return [];
  }

  // 2) Ads owned by those active buyers & marked to show
  const { data, error } = await supabase
    .from("ads")
    .select(
      `
        id,
        storage_path,
        media_type,
        landing_url,
        showAd,
        owner_id,
        owner:profiles!ads_owner_id_fkey (
          username
        )
      `
    )
    .eq("showAd", true)
    .in("owner_id", activeUserIds)
    .limit(3);

  if (error) {
    console.error("fetchDesktopSidebarAds ads error", error);
    return [];
  }

  const rows = (data ?? []) as any[];

  // shuffle in-place
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const mapped: SidebarAd[] = rows.map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    media_type: row.media_type,
    landing_url: row.landing_url ?? null,
    owner_username: row.owner?.username ?? null,
  }));

  // return up to 5 random ads
  return mapped.slice(0, 5);
}
