import { createHmac, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const PAYABLE_AD_ZONES = [1130835, 1130836, 1130843, 1130846] as const;
const VISITOR_COOKIE = "gg_watch_visitor_v1";
const ONE_YEAR = 365 * 24 * 60 * 60;

function signingSecret(): string {
  const secret = process.env.WATCH_MONETIZATION_HASH_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret || secret.length < 30) throw new Error("Watch tracking is not configured.");
  return secret;
}
export function secureHash(value: string): string {
  return createHmac("sha256", signingSecret()).update("goongram-watch-v1:" + value).digest("hex");
}
export async function identifyVisitor(): Promise<{
  visitorHash: string;
  networkHash: string;
  viewerId: string | null;
}> {
  const store = await cookies();
  let token = store.get(VISITOR_COOKIE)?.value;
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    token = randomUUID();
    store.set(VISITOR_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: ONE_YEAR,
    });
  }
  const h = await headers();
  // Vercel's trusted reverse proxy supplies the true client address.
  // No address => fail closed, rather than crediting unidentifiable traffic.
  const ip = (h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || "")
    .split(",")[0]?.trim();
  if (!ip || ip.length > 80 || /[^0-9a-fA-F:.]/.test(ip)) {
    throw new Error("Cannot validate this visitor's network.");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return {
    visitorHash: secureHash("cookie:" + token),
    networkHash: secureHash("network:" + ip),
    viewerId: user?.id || null,
  };
}
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || (process.env.NODE_ENV !== "production" && parsed.protocol === "http:"))
      && parsed.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
