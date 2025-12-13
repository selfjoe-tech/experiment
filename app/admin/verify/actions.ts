"use server";

import { supabase } from "@/lib/supabaseClient";
import { revalidatePath } from "next/cache";

export async function approveVerification(formData: FormData) {
  const requestId = String(formData.get("requestId"));
  const userId = String(formData.get("userId"));

  console.log(userId)
  console.log(requestId)

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
  const requestId = String(formData.get("requestId"));
  const reason = String(formData.get("reason") ?? "");

  console.log(requestId, "reques<<<<<<<<<<<<")

  if (!requestId) return;

  await supabase
    .from("verify")
    .update({ status: "rejected", review_notes: reason })
    .eq("id", requestId);

  revalidatePath("/admin/verify");
}
