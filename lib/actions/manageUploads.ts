// lib/actions/manageUploads.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCookies } from "./auth";

export type MediaTab = "all" | "gifs" | "images";
export type MediaType = "video" | "image";

export type ManagedMedia = {
  id: number;
  ownerId: string;
  mediaType: MediaType;
  storagePath: string | null;
  url: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  createdAt: string;
  description: string | null;
};

// how many items per page
export const MANAGE_PAGE_SIZE = 6;

/** storage_path -> public URL */
function publicMediaUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl || null;
}

function mapRowToManagedMedia(row: any): ManagedMedia | null {
  const url = publicMediaUrl(row.storage_path);
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
  };
}

/** Get profile.id from username */
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

/** Fetch one page of managed media for a username + tab */
// lib/actions/manageUploads.ts

// lib/actions/manageUploads.ts

export async function fetchManagedMedia(args: {
  username: string;
  tab: MediaTab; // "all" | "gifs" | "images"
  page: number;
  pageSize?: number;
}): Promise<ManagedMedia[]> {
  const { username, tab, page, pageSize = MANAGE_PAGE_SIZE } = args;

  const ownerId = await getUserIdFromCookies();
  if (!ownerId) return [];

  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("media")
    .select(`
      id,
      owner_id,
      media_type,
      storage_path,
      view_count,
      like_count,
      tags,
      created_at,
      description
    `)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  // tab-based filtering happens here:
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
      ?.map(mapRowToManagedMedia)
      .filter((x): x is ManagedMedia => x !== null) ?? []
  );
}


/** Update description + tags for a media row, return updated object */
export async function updateManagedMedia(args: {
  id: number;
  description: string | null;
  tags: string[];
}): Promise<ManagedMedia | null> {
  const { id, description, tags } = args;

  const { data, error } = await supabase
    .from("media")
    .update({
      description: description || null,
      tags,
    })
    .eq("id", id)
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
    .single();

  if (error || !data) {
    console.error("updateManagedMedia error", error);
    return null;
  }

  return mapRowToManagedMedia(data);
}

/** Delete media row + optionally its file from storage */
export async function deleteManagedMedia(args: {
  id: number;
  storagePath: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { id, storagePath } = args;

  const { error: deleteError } = await supabase
    .from("media")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("deleteManagedMedia DB error", deleteError);
    return { ok: false, error: deleteError.message };
  }

  if (storagePath) {
    const { error: storageError } = await supabase
      .from("media")
      .storage.remove([storagePath]); // <-- if your supabaseClient uses supabase.storage.from("media")
    // If the above line is wrong for your client, keep using:
    // await supabase.storage.from("media").remove([storagePath]);
    if (storageError) {
      console.error("deleteManagedMedia storage error", storageError);
      // not fatal for the UI, but we report it
      return { ok: true, error: storageError.message };
    }
  }

  return { ok: true };
}


export async function searchManagedMedia(args: {
  username: string;
  tab: MediaTab;      // "all" | "gifs" | "images"
  query: string;      // search string
}): Promise<ManagedMedia[]> {
  const { username, tab, query } = args;
  const ownerId = await getUserIdFromCookies();
  if (!ownerId) return [];

  const q = query.trim();
  if (!q) {
    // empty search → same as first page of normal fetch
    return fetchManagedMedia({ username, tab, page: 0, pageSize: MANAGE_PAGE_SIZE });
  }

  let base = supabase
    .from("media")
    .select(`
      id,
      owner_id,
      media_type,
      storage_path,
      view_count,
      like_count,
      tags,
      created_at,
      description
    `)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (tab === "gifs") {
    base = base.eq("media_type", "video");
  } else if (tab === "images") {
    base = base.eq("media_type", "image");
  }

  // description: ILIKE %q%
  // tags (text[]): contains q as a whole tag (not substring) via cs
  const { data, error } = await base.or(
    `description.ilike.%${q}%,tags.cs.{${q}}`
  );

  if (error) {
    console.error("searchManagedMedia error", error);
    return [];
  }

  return (
    (data ?? [])
      .map(mapRowToManagedMedia)
      .filter((x): x is ManagedMedia => x !== null)
  );
}
