"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deleteR2Object, r2KeyFromPublicUrl } from "@/lib/server/r2";

const MEDIA_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET ?? "media";
const VERIFICATION_BUCKET = "verification";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function removeFolderRecursively(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  prefix: string,
  depth = 0
): Promise<void> {
  if (depth > 8) {
    throw new Error(`Storage folder nesting is unexpectedly deep: ${prefix}`);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, offset: 0 });

  if (error) {
    if (/not found|does not exist/i.test(error.message)) return;
    throw new Error(`Could not list ${bucket}/${prefix}: ${error.message}`);
  }

  if (!data?.length) return;

  const files: string[] = [];

  for (const item of data) {
    const path = `${prefix}/${item.name}`;

    // Storage returns directory entries without an object id.
    if (item.id == null) {
      await removeFolderRecursively(supabase, bucket, path, depth + 1);
    } else {
      files.push(path);
    }
  }

  if (files.length) {
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(files);

    if (removeError) {
      throw new Error(
        `Could not remove files from ${bucket}/${prefix}: ${removeError.message}`
      );
    }
  }
}

async function removeExactStoragePaths(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  paths: Array<string | null | undefined>
) {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  const legacy: string[] = [];
  for (const path of uniquePaths) {
    if (path.startsWith("r2-private:")) {
      await deleteR2Object(path.slice("r2-private:".length), true);
      continue;
    }
    const key = r2KeyFromPublicUrl(path);
    if (key) {
      await deleteR2Object(key);
      continue;
    }
    if (/^https?:\/\//i.test(path)) {
      // Do not delete unrecognized external assets.
      continue;
    }
    legacy.push(path);
  }
  if (!legacy.length) return;
  const { error } = await supabase.storage.from(bucket).remove(legacy);
  if (error) throw new Error(`Could not remove files from ${bucket}: ${error.message}`);
}

export async function deleteUser(userId: string) {
  await requireAdmin();

  const id = String(userId ?? "").trim();
  if (!UUID.test(id)) {
    return { ok: false, error: "Invalid user ID." };
  }

  const supabase = getSupabaseAdmin();

  try {
    // Capture non-user-folder object paths before deleting the associated rows.
    const [mediaRows, adRows, verificationRows, profileRow] = await Promise.all([
      supabase.from("media").select("storage_path").eq("owner_id", id),
      supabase.from("ads").select("storage_path").eq("owner_id", id),
      supabase
        .from("verify")
        .select("storage_path, selfie_path")
        .eq("creator_id", id),
      supabase.from("profiles").select("avatar_url").eq("id", id).maybeSingle(),
    ]);

    for (const result of [mediaRows, adRows, verificationRows, profileRow]) {
      if (result.error) throw new Error(result.error.message);
    }

    await Promise.all([
      removeFolderRecursively(supabase, MEDIA_BUCKET, `videos/${id}`),
      removeFolderRecursively(supabase, MEDIA_BUCKET, `images/${id}`),
      removeFolderRecursively(supabase, MEDIA_BUCKET, `avatars/${id}`),
      removeFolderRecursively(supabase, MEDIA_BUCKET, `ads/${id}`),
      // Legacy verification uploads were stored in the public media bucket.
      removeFolderRecursively(
        supabase,
        MEDIA_BUCKET,
        `verify-selfies/${id}`
      ),
      removeFolderRecursively(
        supabase,
        VERIFICATION_BUCKET,
        `verify-selfies/${id}`
      ),
    ]);

    await Promise.all([
      removeExactStoragePaths(
        supabase,
        MEDIA_BUCKET,
        mediaRows.data?.map((row) => row.storage_path) ?? []
      ),
      removeExactStoragePaths(supabase, MEDIA_BUCKET, [profileRow.data?.avatar_url]),
      removeExactStoragePaths(
        supabase,
        MEDIA_BUCKET,
        adRows.data?.map((row) => row.storage_path) ?? []
      ),
      removeExactStoragePaths(
        supabase,
        VERIFICATION_BUCKET,
        (verificationRows.data ?? []).flatMap((row) => [
          row.storage_path,
          row.selfie_path,
        ])
      ),
      // Older verification files lived in the public media bucket.
      removeExactStoragePaths(
        supabase,
        MEDIA_BUCKET,
        (verificationRows.data ?? []).flatMap((row) => [
          row.storage_path,
          row.selfie_path,
        ])
      ),
    ]);

    // Remove ads explicitly: their owner_id FK is ON DELETE SET NULL.
    const { error: adsError } = await supabase
      .from("ads")
      .delete()
      .eq("owner_id", id);
    if (adsError) throw new Error(adsError.message);

    // Deleting the profile cascades likes, follows, media, verification,
    // ad-buyer slots, earnings, payout requests and affiliate requests.
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);
    if (profileError) throw new Error(profileError.message);

    // The database currently does not yet have the profiles -> auth.users FK,
    // so remove the Auth identity explicitly after its profile has been removed.
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError && !/not found|does not exist/i.test(authError.message)) {
      throw new Error(authError.message);
    }

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    console.error("deleteUser failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not delete this account completely.",
    };
  }
}
