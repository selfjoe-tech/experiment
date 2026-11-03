"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthCookieOptions } from "@/lib/server/cookies";

const USERNAME_REGEX = /^[a-z0-9._]+$/;
const ALLOWED_PREFERENCES = [
  "straight",
  "gay",
  "bisexual",
  "trans",
  "lesbian",
  "animated",
] as const;

type Preference = (typeof ALLOWED_PREFERENCES)[number];

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
  requiresEmailConfirmation?: boolean;
};

export type ForgotPasswordFieldErrors = {
  email?: string;
  otp?: string;
  password?: string;
  confirmPassword?: string;
};

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function normalizePreferences(
  raw: string[] | null | undefined
): Preference[] {
  if (!raw?.length) return [];

  const lower = raw
    .map((preference) => preference.toLowerCase().trim())
    .filter(Boolean);

  const unique = new Set(lower);
  return ALLOWED_PREFERENCES.filter((preference) => unique.has(preference));
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("getCurrentUser: Supabase Auth lookup failed", error.message);
    return null;
  }

  return user;
}

/**
 * Supabase Auth owns the session cookies now.
 * This compatibility export intentionally does not create custom identity cookies.
 * Existing settings code can stop calling it in a later cleanup pass.
 */
export async function setAuthCookies(
  _userId: string,
  _username: string,
  _avatar = "",
  _verified = false
): Promise<void> {
  // Intentionally empty. A verified Supabase Auth session is the only identity.
}

/* ---------------- SIGN UP ---------------- */

export async function signupAction(formData: FormData): Promise<AuthResult> {
  const username = normalizeUsername(
    String(formData.get("username") ?? "")
  );
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: AuthFieldErrors = {};

  if (!username) {
    fieldErrors.username = "Username is required.";
  } else if (
    username.length > 30 ||
    !USERNAME_REGEX.test(username)
  ) {
    fieldErrors.username =
      "Use 1–30 lowercase letters, numbers, '.' and '_'.";
  }

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

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

  const supabase = await createClient();

  // Availability is checked against the public username field only.
  const { data: existingUsername, error: usernameError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (usernameError) {
    console.error("signupAction username lookup failed", usernameError);
    return {
      success: false,
      message: "Could not validate the username. Please try again.",
    };
  }

  if (existingUsername) {
    return {
      success: false,
      message: "Username already in use.",
      fieldErrors: { username: "That username is already taken." },
    };
  }

  // The auth.users trigger creates the corresponding public.profiles row.
  // Never insert a password hash into public.profiles.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://goongram.com"}/auth/callback?next=/preferences`,
    },
  });

  if (error || !data.user) {
    console.error("signupAction Supabase Auth error", error);
    const message = error?.message ?? "Could not create your account.";

    if (/already registered|already exists|already been registered/i.test(message)) {
      return {
        success: false,
        message: "An account with this email may already exist.",
        fieldErrors: { email: "This email address is already in use." },
      };
    }

    if (/username|profile/i.test(message)) {
      return {
        success: false,
        message: "That username may already be in use. Please choose another.",
        fieldErrors: { username: "That username is already taken." },
      };
    }

    return {
      success: false,
      message: "Something went wrong creating your account. Please try again.",
    };
  }

  if (!data.session) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      message: "Check your email for a confirmation link before signing in.",
    };
  }

  return { success: true };
}

/* ---------------- LOGIN ---------------- */

async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return normalizeEmail(identifier);

  // Email addresses must never be exposed through public profile reads.
  // This narrow server-side lookup resolves username -> email; Supabase Auth
  // still verifies the password and issues the user session.
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .ilike("username", normalizeUsername(identifier))
    .maybeSingle();

  if (error) {
    console.error("resolveLoginEmail failed", error);
    return null;
  }

  return data?.email ? normalizeEmail(data.email) : null;
}

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: AuthFieldErrors = {};

  if (!identifier) {
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

  const email = await resolveLoginEmail(identifier);

  if (!email) {
    return {
      success: false,
      message: "Invalid credentials.",
      fieldErrors: { identifier: "Account not found or invalid." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("loginAction Supabase Auth sign-in failed", error.message);
    return {
      success: false,
      message: "Invalid credentials.",
      fieldErrors: { password: "Incorrect username/email or password." },
    };
  }

  return { success: true };
}

/* ---------------- USERNAME AVAILABILITY ---------------- */

export async function checkUsernameAvailability(
  raw: string
): Promise<{ available: boolean }> {
  const username = normalizeUsername(raw);

  if (
    username.length < 1 ||
    username.length > 30 ||
    !USERNAME_REGEX.test(username)
  ) {
    return { available: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("checkUsernameAvailability error", error);
    return { available: false };
  }

  return { available: !data };
}

/* ---------------- PASSWORD RECOVERY ---------------- */

/**
 * Configure Supabase Dashboard > Authentication > Email Templates >
 * Reset Password to include {{ .Token }} for the existing six-digit OTP form.
 */
export async function requestPasswordResetAction(
  formData: FormData
): Promise<{
  success: boolean;
  message?: string;
  fieldErrors?: ForgotPasswordFieldErrors;
}> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const fieldErrors: ForgotPasswordFieldErrors = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
    return { success: false, fieldErrors };
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
    return { success: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    console.error("requestPasswordResetAction failed", error.message);
  }

  // Do not reveal whether an email address belongs to an account.
  return {
    success: true,
    message: "If an account exists for that email, a recovery code will be sent.",
  };
}

export async function resetPasswordWithOtpAction(
  formData: FormData
): Promise<{
  success: boolean;
  message?: string;
  fieldErrors?: ForgotPasswordFieldErrors;
}> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const otp = String(formData.get("otp") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: ForgotPasswordFieldErrors = {};

  if (!email) fieldErrors.email = "Email is required.";
  if (!/^\d{6}$/.test(otp)) fieldErrors.otp = "Enter the six-digit code.";
  if (!password) fieldErrors.password = "New password is required.";
  if (password && password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "recovery",
  });

  if (verifyError) {
    console.error("resetPasswordWithOtpAction OTP verification failed", verifyError);
    return {
      success: false,
      fieldErrors: { otp: "Invalid or expired code. Request a new one." },
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    console.error("resetPasswordWithOtpAction password update failed", updateError);
    return {
      success: false,
      message: "Could not update the password. Please try again.",
    };
  }

  await supabase.auth.signOut({ scope: "local" });

  return {
    success: true,
    message: "Your password has been reset. You can log in now.",
  };
}

/* ---------------- SESSION HELPERS ---------------- */

export async function getIsLoggedInFromCookies(): Promise<boolean> {
  return Boolean(await getCurrentUser());
}

/** Kept for existing server actions; this now returns a verified Auth user ID. */
export async function getUserIdFromCookies(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getVerified(username: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("verified")
    .eq("username", normalizeUsername(username))
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getVerified failed", error);
    return false;
  }

  return Boolean(data.verified);
}

export type SimpleResult = { success: boolean };

export async function logoutAction(): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("logoutAction failed", error);
    return { success: false };
  }

  // Expire old custom cookies so no legacy UI can mistake them for a session.
  const store = await cookies();
  const cookieOptions = await getAuthCookieOptions();
  const legacyCookieNames = [
    "userId",
    "isLoggedIn",
    "username",
    "avatar",
    "verified",
    "preferences",
  ];

  for (const name of legacyCookieNames) {
    store.set(name, "", { ...cookieOptions, maxAge: 0 });
  }

  return { success: true };
}

export async function getIdWUsername(
  username: string
): Promise<string | false> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalizeUsername(username))
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getIdWUsername failed", error);
    return false;
  }

  return data.id;
}

export async function getUserProfileFromCookies(): Promise<{
  username: string | null;
  avatarUrl: string | null;
  isLoggedIn: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { username: null, avatarUrl: null, isLoggedIn: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getUserProfileFromCookies failed", error);
    return { username: null, avatarUrl: null, isLoggedIn: null };
  }

  return {
    username: data.username,
    avatarUrl: data.avatar_url,
    isLoggedIn: "true",
  };
}

export async function getUserProfile(): Promise<{
  username: string | null;
  avatarUrl: string | null;
  isLoggedIn: string | null;
}> {
  return getUserProfileFromCookies();
}

/* ---------------- PREFERENCES ---------------- */

export async function updateUserPreferencesAction(
  prefs: string[]
): Promise<{ success: boolean; message?: string }> {
  let normalized = normalizePreferences(prefs);
  if (!normalized.length) normalized = ["straight"];

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("updateUserPreferencesAction auth error", userError);
    return { success: false, message: "Could not verify your session." };
  }

  if (user) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, preferences: normalized },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("updateUserPreferencesAction update failed", error);
      return { success: false, message: "Failed to save preferences." };
    }
  }

  // This cookie stores a display preference only; it is never used for identity.
  const store = await cookies();
  const cookieOptions = await getAuthCookieOptions();
  store.set("preferences", JSON.stringify(normalized), {
    ...cookieOptions,
    httpOnly: false,
  });

  return { success: true };
}

export async function getUserPreferencesFromCookies(): Promise<
  Preference[] | null
> {
  const user = await getCurrentUser();

  if (user) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      const normalized = normalizePreferences(data.preferences ?? []);
      return normalized.length ? normalized : null;
    }

    if (error) {
      console.error("getUserPreferencesFromCookies private preferences lookup failed", error);
    }
  }

  // Preserve pre-login preference selection as non-security UI state.
  const store = await cookies();
  const raw = store.get("preferences")?.value;
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
      const normalized = normalizePreferences(parsed);
      return normalized.length ? normalized : null;
    }
  } catch {
    const normalized = normalizePreferences(raw.split(","));
    return normalized.length ? normalized : null;
  }

  return null;
}

export async function getUserIdByUsername(
  username: string
): Promise<string | null> {
  const id = await getIdWUsername(username);
  return typeof id === "string" ? id : null;
}
