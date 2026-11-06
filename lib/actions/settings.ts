"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getPublicProfileSeo, absoluteSeoUrl } from "@/lib/server/publicSeo";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { deliverIndexNowBatch } from "@/lib/server/indexNow";
import { createClient } from "@/lib/supabase/server";

export type SettingsProfile = {
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
};

export type SettingsFieldErrors = {
  username?: string;
  bio?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  verified: boolean;
};

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { supabase, user };
}

export async function getSettingsProfile(): Promise<SettingsProfile | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("username, avatar_url, bio, verified")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getSettingsProfile error", error);
    return null;
  }

  return {
    username: data.username,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    verified: Boolean(data.verified),
  };
}

export async function updateProfileBasicsAction(
  formData: FormData
): Promise<{
  success: boolean;
  fieldErrors?: SettingsFieldErrors;
  message?: string;
}> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return { success: false, message: "You must be logged in." };
  }

  const rawUsername = String(formData.get("username") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const username = rawUsername.toLowerCase();

  const fieldErrors: SettingsFieldErrors = { verified: false };

  if (!username) fieldErrors.username = "Username is required.";
  if (rawUsername && !/^[a-z0-9._]{1,30}$/.test(username)) {
    fieldErrors.username =
      "Use 1–30 lowercase letters, numbers, '.' and '_'.";
  }

  if (bio.length > 500) {
    fieldErrors.bio = "Bio must be 500 characters or fewer.";
  }

  if (fieldErrors.username || fieldErrors.bio) {
    return { success: false, fieldErrors };
  }

  const { data: current, error: currentError } = await auth.supabase
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .single();

  if (currentError || !current) {
    console.error("updateProfileBasicsAction current profile error", currentError);
    return { success: false, message: "Could not load your profile." };
  }

  if (current.username !== username) {
    const { data: existing, error: existingError } = await auth.supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingError) {
      console.error("updateProfileBasicsAction username lookup error", existingError);
      return { success: false, message: "Failed to validate username." };
    }

    if (existing && existing.id !== auth.user.id) {
      return {
        success: false,
        fieldErrors: {
          verified: false,
          username: "This username is already taken.",
        },
      };
    }
  }

  const { error: updateError } = await auth.supabase
    .from("profiles")
    .update({ username, bio })
    .eq("id", auth.user.id);

  if (updateError) {
    console.error("updateProfileBasicsAction update error", updateError);
    return { success: false, message: "Failed to update your profile." };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/creators");
  revalidatePath("/"+encodeURIComponent(username));
  if(current.username!==username)
    revalidatePath("/"+encodeURIComponent(current.username));
  after(async()=>{
    try {
      const profile=await getPublicProfileSeo(username);
      if(!profile||profile.id!==auth.user.id)return;
      const admin=getSupabaseAdmin();
      const url=absoluteSeoUrl("/"+encodeURIComponent(username));
      const {data,error}=await admin.from("seo_discovery_events").upsert({
        canonical_url:url,kind:"profile",status:"queued",attempts:0,
        updated_at:new Date().toISOString(),last_error:null,
      },{onConflict:"canonical_url"}).select("id").single();
      if(error)throw error;
      await deliverIndexNowBatch([data.id]);
    } catch(error) {
      console.error("Profile discovery notification failed:",error);
    }
  });
  return { success: true };
}

export async function updateAvatarAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; avatarUrl?: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return { success: false, message: "You must be logged in." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Please choose an image file." };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, message: "Choose a JPG, PNG, WEBP or AVIF image." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, message: "Avatar must be 5 MB or smaller." };
  }

  const extByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const path = `avatars/${auth.user.id}/${crypto.randomUUID()}.${extByType[file.type]}`;

  const { error: uploadError } = await auth.supabase.storage
    .from("media")
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("updateAvatarAction upload error", uploadError);
    return {
      success: false,
      message: "Failed to upload your avatar. Please try again.",
    };
  }

  const { data: urlData } = auth.supabase.storage
    .from("media")
    .getPublicUrl(path);

  const { error: updateError } = await auth.supabase
    .from("profiles")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", auth.user.id);

  if (updateError) {
    console.error("updateAvatarAction profile update error", updateError);
    await auth.supabase.storage.from("media").remove([path]);
    return { success: false, message: "Failed to save your avatar." };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return { success: true, avatarUrl: urlData.publicUrl };
}

export async function changePasswordAction(
  formData: FormData
): Promise<{
  success: boolean;
  fieldErrors?: SettingsFieldErrors;
  message?: string;
}> {
  const auth = await getAuthenticatedClient();
  if (!auth || !auth.user.email) {
    return { success: false, message: "You must be logged in." };
  }

  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: SettingsFieldErrors = { verified: false };

  if (!oldPassword) {
    fieldErrors.oldPassword = "Please enter your current password.";
  }
  if (!newPassword) {
    fieldErrors.newPassword = "Please enter a new password.";
  } else if (newPassword.length < 6) {
    fieldErrors.newPassword = "New password must be at least 6 characters.";
  }
  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (
    fieldErrors.oldPassword ||
    fieldErrors.newPassword ||
    fieldErrors.confirmPassword
  ) {
    return { success: false, fieldErrors };
  }

  // Re-authenticate with the current password before changing credentials.
  const { error: reauthError } = await auth.supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: oldPassword,
  });

  if (reauthError) {
    return {
      success: false,
      fieldErrors: {
        verified: false,
        oldPassword: "Current password is incorrect.",
      },
    };
  }

  const { error: updateError } = await auth.supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("changePasswordAction update error", updateError);
    return { success: false, message: "Failed to change your password." };
  }

  return { success: true };
}

export async function deleteAccountAction(): Promise<{
  success: boolean;
  message?: string;
}> {
  // Account deletion needs a coordinated cleanup of media, verification
  // objects, financial records and the Auth user. It is intentionally not
  // performed through the old client-side profile deletion flow.
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return { success: false, message: "You must be logged in." };
  }

  return {
    success: false,
    message:
      "Account deletion is temporarily unavailable while account migration is being completed. Contact support to request deletion.",
  };
}
