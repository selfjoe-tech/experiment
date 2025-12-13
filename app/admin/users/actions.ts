// app/admin/users/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";

const MEDIA_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET ?? "media";

async function deleteUserFolder(prefix: string) {
  // List all files in this "folder"
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(prefix, {
      limit: 1000,
      offset: 0,
    });

  if (error) {
    console.error(`deleteUserFolder: list failed for ${prefix}`, error);
    return;
  }

  if (!data || data.length === 0) return;

  const paths = data.map((file) => `${prefix}/${file.name}`);

  const { error: removeError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove(paths);

  if (removeError) {
    console.error(`deleteUserFolder: remove failed for ${prefix}`, removeError);
  }
}

export async function deleteUser(userId: string) {
  if (!userId) return;

  try {
    // 1) Delete media DB rows
    await supabase.from("media").delete().eq("owner_id", userId);
    await supabase.from("verify").delete().eq("creator_id", userId);
    await supabase.from("ad_buyers").delete().eq("user_id", userId);

    // 2) Delete files from storage: videos/[id] and images/[id]
    await deleteUserFolder(`videos/${userId}`);
    await deleteUserFolder(`images/${userId}`);

    // 3) Delete profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileErr) {
      console.error("deleteUser: failed to delete profile", profileErr);
    }
  } catch (err) {
    console.error("deleteUser: unexpected error", err);
  }

  revalidatePath("/admin/users");
}
