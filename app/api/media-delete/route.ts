import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteR2Object, r2KeyFromPublicUrl } from "@/lib/server/r2";

export const runtime = "nodejs";

/** Only delete the authenticated user's own media/ad objects. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, isAd } = await request.json() as { id?: number; isAd?: boolean };
    if (!Number.isSafeInteger(id) || !id || id < 1 || typeof isAd !== "boolean") {
      return NextResponse.json({ error: "Invalid media." }, { status: 400 });
    }
    const table = isAd ? "ads" : "media";
    const { data: row, error: readError } = await supabase
      .from(table).select("id,storage_path,owner_id").eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (readError || !row) return NextResponse.json({ error: "Media not found." }, { status: 404 });

    const { error: deleteError } = await supabase.from(table).delete()
      .eq("id", id).eq("owner_id", user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 403 });

    let cleanupWarning: string | undefined;
    if (row.storage_path) {
      const r2Key = r2KeyFromPublicUrl(row.storage_path);
      try {
        if (r2Key) {
          await deleteR2Object(r2Key);
        } else if (!/^https?:\/\//i.test(row.storage_path)) {
          const { error } = await supabase.storage.from("media").remove([row.storage_path]);
          if (error) throw new Error(error.message);
        }
      } catch (error) {
        console.error("Media deleted; storage cleanup requires retry", error);
        cleanupWarning = "Media removed. Storage cleanup will require an administrator.";
      }
    }
    return NextResponse.json({ ok: true, warning: cleanupWarning }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("media-delete error", error);
    return NextResponse.json({ error: "Could not delete media." }, { status: 500 });
  }
}
