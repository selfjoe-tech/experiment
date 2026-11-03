"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROVIDER_KEYS, type ProviderKey } from "@/app/components/verify/providers";

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateProfileLinks(input: Record<string, string>) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not signed in.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, verified")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profile not found.");
  }

  if (!profile.verified) {
    throw new Error("Only verified creators can edit links.");
  }

  const cleaned: Partial<Record<ProviderKey, string>> = {};

  for (const key of PROVIDER_KEYS) {
    const raw = String(input[key] ?? "").trim();
    if (!raw) continue;

    if (!isValidHttpUrl(raw)) {
      throw new Error(`Invalid URL for ${key}. Use http(s)://`);
    }

    cleaned[key] = raw;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ links: cleaned })
    .eq("id", user.id);

  if (updateError) {
    console.error("updateProfileLinks update error", updateError);
    throw new Error("Failed to update links.");
  }

  revalidatePath("/settings");
  if (profile.username) revalidatePath(`/${profile.username}`);

  return { ok: true, links: cleaned };
}
