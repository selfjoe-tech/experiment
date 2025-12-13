// lib/actions/social.ts
import { supabase } from "@/lib/supabaseClient";
import { getUserIdByUsername, getUserIdFromCookies } from "./auth";



/**
 * FOLLOW HELPERS
 * follows table: follower_id (uuid), followee_id (uuid)
 */

export async function checkIsFollowing(targetUserId: string): Promise<boolean> {
  try {
    const currentId = await getUserIdFromCookies();

    if (!targetUserId || currentId === targetUserId) {
      // can't follow yourself, treat as "not following"
      return false;
    }

    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentId)
      .eq("followee_id", targetUserId)
      .maybeSingle();

    if (error) {
      console.error("checkIsFollowing error", error);
      throw error;
    }

    return !!data;
  } catch (err) {
    // if not logged in or any error, just treat as not following
    console.warn("checkIsFollowing fallback (not following)", err);
    return false;
  }
}

/**
 * Toggle follow/unfollow.
 * Returns the new state: { following: true/false }
 */
// export async function toggleFollowUser(targetUserId: string): Promise<{
//   following: boolean;
// }> {
//   const currentId = "0a3404e4-39e2-4715-b5ce-81ea08e81e90";

//   if (!targetUserId || currentId === targetUserId) {
//     throw new Error("You cannot follow yourself.");
//   }

//   // Check if follow already exists
//   const { data: existing, error: existingError } = await supabase
//     .from("follows")
//     .select("follower_id, followee_id")
//     .eq("follower_id", currentId)
//     .eq("followee_id", targetUserId)
//     .maybeSingle();

//   if (existingError) {
//     console.error("toggleFollowUser lookup error", existingError);
//     throw existingError;
//   }

//   // If exists → UNFOLLOW
//   if (existing) {
//     const { error: delError } = await supabase
//       .from("follows")
//       .delete()
//       .eq("follower_id", currentId)
//       .eq("followee_id", targetUserId);

//     if (delError) {
//       console.error("toggleFollowUser delete error", delError);
//       throw delError;
//     }

//     return { following: false };
//   }

//   // Else → FOLLOW
//   const { error: insertError } = await supabase.from("follows").insert({
//     follower_id: currentId,
//     followee_id: targetUserId,
//   });

//   if (insertError) {
//     console.error("toggleFollowUser insert error", insertError);
//     throw insertError;
//   }

//   return { following: true };
// }

export async function toggleFollowUser(targetUserId: string): Promise<{
  following: boolean;
}> {
  const currentId = await getUserIdFromCookies();

  if (!currentId) {
    throw new Error("You must be logged in to follow users.");
  }

  if (!targetUserId || currentId === targetUserId) {
    throw new Error("You cannot follow yourself.");
  }

  // Check if follow already exists
  const { data: existing, error: existingError } = await supabase
    .from("follows")
    .select("follower_id, followee_id")
    .eq("follower_id", currentId)
    .eq("followee_id", targetUserId)
    .maybeSingle();

  if (existingError) {
    console.error("toggleFollowUser lookup error", existingError);
    throw existingError;
  }

  // If exists → UNFOLLOW
  if (existing) {
    const { error: delError } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentId)
      .eq("followee_id", targetUserId);

    if (delError) {
      console.error("toggleFollowUser delete error", delError);
      throw delError;
    }

    return { following: false };
  }

  // Else → FOLLOW
  const { error: insertError } = await supabase.from("follows").insert({
    follower_id: currentId,
    followee_id: targetUserId,
  });

  if (insertError) {
    console.error("toggleFollowUser insert error", insertError);
    throw insertError;
  }

  return { following: true };
}


/**
 * LIKE HELPERS
 * media_likes table: media_id (bigint), user_id (uuid)
 */



/**
 * Toggle like/unlike on a media row.
 * Triggers your DB-side counter via triggers.
 *
 * Returns the new state: { liked: true/false }
 */
// export async function toggleMediaLike(mediaId: number): Promise<{
//   liked: boolean;
// }> {
//   if (!mediaId) {
//     throw new Error("Missing media id.");
//   }

//   const userId = await getUserIdFromCookies();

//   // Check if already liked
//   const { data: existing, error: existingError } = await supabase
//     .from("media_likes")
//     .select("media_id")
//     .eq("media_id", mediaId)
//     .eq("user_id", userId)
//     .maybeSingle();

//   if (existingError) {
//     console.error("toggleMediaLike lookup error", existingError);
//     throw existingError;
//   }

//   if (existing) {
//     // UNLIKE
//     const { error: delError } = await supabase
//       .from("media_likes")
//       .delete()
//       .eq("media_id", mediaId)
//       .eq("user_id", userId);

//     if (delError) {
//       console.error("toggleMediaLike delete error", delError);
//       throw delError;
//     }
//     return { liked: false };
//   }

//   // LIKE
//   const { error: insertError } = await supabase
//     .from("media_likes")
//     .insert({ media_id: mediaId, user_id: userId });

//   if (insertError) {
//     console.error("toggleMediaLike insert error", insertError);
//     throw insertError;
//   }

//   return { liked: true };
// }

async function addTagsToUserRecs(userId: string, mediaId: number) {
  // 1) get tags from media
  const { data: mediaRow, error: mediaError } = await supabase
    .from("media")
    .select("tags")
    .eq("id", mediaId)
    .maybeSingle();

  if (mediaError) {
    console.error("addTagsToUserRecs media error", mediaError);
    return;
  }

  const tags: string[] = (mediaRow?.tags ?? []).filter(Boolean);
  if (!tags.length) return;

  // 2) get existing recs
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("recs")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("addTagsToUserRecs profile error", profileError);
    return;
  }


  const existing: string[] = (profileRow?.recs ?? []).filter(Boolean);
  const merged = Array.from(new Set([...existing, ...tags])); // dedupe

  // 3) update recs
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ recs: merged })
    .eq("id", userId);

  if (updateError) {
    console.error("addTagsToUserRecs update error", updateError);
  }
}

export async function toggleMediaLike(mediaId: number): Promise<{
  liked: boolean;
}> {
  if (!mediaId) {
    throw new Error("Missing media id.");
  }

  const userId = await getUserIdFromCookies();
  if (!userId) {
    throw new Error("You must be logged in to like media.");
  }

  // Check if already liked
  const { data: existing, error: existingError } = await supabase
    .from("media_likes")
    .select("media_id")
    .eq("media_id", mediaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("toggleMediaLike lookup error", existingError);
    throw existingError;
  }

  if (existing) {
    // UNLIKE
    const { error: delError } = await supabase
      .from("media_likes")
      .delete()
      .eq("media_id", mediaId)
      .eq("user_id", userId);

    if (delError) {
      console.error("toggleMediaLike delete error", delError);
      throw delError;
    }

    // we don't remove tags from recs – they still represent "things you've liked before"
    return { liked: false };
  }

  // LIKE
  const { error: insertError } = await supabase
    .from("media_likes")
    .insert({ media_id: mediaId, user_id: userId });

  if (insertError) {
    console.error("toggleMediaLike insert error", insertError);
    throw insertError;
  }

  // ⚡ update recs with tags of this media
  await addTagsToUserRecs(userId, mediaId);

  return { liked: true };
}




export async function getMyFollowCounts(): Promise<FollowCounts> {
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return { followers: 0, following: 0, views: 0 };
  }

  try {
    const [
      { count: followersCount, error: followersError },
      { count: followingCount, error: followingError },
      { data: mediaRows, error: mediaError },
    ] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
      supabase
        .from("media")
        .select("view_count")
        .eq("owner_id", userId),
    ]);

    if (followersError) {
      console.error("getMyFollowCounts followersError", followersError);
    }
    if (followingError) {
      console.error("getMyFollowCounts followingError", followingError);
    }
    if (mediaError) {
      console.error("getMyFollowCounts mediaError", mediaError);
    }

    const viewsTotal = (mediaRows ?? []).reduce(
      (sum, row: any) => sum + (row.view_count ?? 0),
      0
    );

    return {
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
      views: viewsTotal,
    };
  } catch (err) {
    console.error("getMyFollowCounts thrown error", err);
    return { followers: 0, following: 0, views: 0 };
  }
}


export async function checkHasLikedMedia(mediaId: number): Promise<boolean> {
  if (!mediaId) return false;

  try {
    const userId = await getUserIdFromCookies();

    const { data, error } = await supabase
      .from("media_likes")
      .select("media_id")
      .eq("media_id", mediaId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("checkHasLikedMedia error", error);
      throw error;
    }

    return !!data;
  } catch (err) {
    // Not logged in or any error → treat as not liked
    console.warn("checkHasLikedMedia fallback (not liked)", err);
    return false;
  }
}

// lib/actions/social.ts
export async function toggleAdLike(
  adId: number
): Promise<{ liked: boolean; likeCount: number | null }> {
  const userId = await getUserIdFromCookies();

  // Does a like already exist?
  const { data: existing, error: existingError } = await supabase
    .from("ad_likes")
    .select("ad_id")
    .eq("ad_id", adId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("toggleAdLike existingError", existingError);
    throw new Error(existingError.message);
  }

  let liked: boolean;

  if (existing) {
    // Unlike
    const { error: delError } = await supabase
      .from("ad_likes")
      .delete()
      .eq("ad_id", adId)
      .eq("user_id", userId);

    if (delError) {
      console.error("toggleAdLike delete error", delError);
      throw new Error(delError.message);
    }
    liked = false;
  } else {
    // Like
    const { error: insError } = await supabase
      .from("ad_likes")
      .insert({ ad_id: adId, user_id: userId });

    if (insError) {
      console.error("toggleAdLike insert error", insError);
      throw new Error(insError.message);
    }
    liked = true;
  }

  // Fetch the updated like_count from ads table
  const { data: adRow, error: adError } = await supabase
    .from("ads")
    .select("like_count")
    .eq("id", adId)
    .single();

  if (adError) {
    console.error("toggleAdLike ads like_count error", adError);
    return { liked, likeCount: null };
  }

  return {
    liked,
    likeCount: adRow.like_count as number,
  };
}




// lib/actions/social.ts
export async function checkHasLikedAd(adId: number): Promise<boolean> {
  if (!adId) return false;

  try {
    const userId = await getUserIdFromCookies();

    const { data, error } = await supabase
      .from("ad_likes")
      .select("ad_id")
      .eq("ad_id", adId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("checkHasLikedAd error", error);
      throw error;
    }

    return !!data;
  } catch (err) {
    // Not logged in or any error → treat as not liked
    console.warn("checkHasLikedAd fallback (not liked)", err);
    return false;
  }
}

// lib/actions/auth.ts (or wherever the old function lived)


export async function getUserProfileByUsername(username: string): Promise<{
  id: string | null;
  username: string | null;
  avatarUrl: string | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", username)
    .single();

  if (error || !data) {
    console.error("getUserProfileByUsername error", error);
    return { id: null, username: null, avatarUrl: null };
  }
  
  return {
    id: data.id as string,
    username: data.username as string,
    avatarUrl: data.avatar_url,
  };
}

// lib/actions/social.ts (where FollowCounts + getMyFollowCounts used to be)


export type FollowCounts = {
  followers: number;
  following: number;
  views: number;
};

export async function getFollowCountsByUsername(
  username: string
): Promise<FollowCounts> {
  const userId = await getUserIdByUsername(username);
  if (!userId) {
    return { followers: 0, following: 0, views: 0 };
  }

  try {
    const [
      { count: followersCount, error: followersError },
      { count: followingCount, error: followingError },
      { data: mediaRows, error: mediaError },
    ] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
      supabase
        .from("media")
        .select("view_count")
        .eq("owner_id", userId),
    ]);

    if (followersError) {
      console.error("getFollowCountsByUsername followersError", followersError);
    }
    if (followingError) {
      console.error("getFollowCountsByUsername followingError", followingError);
    }
    if (mediaError) {
      console.error("getFollowCountsByUsername mediaError", mediaError);
    }

    const viewsTotal = (mediaRows ?? []).reduce(
      (sum, row: any) => sum + (row.view_count ?? 0),
      0
    );

    return {
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
      views: viewsTotal,
    };
  } catch (err) {
    console.error("getFollowCountsByUsername thrown error", err);
    return { followers: 0, following: 0, views: 0 };
  }
}
