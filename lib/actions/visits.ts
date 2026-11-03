"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function incrementCreatorVisit(username: string) {
  const normalized = String(username ?? "").trim();
  if (!normalized) return { ok: false };

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("increment_creator_visit", {
    p_username: normalized,
  });

  if (error) {
    console.error("incrementCreatorVisit error", error);
    return { ok: false };
  }

  return { ok: true };
}
