// app/auth/actions.ts
"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import nodemailer from "nodemailer";
import { revalidatePath } from "next/cache";




const USERNAME_REGEX = /^[a-z0-9._]+$/;

export type AuthFieldErrors = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  identifier?: string;
};

export type AuthResult = {
  success: boolean;
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export type ForgotPasswordFieldErrors = {
  email?: string;
  otp?: string;
  password?: string;
  confirmPassword?: string;
};

const ALLOWED_PREFERENCES = [
  "straight",
  "gay",
  "bisexual",
  "trans",
  "lesbian",
  "animated",
] as const;

type Preference = (typeof ALLOWED_PREFERENCES)[number];


function normalizePreferences(raw: string[] | null | undefined): Preference[] {
  if (!raw || !raw.length) return [];

  const lower = raw
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);

  const dedup = Array.from(new Set(lower));

  return ALLOWED_PREFERENCES.filter((pref) => dedup.includes(pref));
}


export async function sendOtpEmail(to: string, code: string) {
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER!;
  const fromName = process.env.SMTP_FROM_NAME ?? "Upskirt Candy";

  await smtpTransporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: "Reset your Upskirt Candy password",
    text: `Your one-time code is: ${code}\n\nIt expires in 5 minutes.`,
    html: `
      <p>Here is your one-time code to reset your password:</p>
      <p style="font-size: 20px; font-weight: bold;">${code}</p>
      <p>This code expires in 5 minutes.</p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `,
  });
}




export async function requestPasswordResetAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; fieldErrors?: ForgotPasswordFieldErrors }> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();

  const fieldErrors: ForgotPasswordFieldErrors = {};
  if (!email) {
    fieldErrors.email = "Email is required.";
    return { success: false, fieldErrors };
  }

  // 1) Check that email exists in profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    console.error("requestPasswordReset: profile lookup error", profileError);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  if (!profile) {
    // You *could* return success here to avoid user enumeration.
    fieldErrors.email = "No account found with that email.";
    return { success: false, fieldErrors };
  }


  
  // 2) Generate 6-digit OTP and hash it
  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // 3) Clear existing tokens for this email
  await supabase.from("password_reset_tokens").delete().eq("email", email);

  // 4) Insert new token
  const { error: insertError } = await supabase
    .from("password_reset_tokens")
    .insert({
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error("requestPasswordReset: insert token error", insertError);
    return { success: false, message: "Could not create reset token." };
  }

  // 5) Send email
  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    console.error("requestPasswordReset: email error", err);
    return {
      success: false,
      message: "Failed to send code. Please try again in a moment.",
    };
  }

  return {
    success: true,
    message: "We sent a 6-digit code to your email.",
  };
}



export async function resetPasswordWithOtpAction(
  formData: FormData
): Promise<{ success: boolean; message?: string; fieldErrors?: ForgotPasswordFieldErrors }> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const otp = (formData.get("otp") as string | null)?.trim();
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string | null) ?? "";

  const fieldErrors: ForgotPasswordFieldErrors = {};

  if (!email) fieldErrors.email = "Email is required.";
  if (!otp) fieldErrors.otp = "Code is required.";
  if (!password) fieldErrors.password = "New password is required.";
  if (password && password.length < 6)
    fieldErrors.password = "Password must be at least 6 characters.";
  if (password !== confirmPassword)
    fieldErrors.confirmPassword = "Passwords do not match.";

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  // 1) Get latest token for this email
  const { data: tokens, error: tokenError } = await supabase
    .from("password_reset_tokens")
    .select("id, otp_hash, expires_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  if (tokenError) {
    console.error("resetPasswordWithOtp: token lookup error", tokenError);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  const token = tokens?.[0];
  if (!token) {
    fieldErrors.otp = "Invalid or expired code.";
    return { success: false, fieldErrors };
  }

  // 2) Check expiry
  const expiresAt = new Date(token.expires_at);
  if (Date.now() > expiresAt.getTime()) {
    // delete expired token
    await supabase.from("password_reset_tokens").delete().eq("id", token.id);
    fieldErrors.otp = "Code has expired. Please request a new one.";
    return { success: false, fieldErrors };
  }

  // 3) Compare OTP
  const match = await bcrypt.compare(otp, token.otp_hash);
  if (!match) {
    fieldErrors.otp = "Incorrect code.";
    return { success: false, fieldErrors };
  }

  // 4) Hash new password and update profile.hash
  const newHash = await bcrypt.hash(password, 10);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ hash: newHash })
    .eq("email", email);

  if (updateError) {
    console.error("resetPasswordWithOtp: profile update error", updateError);
    return { success: false, message: "Failed to update password." };
  }

  // 5) Delete all tokens for this email
  await supabase.from("password_reset_tokens").delete().eq("email", email);

  return { success: true, message: "Your password has been reset. You can log in now." };
}










/* ---------- helpers ---------- */

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}
function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function setAuthCookies(
  userId: string,
   username: string, 
   avatar: string = "",
  verified: boolean = false,
  
  ) {
  const store = await cookies();
  store.set("userId", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  // readable from client JS for quick checks
  store.set("isLoggedIn", "true", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  store.set("username", username, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  store.set("verified", verified, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });



  if (avatar === "") {
      return ;
  } else {
    store.set("avatar", avatar, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  }

}

/* ---------- SIGNUP ---------- */

export async function signupAction(formData: FormData): Promise<AuthResult> {
  const rawUsername = String(formData.get("username") ?? "").trim();
  const rawEmail = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const username = normalizeUsername(rawUsername);
  const email = normalizeEmail(rawEmail);

  const fieldErrors: AuthFieldErrors = {};

  // username validation
  if (!username) {
    fieldErrors.username = "Username is required.";
  } else if (!USERNAME_REGEX.test(username)) {
    fieldErrors.username =
      "Use only lowercase letters, numbers, '.' and '_'."; // a-z0-9._ only
  }

  // email validation
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  // password validation
  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Please fix the errors and try again.",
      fieldErrors,
    };
  }

  // check username uniqueness
  const { data: byUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (byUsername) {
    return {
      success: false,
      message: "Username already in use.",
      fieldErrors: { username: "That username is already taken." },
    };
  }

  // check email uniqueness
  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (byEmail) {
    return {
      success: false,
      message: "Email already in use.",
      fieldErrors: { email: "An account with this email already exists." },
    };
  }

  // hash password
  const hash = await bcrypt.hash(password, 10);

  // create profile row
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({
      username,
      email,
      hash,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("signupAction insert error", error);
    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }

  await setAuthCookies(inserted.id, username);

  return { success: true };
}

/* ---------- LOGIN ---------- */

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const rawIdentifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: AuthFieldErrors = {};

  if (!rawIdentifier) {
    fieldErrors.identifier = "Enter your username or email.";
  }
  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Please fill in all fields.",
      fieldErrors,
    };
  }

  const identifier = rawIdentifier.toLowerCase();
  const isEmail = identifier.includes("@");

  const { data: user, error } = await supabase
    .from("profiles")
    .select("id, username, email, hash, avatar_url, verified")
    .eq(isEmail ? "email" : "username", identifier)
    .maybeSingle();

  if (error || !user || !user.hash) {
    console.error("loginAction user lookup error", error);
    return {
      success: false,
      message: "Invalid credentials.",
      fieldErrors: { identifier: "Account not found or invalid." },
    };
  }

  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) {
    return {
      success: false,
      message: "Invalid credentials.",
      fieldErrors: { password: "Incorrect password." },
    };
  }

  await setAuthCookies(user.id, user.username, user.avatar_url, user.verified);

  return { success: true };
}




export async function checkUsernameAvailability(
  raw: string
): Promise<{ available: boolean }> {
  const username = normalizeUsername(raw);

  // invalid or empty usernames are never "available" for our purposes
  if (!username || !USERNAME_REGEX.test(username)) {
    return { available: false };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("checkUsernameAvailability error", error);
    // safer to say "not available" on error
    return { available: false };
  }

  // available = no row with that username
  return { available: !data };
}

export async function getIsLoggedInFromCookies(): Promise<boolean> {
  const store = await cookies();
  const flag = store.get("isLoggedIn")?.value;
  return flag === "true";
}




export async function getUserIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  const userId = store.get("userId")?.value;
  return userId || null;
}

export async function getVerified(): Promise<string | null> {
  const store = await cookies();
  const verify = store.get("verified")?.value;
  return verify || null;
}


export type SimpleResult = { success: boolean };

export async function logoutAction(): Promise<SimpleResult> {
  const store = await cookies();

  // If you truly want to clear *all* cookies:
  const names = ["userId", "isLoggedIn", "username", "avatar"];

  for (const name of names) {
    store.set(name, "", {
      path: "/",
      maxAge: 0,
    });
  }
  // If you prefer to clear only auth cookies, replace above with:
  // const names = ["userId", "isLoggedIn", "username", "avatar"];
  // for (const name of names) {
  //   store.set(name, "", { path: "/", maxAge: 0 });
  // }

  return { success: true };
}


export async function getUserProfileFromCookies(): Promise<{
  username: string | null;
  avatarUrl: string | null;
  isLoggedIn: string | null;
}> {
  const store = await cookies();

  const username = store.get("username")?.value ?? null;
  const avatarPath = store.get("avatar")?.value ?? null;
  const isLoggedIn = store.get("isLoggedIn")?.value ?? null;


  let avatarUrl: string | null = null;

  if (avatarPath) {
    const { data } = supabase.storage
      .from("media")
      .getPublicUrl(avatarPath);
    avatarUrl = data.publicUrl || null;
  }

  return { username, avatarUrl, isLoggedIn };
}

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465, // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});



export async function updateUserPreferencesAction(
  prefs: string[]
): Promise<{ success: boolean; message?: string }> {
  const store = await cookies();
  const userId = store.get("userId")?.value ?? null;

  // normalise + filter to allowed values
  let normalized = normalizePreferences(prefs);

  // If nothing selected, fall back to straight
  if (!normalized.length) {
    normalized = ["straight"];
  }

  // Update DB if we know who the user is
  if (userId) {
    const { error } = await supabase
      .from("profiles")
      .update({ preferences: normalized })
      .eq("id", userId);

    if (error) {
      console.error("updateUserPreferencesAction error", error);
      return { success: false, message: "Failed to save preferences." };
    }
  }

  // Store in cookies for client-side fetching
  store.set("preferences", JSON.stringify(normalized), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });

  return { success: true };
}


export async function getUserPreferencesFromCookies(): Promise<Preference[] | null> {
  const store = await cookies();
  const raw = store.get("preferences")?.value;

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = normalizePreferences(parsed);
      return normalized.length ? normalized : null;
    }
  } catch {
    // maybe an older comma-separated format
    const parts = raw.split(",").map((s) => s.trim());
    const normalized = normalizePreferences(parts);
    return normalized.length ? normalized : null;
  }

  return null;
}