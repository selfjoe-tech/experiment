import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { identifyVisitor, verifySameOrigin } from "@/lib/server/watchMonetization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return NextResponse.json({ eligible: false }, { status: 403 });
  let mediaId: number;
  try { mediaId = Number((await request.json()).mediaId); }
  catch { return NextResponse.json({ eligible: false }, { status: 400 }); }
  if (!Number.isSafeInteger(mediaId) || mediaId < 1) {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }
  try {
    const identity = await identifyVisitor();
    const admin = getSupabaseAdmin();
    const { data: video, error } = await admin.from("media")
      .select("id,owner_id,media_type,duration_seconds")
      .eq("id", mediaId).maybeSingle();
    if (error) throw error;
    if (!video || video.media_type !== "video" ||
        video.duration_seconds == null || Number(video.duration_seconds) < 30 ||
        video.owner_id === identity.viewerId) {
      return NextResponse.json({ eligible: false });
    }
    // Several defensive limits in addition to the atomic daily uniqueness
    // enforced by Postgres at credit time.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: visitorCount }, { count: networkCount }] = await Promise.all([
      admin.from("watch_monetization_sessions").select("id", { count: "exact", head: true })
        .eq("visitor_hash", identity.visitorHash).eq("status", "credited").gte("created_at", since),
      admin.from("watch_monetization_sessions").select("id", { count: "exact", head: true })
        .eq("network_hash", identity.networkHash).eq("status", "credited").gte("created_at", since),
    ]);
    if ((visitorCount ?? 0) >= 20 || (networkCount ?? 0) >= 60) {
      return NextResponse.json({ eligible: false });
    }
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const { data, error: insertError } = await admin.from("watch_monetization_sessions")
      .insert({
        media_id: mediaId, creator_id: video.owner_id, viewer_id: identity.viewerId,
        visitor_hash: identity.visitorHash, network_hash: identity.networkHash, visit_day: date,
      }).select("id").single();
    if (insertError) throw insertError;
    return NextResponse.json({ eligible: true, sessionId: data.id }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[watch earnings] start failed", error);
    return NextResponse.json({ eligible: false }, { status: 503 });
  }
}
