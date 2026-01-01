"use server";

import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  // Use service role so this works even for logged-out viewers
  // Never expose this key to the browser.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function incrementCreatorVisit(username: string) {
  const u = username.trim();
  if (!u) return { ok: false };

  const supabase = supabaseAdmin();
  const { error } = await supabase.rpc("increment_creator_visit", { p_username: u });
  if (error) {
    console.error("incrementCreatorVisit error", error);
    return { ok: false };
  }
  return { ok: true };
}
