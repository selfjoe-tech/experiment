// lib/actions/manageUploads.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCookies } from "./auth";
import { buildPublicUrl } from "./mediaFeed";

export type MediaTab = "all" | "gifs" | "images" | "ads";
export type MediaType = "video" | "image";

export type ManagedMedia = {
  id: number;
  ownerId: string;
  url: string;
  mediaType: "gif" | "image" | "video" | "banner";
  likeCount: number;
  viewCount: number;
  clickCount?: number;       // ads only
  createdAt: string | null;
  description: string | null;
  tags: string[];
  storagePath: string | null;
  isAd?: boolean;            // true for ads
  landingUrl?: string | null; // ads only
};

// how many items per page
export const MANAGE_PAGE_SIZE = 6;

/** storage_path -> public URL (choose bucket) */


/** Map a row from the `media` table */
function mapMediaRowToManaged(row: any): ManagedMedia | null {
  const url = buildPublicUrl(row.storage_path);
  if (!url) return null;

  return {
    id: row.id,
    ownerId: row.owner_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    url,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    description: row.description ?? null,
    clickCount: undefined,
    isAd: false,
    landingUrl: undefined,
  };
}

/** Map a row from the `ads` table */
function mapAdRowToManaged(row: any): ManagedMedia | null {
  // If you store ad files in the same "media" bucket, change "ads" -> "media" here
  const url = buildPublicUrl(row.storage_path);
  if (!url) return null;

  return {
    id: row.id,
    ownerId: row.owner_id,
    mediaType: row.media_type, // "image" | "video" | "banner"
    storagePath: row.storage_path,
    url,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    clickCount: row.clicks ?? 0,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    description: row.description ?? null,
    isAd: true,
    landingUrl: row.landing_url ?? null,
  };
}

/** Get profile.id from username (still here if you need it elsewhere) */
export async function getOwnerIdByUsername(
  username: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (error || !data) {
    console.error("getOwnerIdByUsername error", error);
    return null;
  }

  return data.id as string;
}

/** Fetch one page of managed media (or ads) for the current user */
export async function fetchManagedMedia(args: {
  username: string;      // kept for compatibility, but we use cookies for ownerId
  tab: MediaTab;         // "all" | "gifs" | "images" | "ads"
  page: number;
  pageSize?: number;
}): Promise<ManagedMedia[]> {
  const { tab, page, pageSize = MANAGE_PAGE_SIZE } = args;

  const ownerId = await getUserIdFromCookies();
  if (!ownerId) return [];

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // ---------- ADS TAB (ads table) ----------
  if (tab === "ads") {
    let query = supabase
      .from("ads")
      .select(
        `
        id,
        owner_id,
        media_type,
        storage_path,
        view_count,
        like_count,
        clicks,
        tags,
        created_at,
        description,
        landing_url
      `
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error("fetchManagedMedia (ads) error", error);
      return [];
    }

    return (
      data
        ?.map(mapAdRowToManaged)
        .filter((x): x is ManagedMedia => x !== null) ?? []
    );
  }

  // ---------- NORMAL MEDIA TABS (media table) ----------
  let query = supabase
    .from("media")
    .select(
      `
      id,
      owner_id,
      media_type,
      storage_path,
      view_count,
      like_count,
      tags,
      created_at,
      description
    `
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (tab === "gifs") {
    // fetch ONLY videos for the GIF tab
    query = query.eq("media_type", "video");
  } else if (tab === "images") {
    query = query.eq("media_type", "image");
  }
  // "all" => no media_type filter

  const { data, error } = await query;

  if (error) {
    console.error("fetchManagedMedia error", error);
    return [];
  }

  return (
    data
      ?.map(mapMediaRowToManaged)
      .filter((x): x is ManagedMedia => x !== null) ?? []
  );
}

/** Update description + tags (and landing url for ads), return updated object */
export async function updateManagedMedia(args: {
  id: number;
  description: string | null;
  tags: string[];
  isAd?: boolean;
  landingUrl?: string | null;
}): Promise<ManagedMedia | null> {
  const { id, description, tags, isAd, landingUrl } = args;

  const table = isAd ? "ads" : "media";

  const updatePayload: any = {
    description: description || null,
    tags,
  };

  if (isAd) {
    updatePayload.landing_url = landingUrl ?? null;
  }

  const selectCols =
    table === "ads"
      ? `
        id,
        owner_id,
        media_type,
        storage_path,
        view_count,
        like_count,
        clicks,
        tags,
        created_at,
        description,
        landing_url
      `
      : `
        id,
        owner_id,
        media_type,
        storage_path,
        view_count,
        like_count,
        tags,
        created_at,
        description
      `;

  const { data, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq("id", id)
    .select(selectCols)
    .single();

  if (error || !data) {
    console.error("updateManagedMedia error", error);
    return null;
  }

  return isAd ? mapAdRowToManaged(data) : mapMediaRowToManaged(data);
}

/** Delete media/ad row + optionally its file from storage */
export async function deleteManagedMedia(args: {
  id: number;
  storagePath: string | null;
  isAd?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { id, storagePath, isAd } = args;

  const table = isAd ? "ads" : "media";
  const bucket: "media" | "ads" = isAd ? "ads" : "media";

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("deleteManagedMedia DB error", deleteError);
    return { ok: false, error: deleteError.message };
  }

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([storagePath]);
    if (storageError) {
      console.error("deleteManagedMedia storage error", storageError);
      // not fatal for UI, but we report it
      return { ok: true, error: storageError.message };
    }
  }

  return { ok: true };
}

/** Search user media or ads by description/tags/(landing_url for ads) */
export async function searchManagedMedia(args: {
  username: string;
  tab: MediaTab;      // "all" | "gifs" | "images" | "ads"
  query: string;      // search string
}): Promise<ManagedMedia[]> {
  const { tab, query } = args;
  const ownerId = await getUserIdFromCookies();
  if (!ownerId) return [];

  const q = query.trim();
  if (!q) {
    // empty search → same as first page of normal fetch
    return fetchManagedMedia({
      username: "",
      tab,
      page: 0,
      pageSize: MANAGE_PAGE_SIZE,
    });
  }

  // ---------- SEARCH ADS ----------
  if (tab === "ads") {
    let base = supabase
      .from("ads")
      .select(
        `
        id,
        owner_id,
        media_type,
        storage_path,
        view_count,
        like_count,
        clicks,
        tags,
        created_at,
        description,
        landing_url
      `
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    // description / tags / landing_url
    const { data, error } = await base.or(
      `description.ilike.%${q}%,tags.cs.{${q}},landing_url.ilike.%${q}%`
    );

    if (error) {
      console.error("searchManagedMedia (ads) error", error);
      return [];
    }

    return (
      (data ?? [])
        .map(mapAdRowToManaged)
        .filter((x): x is ManagedMedia => x !== null)
    );
  }

  // ---------- SEARCH NORMAL MEDIA ----------
  let base = supabase
    .from("media")
    .select(
      `
      id,
      owner_id,
      media_type,
      storage_path,
      view_count,
      like_count,
      tags,
      created_at,
      description
    `
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (tab === "gifs") {
    base = base.eq("media_type", "video");
  } else if (tab === "images") {
    base = base.eq("media_type", "image");
  }

  const { data, error } = await base.or(
    `description.ilike.%${q}%,tags.cs.{${q}}`
  );

  if (error) {
    console.error("searchManagedMedia error", error);
    return [];
  }

  return (
    (data ?? [])
      .map(mapMediaRowToManaged)
      .filter((x): x is ManagedMedia => x !== null)
  );
}
