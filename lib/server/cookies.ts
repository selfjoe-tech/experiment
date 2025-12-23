export async function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  // IMPORTANT:
  // - NEVER set `domain` on localhost
  // - only set domain in prod for subdomain sharing
  const domain = isProd ? "upskirtcandy.com" : undefined;

  return {
    path: "/",
    sameSite: "lax" as const,
    secure: isProd, // must be false on http://localhost
    domain,
    // bonus: make it obvious in devtools (optional)
    // maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}