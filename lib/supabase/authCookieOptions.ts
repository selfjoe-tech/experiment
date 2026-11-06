/**
 * Share a Supabase Auth session only between Goon Gram's owned production
 * hostnames. Never attach the parent-domain cookie to localhost or Vercel
 * preview hosts, where the browser would reject it.
 */
export function authCookieOptions(hostname?: string | null) {
  const host = (hostname ?? "").split(":")[0].toLowerCase();
  const share = host === "goongram.com" || host.endsWith(".goongram.com");
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    ...(share ? { domain: "goongram.com" } : {}),
  };
}
