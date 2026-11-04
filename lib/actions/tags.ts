
"use server";

import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { toTitleCase, slugify } from "@/lib/utils/text";

/**
 * Fetch initial tag suggestions.
 * Uses the publishable key and your public SELECT RLS policy.
 */
export async function fetchInitialTagSuggestions(
  limit = 50
): Promise<string[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("label")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchInitialTagSuggestions error", error);
    return [];
  }

  const labels =
    data
      ?.map((row) => (row.label as string | null)?.trim())
      .filter((v): v is string => !!v) ?? [];

  return [...new Set(labels.map(toTitleCase))];
}

/**
 * Search tags.
 * Uses the publishable key and your public SELECT RLS policy.
 */
export async function searchTagSuggestions(
  query: string,
  limit = 50
): Promise<string[]> {
  const q = query.trim();

  if (!q) {
    return fetchInitialTagSuggestions(limit);
  }

  const { data, error } = await supabase
    .from("tags")
    .select("label")
    .ilike("label", `%${q}%`)
    .order("label", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("searchTagSuggestions error", error);
    return [];
  }

  const labels =
    data
      ?.map((row) => (row.label as string | null)?.trim())
      .filter((v): v is string => !!v) ?? [];

  return [...new Set(labels.map(toTitleCase))];
}

/**
 * Create a tag if it doesn't exist.
 *
 * Your application uses custom cookie authentication,
 * not Supabase Auth.
 *
 * Therefore, this operation runs server-side using
 * the existing secret-key client after checking the
 * application's login cookies and profile.
 */
export async function ensureTagAction(input: {
  label: string;
  slug?: string;
}) {
  try {
    // 1. Check the application's custom authentication.
    const cookieStore = await cookies();

    const userId = cookieStore.get("userId")?.value;

    const isLoggedIn =
      cookieStore.get("isLoggedIn")?.value === "true";

    if (!userId || !isLoggedIn) {
      return {
        success: false as const,
        message: "You must be logged in to create tags.",
      };
    }

    // 2. Validate input.
    const label = toTitleCase(input.label);
    const slug = slugify(label);

    if (!label || !slug) {
      return {
        success: false as const,
        message: "Invalid tag.",
      };
    }

    // 3. Use the existing server-only admin client.
    const admin = getSupabaseAdmin();

    // 4. Verify that the profile exists.
    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

    if (profileError || !profile) {
      console.error("Tag authentication failed:", profileError);

      return {
        success: false as const,
        message: "Unable to verify your account.",
      };
    }

    // 5. Check whether the tag already exists.
    const { data: existing, error: existingError } =
      await admin
        .from("tags")
        .select("label, slug")
        .eq("slug", slug)
        .maybeSingle();

    if (existingError) {
      return {
        success: false as const,
        message: existingError.message,
      };
    }

    if (existing) {
      return {
        success: true as const,
        tag: existing,
      };
    }

    // 6. Insert the new tag.
    const { data: inserted, error: insertError } =
      await admin
        .from("tags")
        .insert({ label, slug })
        .select("label, slug")
        .single();

    if (!insertError) {
      return {
        success: true as const,
        tag: inserted,
      };
    }

    // 7. Handle a possible duplicate insertion race.
    const { data: retry } = await admin
      .from("tags")
      .select("label, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (retry) {
      return {
        success: true as const,
        tag: retry,
      };
    }

    console.error("ensureTagAction insert error:", insertError);

    return {
      success: false as const,
      message: insertError.message,
    };
  } catch (error) {
    console.error("ensureTagAction unexpected error:", error);

    return {
      success: false as const,
      message: "Something went wrong while creating the tag.",
    };
  }
}
