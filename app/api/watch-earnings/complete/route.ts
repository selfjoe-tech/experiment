import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { identifyVisitor, PAYABLE_AD_ZONES, verifySameOrigin } from "@/lib/server/watchMonetization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  let sessionId = "";
  let zones: unknown;
  try {
    const body = await request.json();
    sessionId = String(body.sessionId || "");
    zones = body.zones;
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  // All four publisher panels must have dispatched a completed creative load.
  // These signals are best-effort browser evidence, NOT advertiser-signed receipts.
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !Array.isArray(zones) ||
      PAYABLE_AD_ZONES.some(id => !zones.includes(id))) {
    return NextResponse.json({ ok: false, counted: false });
  }
  try {
    const identity = await identifyVisitor();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("credit_watch_monetization", {
      p_session: sessionId, p_visitor_hash: identity.visitorHash,
      p_network_hash: identity.networkHash, p_zone: PAYABLE_AD_ZONES[0],
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, counted: data === true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[watch earnings] completion failed", error);
    return NextResponse.json({ ok: false, counted: false }, { status: 503 });
  }
}
