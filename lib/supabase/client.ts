import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authCookieOptions } from "./authCookieOptions";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  browserClient = createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
    { cookieOptions: authCookieOptions(typeof window === "undefined" ? undefined : window.location.hostname) }
  );

  return browserClient;
}
