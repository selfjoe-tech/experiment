"use server";

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ProfileSeo = {
  username: string;
  verified: boolean;
  avatarUrl: string | null;
};

export const getProfileSeoByUsername = cache(async (usernameRaw: string): Promise<ProfileSeo | null> => {
  const username = (usernameRaw ?? "").trim();
  if (!username) return null;

  const supabase = getSupabaseAdmin();

  // Try common avatar column names (your project has used avatarUrl in actions)
  const { data, error } = await supabase
    .from("profiles")
    .select("username, verified, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) return null;

  const avatarUrl =
    (data as any).avatar_url ??
    (data as any).avatarUrl ??
    (data as any).avatar ??
    null;

  return {
    username: (data as any).username ?? username,
    verified: !!(data as any).verified,
    avatarUrl,
  };
});
