import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in Supabase Auth user.
 *
 * Do not read the legacy userId/isLoggedIn cookies: they are client-managed
 * application data and are not proof of identity.
 */
export async function requireUserIdFromCookies(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user.id;
}
