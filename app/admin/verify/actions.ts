"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { revalidatePath } from "next/cache";

export async function approveVerification(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const requestId = String(formData.get("requestId"));
  const userId = String(formData.get("userId"));

  
  if (!requestId || !userId) return;

  await supabase
    .from("profiles")
    .update({ verified: true })
    .eq("id", userId);

  await supabase
    .from("verify")
    .update({ status: "accepted" })
    .eq("id", requestId);

  revalidatePath("/admin/verify");
}

export async function rejectVerification(formData: FormData) {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const requestId = String(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "");

  
  if (!requestId) return;

  await supabase
    .from("verify")
    .update({ status: "rejected", review_notes: reason })
    .eq("id", requestId);

  revalidatePath("/admin/verify");
}
