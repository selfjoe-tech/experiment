"use server";

import { supabase } from "@/lib/supabaseClient";
import { revalidatePath } from "next/cache";

export async function renewAdBuyer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const { data, error } = await supabase
    .from("ad_buyers")
    .update({
      payment_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString(),
      status: "renewed",
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("renewAdBuyer error", error);
    return;
  }

  revalidatePath("/admin/ads");
}

export async function addAdBuyer(formData: FormData) {
  const rawUsername = String(formData.get("username") ?? "").trim();
  const username = rawUsername.replace(/^@/, ""); // <- strip leading @
  const slot = Number(formData.get("slot") ?? "1");

  if (!username) return;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .single();

  if (profileErr || !profile) {
    console.error("User not found", profileErr);
    return;
  }

  const paymentDate = new Date();
  const expiresAt = new Date(
    paymentDate.getTime() + 33 * 24 * 60 * 60 * 1000
  );

  const { error } = await supabase.from("ad_buyers").insert({
    user_id: profile.id,
    advertiser_slot: slot,
    payment_date: paymentDate.toISOString(),
    expires_at: expiresAt.toISOString(),
    status: "renewed",
  });

  if (error) {
    console.error("addAdBuyer error", error);
  }

  revalidatePath("/admin/ads");
}