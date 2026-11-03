"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type AdBuyerSlot = {
  id: string;
  user_id: string;
  expires_at: string | null;
  status: string | null;
};

export type AdMediaType = "video" | "image" | "banner";

export async function fetchAdBuyerSlotById(
  id: string
): Promise<AdBuyerSlot | null> {
  const slotId = Number(id);
  if (!Number.isSafeInteger(slotId) || slotId <= 0) return null;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("ad_buyers")
    .select("id, user_id, expires_at, status")
    .eq("id", slotId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("fetchAdBuyerSlotById error", error);
    return null;
  }

  return data
    ? {
        id: String(data.id),
        user_id: data.user_id,
        expires_at: data.expires_at,
        status: data.status,
      }
    : null;
}

export async function uploadAdForSlot(args: {
  adBuyerId: string;
  ownerId: string | null; // Legacy parameter, ignored; owner is derived from Auth.
  file: File;
  mediaType: AdMediaType;
  landingUrl: string;
  description?: string | null;
}): Promise<{ storagePath: string }> {
  const { adBuyerId, file, mediaType, landingUrl, description } = args;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in to upload an ad.");
  }

  const slotId = Number(adBuyerId);
  if (!Number.isSafeInteger(slotId) || slotId <= 0) {
    throw new Error("Invalid advertising slot.");
  }

  const { data: slot, error: slotError } = await supabase
    .from("ad_buyers")
    .select("id, user_id, expires_at")
    .eq("id", slotId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (slotError || !slot) {
    console.error("uploadAdForSlot slot lookup failed", slotError);
    throw new Error("You do not own this advertising slot.");
  }

  if (!slot.expires_at || new Date(slot.expires_at).getTime() <= Date.now()) {
    throw new Error("This advertising slot has expired.");
  }

  let url: URL;
  try {
    url = new URL(landingUrl);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS landing URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter a valid HTTP or HTTPS landing URL.");
  }

  const folder =
    mediaType === "video"
      ? "videos"
      : mediaType === "banner"
      ? "banners"
      : "images";

  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext =
    extMatch?.[1]?.toLowerCase() ??
    (mediaType === "video" ? "mp4" : "jpg");

  // The second folder segment is always the authenticated user's UUID.
  const storagePath =
    `ads/${user.id}/${slotId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("uploadAdForSlot storage error", uploadError);
    throw new Error(uploadError.message || "Failed to upload ad file.");
  }

  const { error: insertError } = await supabase.from("ads").insert({
    owner_id: user.id,
    media_type: mediaType,
    storage_path: storagePath,
    landing_url: url.toString(),
    description: description?.trim() || null,
  });

  if (insertError) {
    console.error("uploadAdForSlot insert error", insertError);
    await supabase.storage.from("media").remove([storagePath]);
    throw new Error(insertError.message || "Failed to save ad in the database.");
  }

  return { storagePath };
}

export type SidebarAd = {
  id: string;
  storage_path: string | null;
  media_type: "image" | "video" | "banner";
  landing_url: string | null;
  owner_username: string | null;
};

function mapSidebarAd(row: any): SidebarAd {
  return {
    id: String(row.id),
    storage_path: row.storage_path ?? null,
    media_type: row.media_type,
    landing_url: row.landing_url ?? null,
    owner_username: row.owner_username ?? null,
  };
}

export async function fetchRandomMobileBannerAd(): Promise<SidebarAd | null> {
  const { data, error } = await supabase.rpc("get_active_ads_for_feed", {
    p_media_type: "banner",
    p_limit: 1,
  });

  if (error) {
    console.error("fetchRandomMobileBannerAd RPC error", error);
    return null;
  }

  return data?.[0] ? mapSidebarAd(data[0]) : null;
}

export async function fetchDesktopSidebarAds(): Promise<SidebarAd[]> {
  const { data, error } = await supabase.rpc("get_active_ads_for_feed", {
    p_media_type: null,
    p_limit: 5,
  });

  if (error) {
    console.error("fetchDesktopSidebarAds RPC error", error);
    return [];
  }

  return (data ?? []).map(mapSidebarAd);
}

export async function incrementAdClicks(adId: string) {
  const id = Number(adId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid ad ID.");
  }

  const { error } = await supabase.rpc("increment_ad_clicks", {
    ad_id: id,
  });

  if (error) throw new Error(error.message);
  return { ok: true };
}
