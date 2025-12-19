// lib/actions/settingsLinks.ts
"use server";

import { revalidatePath } from "next/cache";
import { PROVIDER_KEYS, type ProviderKey } from "@/app/components/verify/providers";

// ⚠️ Swap this import to match your project’s server Supabase client helper
import { supabase } from "../supabaseClient";
import { getUserIdFromCookies } from "./auth";

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateProfileLinks(input: Record<string, string>) {
  const id = await getUserIdFromCookies();
  console.log(id, "<<<<< id")

  if (!id) throw new Error("Not signed in.");

  // Pull verified + username from DB (server-side truth)
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, verified")
    .eq("id", id)
    .single();

  if (pErr || !profile) throw new Error("Profile not found.");
  if (!profile.verified) throw new Error("Only verified creators can edit links.");

  // Sanitize & whitelist keys
  const cleaned: Partial<Record<ProviderKey, string>> = {};

  for (const key of PROVIDER_KEYS) {
    const raw = (input[key] ?? "").trim();
    if (!raw) continue;

    if (!isValidHttpUrl(raw)) {
      throw new Error(`Invalid URL for ${key}. Use http(s)://`);
    }

    cleaned[key] = raw;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ links: cleaned })
    .eq("id", id);

  if (upErr) throw new Error("Failed to update links.");

  // Revalidate settings + profile page
  revalidatePath("/settings");
  if (profile.username) revalidatePath(`/${profile.username}`);

  return { ok: true, links: cleaned };
}
