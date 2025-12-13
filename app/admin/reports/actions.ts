"use server";

import { supabase } from "@/lib/supabaseClient";
import { revalidatePath } from "next/cache";

const MEDIA_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET ?? "media";

export async function removeMediaFromReport(formData: FormData) {
  const reportId = Number(formData.get("reportId"));
  const mediaId = Number(formData.get("mediaId"));

  if (!reportId || !mediaId) return;

  // 1) Get storage_path from media row
  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", mediaId)
    .single();

  if (mediaError) {
    console.error("Failed to load media for deletion", mediaError);
  } else if (media?.storage_path) {
    // 2) Delete from storage bucket
    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([media.storage_path]);

    if (storageError) {
      console.error("Failed to delete media from storage", storageError);
    }
  }

  // 3) Delete row from media table
  const { error: deleteError } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId);

  if (deleteError) {
    console.error("Failed to delete media row", deleteError);
  }

  // 4) Update report status
  const { error: reportError } = await supabase
    .from("reports")
    .update({ status: "media removed" })
    .eq("id", reportId);

  if (reportError) {
    console.error("Failed to update report status", reportError);
  }

  revalidatePath("/admin/reports");
}

export async function ignoreReport(formData: FormData) {
  const reportId = Number(formData.get("reportId"));
  if (!reportId) return;

  const { error } = await supabase
    .from("reports")
    .update({ status: "ignored" })
    .eq("id", reportId);

  if (error) {
    console.error("Failed to update report status to ignored", error);
  }

  revalidatePath("/admin/reports");
}
