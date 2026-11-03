"use server";

import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ProfileSeo = {
  username: string;
  verified: boolean;
  avatarUrl: string | null;
};

export const getProfileSeoByUsername = cache(
  async (usernameRaw: string): Promise<ProfileSeo | null> => {
    const username = String(usernameRaw ?? "").trim();
    if (!username) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("username, verified, avatar_url")
      .eq("username", username)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("getProfileSeoByUsername error", error);
      return null;
    }

    return {
      username: data.username,
      verified: Boolean(data.verified),
      avatarUrl: data.avatar_url ?? null,
    };
  }
);
