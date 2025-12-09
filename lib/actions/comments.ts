// /lib/actions/comments.ts
"use server";

import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import { getUserProfileFromCookies, getUserIdFromCookies } from "@/lib/actions/auth";

export type CommentNode = {
  id: string;
  username: string;
  avatar_path: string;      // we store the final URL here
  comment: string;
  likes: number;
  liked_by?: string[];      // userIds who liked the comment
  replies: CommentNode[];
};

/** Safely normalize whatever is in media.comments into an array of CommentNode */
function ensureArray(value: any): CommentNode[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as CommentNode[];
  return [value as CommentNode];
}

/** Recursively add a reply under the comment matching parentId */
function addReplyRecursive(
  nodes: CommentNode[],
  parentId: string,
  reply: CommentNode
): CommentNode[] {
  return nodes.map((c) => {
    if (c.id === parentId) {
      return {
        ...c,
        replies: [...(c.replies ?? []), reply],
      };
    }
    return {
      ...c,
      replies: addReplyRecursive(c.replies ?? [], parentId, reply),
    };
  });
}

/** Recursively toggle like for a comment by id + userId */
function toggleLikeRecursive(
  nodes: CommentNode[],
  targetId: string,
  userId: string
): { updated: CommentNode[]; found: boolean } {
  let found = false;

  const updated = nodes.map((c) => {
    if (c.id === targetId) {
      const likedBy = Array.isArray(c.liked_by) ? [...c.liked_by] : [];
      const hasLiked = likedBy.includes(userId);
      let likes = c.likes ?? 0;

      if (hasLiked) {
        // unlike
        likes = Math.max(0, likes - 1);
        const idx = likedBy.indexOf(userId);
        if (idx >= 0) likedBy.splice(idx, 1);
      } else {
        // like
        likes = likes + 1;
        likedBy.push(userId);
      }

      found = true;
      return { ...c, likes, liked_by: likedBy };
    }

    const child = toggleLikeRecursive(c.replies ?? [], targetId, userId);
    if (child.found) found = true;

    return { ...c, replies: child.updated };
  });

  return { updated, found };
}

/* =========================================================
 * FETCH COMMENTS FOR A MEDIA ITEM
 * =======================================================*/

export async function fetchCommentsForMedia(mediaId: number): Promise<CommentNode[]> {
  if (!mediaId) return [];

  const { data, error } = await supabase
    .from("media")
    .select("comments")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    console.error("fetchCommentsForMedia error", error);
    throw error;
  }

  return ensureArray(data?.comments);
}

/* =========================================================
 * ADD COMMENT / REPLY
 * =======================================================*/

export async function addCommentForMedia(options: {
  mediaId: number;
  text: string;
  parentId?: string | null;
}): Promise<CommentNode[]> {
  const { mediaId, text, parentId } = options;
  const trimmed = text.trim();
  if (!mediaId || !trimmed) return [];

  // ✅ Use your auth helper for username + avatarUrl + isLoggedIn
  const [{ username, avatarUrl, isLoggedIn }, userId] = await Promise.all([
    getUserProfileFromCookies(),
    getUserIdFromCookies(),
  ]);

  if (!isLoggedIn || !username || !userId) {
    throw new Error("You must be logged in to comment.");
  }

  const { data, error } = await supabase
    .from("media")
    .select("comments")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    console.error("addCommentForMedia fetch error", error);
    throw error;
  }

  const existing = ensureArray(data?.comments);

  const newNode: CommentNode = {
    id: uuidv4(),
    username,
    avatar_path: avatarUrl ?? "/avatar-placeholder.png",   // store the resolved URL here
    comment: trimmed,
    likes: 0,
    liked_by: [],
    replies: [],
  };

  const updatedComments = parentId
    ? addReplyRecursive(existing, parentId, newNode)
    : [...existing, newNode];

  const { error: updateError } = await supabase
    .from("media")
    .update({ comments: updatedComments })
    .eq("id", mediaId);

  if (updateError) {
    console.error("addCommentForMedia update error", updateError);
    throw updateError;
  }

  return updatedComments;
}

/* =========================================================
 * TOGGLE LIKE ON A COMMENT
 * =======================================================*/

export async function toggleCommentLikeForMedia(
  mediaId: number,
  commentId: string
): Promise<CommentNode[]> {
  if (!mediaId || !commentId) return [];

  // still need userId to enforce one-like-per-user
  const userId = await getUserIdFromCookies();
  if (!userId) {
    throw new Error("You must be logged in to like comments.");
  }

  const { data, error } = await supabase
    .from("media")
    .select("comments")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) {
    console.error("toggleCommentLikeForMedia fetch error", error);
    throw error;
  }

  const existing = ensureArray(data?.comments);
  const { updated } = toggleLikeRecursive(existing, commentId, userId);

  const { error: updateError } = await supabase
    .from("media")
    .update({ comments: updated })
    .eq("id", mediaId);

  if (updateError) {
    console.error("toggleCommentLikeForMedia update error", updateError);
    throw updateError;
  }

  return updated;
}
