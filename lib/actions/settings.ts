  "use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import { getUserIdFromCookies, getUserProfileFromCookies, setAuthCookies } from "./auth";
// make sure setAuthCookies & getUserIdFromCookies & getUserProfileFromCookies are already here


// SETTINGS TYPES
export type SettingsProfile = {
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type SettingsFieldErrors = {
  username?: string;
  bio?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

// Get data for /settings page
export async function getSettingsProfile(): Promise<SettingsProfile | null> {


  const userId = await getUserIdFromCookies();
  if (!userId) return null;

  const { username, avatarUrl } = await getUserProfileFromCookies();

  const { data, error } = await supabase
    .from("profiles")
    .select("bio")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getSettingsProfile error", error);
  }

  return {
    username,
    avatarUrl,
    bio: data?.bio ?? null,
  };
}

// Update username + bio
export async function updateProfileBasicsAction(
  formData: FormData
): Promise<{ success: boolean; fieldErrors?: SettingsFieldErrors; message?: string }> {
  "use server";

  const userId = await getUserIdFromCookies();
  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  const rawUsername = (formData.get("username") ?? "").toString().trim();
  const bio = (formData.get("bio") ?? "").toString().trim();

  const fieldErrors: SettingsFieldErrors = {};

  if (!rawUsername) {
    fieldErrors.username = "Username is required.";
  }

  const username = rawUsername.toLowerCase();
  const usernameRegex = /^[a-z0-9._]+$/;

  if (rawUsername && !usernameRegex.test(username)) {
    fieldErrors.username =
      "Only lowercase letters, numbers, '.' and '_' are allowed.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  // Fetch current username
  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (currentError || !current) {
    console.error("updateProfileBasicsAction fetch current error", currentError);
    return { success: false, message: "Could not load current profile." };
  }

  // If username changed, ensure it's unique
  if (current.username !== username) {
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingError) {
      console.error("updateProfileBasicsAction uniqueness error", existingError);
      return { success: false, message: "Failed to validate username." };
    }

    if (existing && existing.id !== userId) {
      return {
        success: false,
        fieldErrors: { username: "This username is already taken." },
      };
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      username,
      bio,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("updateProfileBasicsAction update error", updateError);
    return { success: false, message: "Failed to update profile." };
  }

  // Keep cookies in sync
  const store = await cookies();
  const avatarPath = store.get("avatar")?.value ?? "";
  await setAuthCookies(userId, username, avatarPath);

  revalidatePath("/");
  return { success: true };
}

// Update avatar (upload + update profile + cookies)
export async function updateAvatarAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; avatarUrl?: string }> {
  "use server";

  const userId = await getUserIdFromCookies();
  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "Please choose an image file." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media") // adjust if you use a different bucket for avatars
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    console.error("updateAvatarAction upload error", uploadError);
    return { success: false, message: "Failed to upload avatar." };
  }

  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("updateAvatarAction profile update error", updateError);
    return { success: false, message: "Failed to save avatar." };
  }

  const store = await cookies();
  store.set("avatar", path, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/");
  return { success: true, avatarUrl: publicUrl };
}

// Change password
export async function changePasswordAction(
  formData: FormData
): Promise<{ success: boolean; fieldErrors?: SettingsFieldErrors; message?: string }> {
  "use server";

  const userId = await getUserIdFromCookies();
  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  const oldPassword = (formData.get("oldPassword") ?? "").toString();
  const newPassword = (formData.get("newPassword") ?? "").toString();
  const confirmPassword = (formData.get("confirmPassword") ?? "").toString();

  const fieldErrors: SettingsFieldErrors = {};

  if (!oldPassword) fieldErrors.oldPassword = "Please enter your current password.";
  if (!newPassword) fieldErrors.newPassword = "Please enter a new password.";
  if (newPassword && newPassword.length < 6) {
    fieldErrors.newPassword = "New password must be at least 6 characters.";
  }
  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("hash")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    console.error("changePasswordAction profile error", error);
    return { success: false, message: "Could not load your account." };
  }

  const match = await bcrypt.compare(oldPassword, profile.hash);
  if (!match) {
    return {
      success: false,
      fieldErrors: { oldPassword: "Current password is incorrect." },
    };
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ hash: newHash })
    .eq("id", userId);

  if (updateError) {
    console.error("changePasswordAction update error", updateError);
    return { success: false, message: "Failed to change password." };
  }

  return { success: true };
}

// Delete account + uploads
export async function deleteAccountAction(): Promise<{ success: boolean; message?: string }> {
  "use server";

  const userId = await getUserIdFromCookies();
  if (!userId) {
    return { success: false, message: "You must be logged in." };
  }

  try {
    // Delete all media owned by user
    const { error: mediaError } = await supabase
      .from("media")
      .delete()
      .eq("owner_id", userId);

    if (mediaError) {
      console.error("deleteAccountAction media error", mediaError);
      return { success: false, message: "Failed to remove your uploads." };
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("deleteAccountAction profile error", profileError);
      return { success: false, message: "Failed to delete account." };
    }

    // Clear cookies
    const store = await cookies();
    ["userId", "isLoggedIn", "username", "avatar", "preferences"].forEach((k) =>
      store.delete(k)
    );

    return { success: true };
  } catch (err) {
    console.error("deleteAccountAction thrown error", err);
    return { success: false, message: "Unexpected error deleting account." };
  }
}
