// app/components/explore/data.ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type { SortKey } from "./SortDropdown";
import { Video } from "../feed/types";
import { buildPublicUrl } from "@/lib/actions/mediaFeed";

export type ExploreItem =
  | {
      id: string;
      type: "image";
      src: string;
      alt?: string;
      views?: number;
      score?: number;
      date?: number; // timestamp
    }
  | {
      id: string;
      type: "gif" | "video" | "niche";
      src: string;
      poster?: string;
      views?: number;
      score?: number;
      date?: number; 
      name?: string;
      slug?: string;
    }
  | {
      id: string;
      type: "creator";
      name: string;
      avatar: string;
      followers?: number;
      score?: number;
      date?: number; // timestamp
    };


export type ExploreTabKey = "gifs" | "images" | "creators" | "niches";

type GetItemsForTabArgs = {
  tab: ExploreTabKey;
  sortBy?: SortKey;
  limit?: number;
  page?: number; 
};

/** Helper to turn a storage_path into a public URL (media bucket) */
function publicMediaUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl || null;
}

/**
 * Main helper:
 * Fetch items for a given tab from Supabase.
 * - gifs/images → from media table
 * - creators   → from profiles
 * - niches     → from tags + top-viewed media per tag (uses media.tags text[])
 */



export async function getItemsForTab({
  tab,
  sortBy = "trending",
  limit = 9,
  page = 0,
}: GetItemsForTabArgs): Promise<ExploreItem[]> {
  // translate page → offset
  const offset = page * limit;

  // ========= CREATORS =========
  if (tab === "creators") {
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, follower_count, created_at");

    if (sortBy === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // "trending" and "views" → sort by followers for now
      query = query.order("follower_count", { ascending: false });
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("getItemsForTab(creators) error", error);
      throw new Error(error.message || "Failed to load creators");
    }

    
    return (
      data?.map((row) => {
        const avatar =
          row.avatar_url && row.avatar_url.trim().length > 0
            ? row.avatar_url
            : "/avatar-placeholder.png";

        return {
          id: row.id,
          type: "creator" as const,
          name: row.username,
          avatar,
          followers: row.follower_count ?? 0,
          score: row.follower_count ?? 0,
          date: row.created_at
            ? new Date(row.created_at as string).getTime()
            : undefined,
        } satisfies ExploreItem;
      }) ?? []
    );
  }

  // ========= GIFS / IMAGES from media =========
  if (tab === "gifs" || tab === "images") {
    const targetMediaType = tab === "gifs" ? "video" : "image";

    let query = supabase
      .from("media")
      .select("id, media_type, storage_path, view_count, tags, like_count, created_at, owner:profiles!media_owner_id_fkey (id,username,avatar_url)")
      .eq("media_type", targetMediaType);

    if (sortBy === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (sortBy === "views") {
      query = query.order("view_count", { ascending: false });
    } else {
      // "trending" – approximate: high views + recency
      query = query
        .order("view_count", { ascending: false })
        .order("created_at", { ascending: false });
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error(`getItemsForTab(${tab}) error`, error);
      throw new Error(error.message || "Failed to load media");
    }

    return (
      data
        ?.map((row) => {
          const url = publicMediaUrl(row.storage_path);
          if (!url) return null;

          const base = {
            id: String(row.id),
            ownerId: row.owner,
            src: url,
            views: row.view_count ?? 0,
            likes: row.like_count,
            hashtags: row.tags,
            score: row.view_count ?? 0,
            username: row.owner?.username ?? "unknown",
            avatar: row.owner?.avatar_url ?? "/avatar-placeholder.png",
            date: row.created_at
              ? new Date(row.created_at as string).getTime()
              : undefined,
          };

          if (tab === "gifs") {
            return {
              ...base,
              type: "gif" as const,
            };
          }

          return {
            ...base,
            type: "image" as const,
          };
        })
        .filter(Boolean) as ExploreItem[]
    );
  }

  // ========= NICHES (tags) =========
  // 1) Fetch tag rows from `tags` (paged)
  // 2) For each tag.slug, find top-viewed *video* in `media` where media.tags @> [slug]
  // 3) Build a niche card with label + cover from that video's storage_path + count of posts
if (tab === "niches") {
    const { data: tagRows, error: tagError } = await supabase
      .from("tags")
      .select("id, slug, label, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (tagError) {
      console.error("getItemsForTab(niches) tags error", tagError);
      throw new Error(tagError.message || "Failed to load niches");
    }

    if (!tagRows || tagRows.length === 0) return [];

    const nichePromises: Promise<ExploreItem | null>[] = tagRows.map(
      async (t) => {
        const label = t.label as string;
        const slug = t.slug as string;

        const { data: mediaRows, error: mediaError } = await supabase
          .from("media")
          .select("id, storage_path, view_count, created_at")
          .eq("media_type", "video")
          // media.tags is text[] with Title Case labels
          .contains("tags", [label])
          .order("view_count", { ascending: false })
          .limit(1);

        if (mediaError) {
          console.error(`top media for tag ${label} error`, mediaError);
          return null;
        }

        if (!mediaRows || mediaRows.length === 0) return null;

        const row = mediaRows[0];
        const url = publicMediaUrl(row.storage_path);
        if (!url) return null;

        const item: ExploreItem = {
          id: String(row.id),
          type: "niche",
          slug,           
          name: label,    
          src: url,       
          score: row.view_count ?? 0,
          date: row.created_at
            ? new Date(row.created_at as string).getTime()
            : undefined,
        };

        return item;
      }
    );

    const nicheItemsAll = await Promise.all(nichePromises);
    const nicheItems = nicheItemsAll.filter(
      (x): x is ExploreItem => x !== null
    );

    return nicheItems;
  }










//   if (tab === "niches") {
//   const { data: tagRows, error: tagError } = await supabase
//     .from("tags")
//     .select("id, slug, label, created_at")
//     .order("created_at", { ascending: false })
//     .range(offset, offset + limit - 1);

//   if (tagError) {
//     console.error("getItemsForTab(niches) tags error", tagError);
//     throw new Error(tagError.message || "Failed to load niches");
//   }

//   if (!tagRows || tagRows.length === 0) return [];

//   const nichePromises: Promise<ExploreItem | null>[] = tagRows.map(async (t) => {
//     const label = t.label as string;

//     const { data: mediaRows, error: mediaError } = await supabase
//       .from("media")
//       .select("id, storage_path, view_count, created_at, tags")
//       .eq("media_type", "video")
//       // media.tags is text[] column
//       .contains("tags", [label])
//       .order("view_count", { ascending: false })
//       .limit(1);

//     if (mediaError) {
//       console.error(`top media for tag ${label} error`, mediaError);
//       return null;
//     }

//     if (!mediaRows || mediaRows.length === 0) return null;

//     const row = mediaRows[0];
//     const url = publicMediaUrl(row.storage_path);
//     if (!url) return null;

//     // Return a standard "video" ExploreItem
//     const item: ExploreItem = {
//       id: String(row.id),
//       type: "video",
//       src: url,
//       views: row.view_count ?? 0,
//       score: row.view_count ?? 0,
//       date: row.created_at
//         ? new Date(row.created_at as string).getTime()
//         : undefined,
//       name: label,
      
//     };

//     return item;
//   });

//   const nicheItemsAll = await Promise.all(nichePromises);

//   // Proper type guard so TS knows nulls are removed
//   const nicheItems = nicheItemsAll.filter(
//     (x): x is ExploreItem => x !== null
//   );

//   console.log(nicheItems, "<-------- nicheItems")

//   return nicheItems;
// }



  return [];
}




type MediaTab = "gifs" | "images";


function mapMediaRowToVideo(row: any): Video {
  return {
    id: row.id,
    mediaId: row.id,
    src: row.src,
    type: row.type, // "gif" | "image" | "video"
    views: row.views ?? 0,
    likes: row.like_count ?? 0,
    description: row.description ?? "",
    hashtags: row.hashtags ?? [],
    ownerId: row.owner_id,
    username: row.profiles?.username ?? row.username ?? "unknown",
    avatar: row.profiles?.avatar ?? row.avatar ?? "/default-avatar.png",
    likedByMe: row.likedByMe ?? false,
    // add any other fields your `Video` type expects
  };
}


export async function fetchByUserName(
  username: string,
  tab: MediaTab
): Promise<Video[]> {
  // 1) Get profile by username
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    console.error("fetchByUserName profileError", profileError);
    return [];
  }

  // 2) Decide which media_type to fetch
  const mediaType = tab === "gifs" ? "video" : "image";

  // 3) Fetch media by owner_id + media_type, join profiles via FK media_owner_id_fkey
  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select(`
      id,
      owner_id,
      media_type,
      storage_path,
      view_count,
      tags,
      like_count,
      created_at,
      description,
      owner:profiles!media_owner_id_fkey(
        id,
        username,
        avatar_url
      )
    `)
    .eq("owner_id", profile.id)
    .eq("media_type", mediaType)
    .order("created_at", { ascending: false });

  if (mediaError) {
    console.error("fetchByUserName mediaError", mediaError);
    return [];
  }

  return (mediaRows ?? []).map(mapMediaRowToVideo);
}


type GetUserMediaArgs = {
  username: string;
  tab: MediaTab;        // "gifs" | "images"
  sortBy?: SortKey;     // "trending" | "newest" | "views"
  limit?: number;       // default 9
  page?: number;        // 0-based page index
};

/** Helper: generate public URL from media bucket */

/**
 * Fetch media for a specific user by username, for GIFs or Images tab.
 * Pagination is controlled via (limit, page).
 */
export async function getUserMedia({
  username,
  tab,
  sortBy = "trending",
  limit = 9,
  page = 0,
}: GetUserMediaArgs) {
  const normalizedUsername = username.trim().toLowerCase();

  // 1) Look up the profile to get owner_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("getUserMedia profile error", profileError);
    return [];
  }

  const ownerId = profile.id;
  const offset = page * limit;

  // 2) Decide which media_type to fetch
  const targetMediaType = tab === "gifs" ? "video" : "image";

  let query = supabase
    .from("media")
    .select(
      `
        id,
        media_type,
        storage_path,
        view_count,
        tags,
        like_count,
        created_at
      `
    )
    .eq("owner_id", ownerId)
    .eq("media_type", targetMediaType);

  // 3) Sorting
  if (sortBy === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (sortBy === "views") {
    query = query.order("view_count", { ascending: false });
  } else {
    // "trending" – approximate by high views + recency
    query = query
      .order("view_count", { ascending: false })
      .order("created_at", { ascending: false });
  }

  // 4) Pagination
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("getUserMedia media error", error);
    return [];
  }

  // 5) Map rows to Explore-style items (gif/image)
  return (
    data
      ?.map((row: any) => {
        const url = publicMediaUrl(row.storage_path);
        if (!url) return null;

        const base = {
          id: String(row.id),
          src: url,
          views: row.view_count ?? 0,
          score: row.view_count ?? 0,
          date: row.created_at
            ? new Date(row.created_at as string).getTime()
            : undefined,
          likes: row.like_count,
        };

        if (tab === "gifs") {
          return {
            ...base,
            type: "gif" as const,
          };
        }

        return {
          ...base,
          type: "image" as const,
        };
      })
      .filter((x) => x !== null) || []
  );
}