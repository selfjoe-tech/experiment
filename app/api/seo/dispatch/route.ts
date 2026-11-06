import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SITE } from "@/lib/seo/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by a trusted scheduler using Authorization: Bearer <CRON_SECRET>.
// Database publication triggers queue URLs without slowing an upload.
export async function GET(request: Request) {
  const token = process.env.CRON_SECRET;
  if (!token || token.length < 20 ||
      request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401, headers: {"Cache-Control":"no-store"} });
  }

  const key = process.env.INDEXNOW_KEY;
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return Response.json({ configured: false, message: "Set INDEXNOW_KEY to enable IndexNow." },
      { headers: {"Cache-Control":"no-store"} });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db.from("seo_discovery_events")
    .select("id,canonical_url,kind,attempts")
    .in("status", ["queued", "failed"]).lt("attempts", 5)
    .order("created_at", {ascending: true}).limit(80);
  if (error) {
    console.error("[seo] Could not fetch discovery queue", error.message);
    return Response.json({ ok: false }, { status: 503 });
  }
  if (!data?.length) return Response.json({ok:true, submitted:0});

  // Limit notifications to this site's canonical public routes.
  const candidates = data.filter(item => {
    try {
      const url = new URL(item.canonical_url);
      if (url.origin !== SITE || url.search || url.hash) return false;
      if (item.kind === "video") return /^\/watch\/[1-9][0-9]*$/.test(url.pathname);
      if (item.kind === "image") return /^\/image\/[1-9][0-9]*$/.test(url.pathname);
      return item.kind === "profile" && /^\/[a-zA-Z0-9._]{1,40}$/.test(url.pathname);
    } catch { return false; }
  });
  if (!candidates.length) return Response.json({ok:true, submitted:0, skipped:data.length});

  const ids = candidates.map(item=>item.id);
  const now = new Date().toISOString();
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "goongram.com", key,
        keyLocation: `${SITE}/indexnow/${key}.txt`,
        urlList: candidates.map(item=>item.canonical_url),
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`IndexNow HTTP ${response.status}`);
    const {error:updateError} = await db.from("seo_discovery_events")
      .update({status:"sent",updated_at:now,last_attempt_at:now,last_error:null})
      .in("id",ids);
    if (updateError) throw updateError;
    return Response.json({ok:true,submitted:candidates.length});
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,250) : "Unknown IndexNow failure";
    console.error("[seo] IndexNow delivery failed",message);
    // Record retry attempts individually so repeated outages do not spam IndexNow.
    await Promise.all(candidates.map(item =>
      db.from("seo_discovery_events").update({
        status:"failed", attempts:item.attempts+1, updated_at:now,
        last_attempt_at:now,last_error:message,
      }).eq("id",item.id)
    ));
    return Response.json({ok:false,submitted:0}, {status:503});
  }
}
