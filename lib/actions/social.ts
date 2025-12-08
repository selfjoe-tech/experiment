// lib/actions/social.ts
import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCookies } from "./auth";



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

