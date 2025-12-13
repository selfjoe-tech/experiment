// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "./lib/adminJwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only care about /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Allow login and signup without token
  if (
    pathname === "/admin/login"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("admin_token")?.value;

  if (!token) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("error", "Please+log+in");
    return NextResponse.redirect(loginUrl);
  }

  try {
    await verifyAdminJwt(token);
    // valid and not expired
    return NextResponse.next();
  } catch (err) {
    console.error("middleware: admin token invalid/expired", err);
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("expired", "1");
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
