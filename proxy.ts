import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "./lib/adminJwt";

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse
) {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie);
  }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh expired Auth tokens before Server Components and Server Actions run.
  // getClaims() validates the JWT without an additional Auth user lookup.
  await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;

  if (
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap/") ||
    pathname === "/robots.txt"
  ) {
    return supabaseResponse;
  }

  // Keep the separate admin JWT system intact during this migration.
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return supabaseResponse;
  }

  const token = request.cookies.get("admin_token")?.value;

  if (!token) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "Please log in");

    const redirect = NextResponse.redirect(loginUrl);
    copyResponseCookies(supabaseResponse, redirect);
    return redirect;
  }

  try {
    await verifyAdminJwt(token);
    return supabaseResponse;
  } catch (error) {
    console.error("proxy: admin token invalid or expired", error);

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("expired", "1");

    const redirect = NextResponse.redirect(loginUrl);
    copyResponseCookies(supabaseResponse, redirect);
    return redirect;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
