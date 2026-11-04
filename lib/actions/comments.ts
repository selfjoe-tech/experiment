"use server";

import { createClient } from "@/lib/supabase/server";

export type CommentNode = {
  id: string;
  username: string;
  avatar_path: string;
  comment: string;
  likes: number;
  liked_by?: string[];
  replies: CommentNode[];
  verified: boolean;
};

function ensureArray(value: unknown): CommentNode[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as CommentNode[];
  return [value as CommentNode];
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be logged in.");
  }

  return supabase;
}

export async function fetchCommentsForMedia(
  mediaId: number
): Promise<CommentNode[]> {
  if (!mediaId) return [];

  const supabase = await createClient();
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

export async function addCommentForMedia(options: {
  mediaId: number;
  text: string;
  parentId?: string | null;
}): Promise<CommentNode[]> {
  const mediaId = Number(options.mediaId);
  const text = String(options.text ?? "").trim();
  const parentId = options.parentId?.trim() || null;

  if (!Number.isSafeInteger(mediaId) || mediaId <= 0) {
    throw new Error("Invalid media ID.");
  }

  if (!text) return [];
  if (text.length > 5000) {
    throw new Error("Comment must be 5,000 characters or fewer.");
  }

  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc("add_media_comment", {
    p_media_id: mediaId,
    p_comment: text,
    p_parent_id: parentId,
  });

  if (error) {
    console.error("addCommentForMedia RPC error", error);
    throw new Error(error.message || "Failed to post comment.");
  }

  return ensureArray(data);
}

export async function toggleCommentLikeForMedia(
  mediaId: number,
  commentId: string
): Promise<CommentNode[]> {
  if (!Number.isSafeInteger(mediaId) || mediaId <= 0 || !commentId?.trim()) {
    throw new Error("Invalid media or comment ID.");
  }

  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc("toggle_media_comment_like", {
    p_media_id: mediaId,
    p_comment_id: commentId.trim(),
  });

  if (error) {
    console.error("toggleCommentLikeForMedia RPC error", error);
    throw new Error(error.message || "Failed to update comment like.");
  }

  return ensureArray(data);
}
