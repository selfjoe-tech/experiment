import "server-only";

import { cookies } from "next/headers";
import { verifyAdminJwt } from "@/lib/adminJwt";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    throw new Error("Admin authentication required.");
  }

  try {
    return await verifyAdminJwt(token);
  } catch {
    throw new Error("Your admin session has expired. Please sign in again.");
  }
}
