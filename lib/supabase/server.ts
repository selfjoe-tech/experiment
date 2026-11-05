import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authCookieOptions } from "./authCookieOptions";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  const cookieStore = await cookies();
  const hostname = (await headers()).get("host");

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookieOptions: authCookieOptions(hostname),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. The Next.js proxy
            // refreshes sessions and persists refreshed cookies instead.
          }
        },
      },
    }
  );
}
