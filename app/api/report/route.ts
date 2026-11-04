// app/api/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "You must be signed in to report content." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const mediaId = Number(body?.mediaId);
    const reason = String(body?.reason ?? "").trim();
    const note = String(body?.note ?? "").trim();

    if (!Number.isSafeInteger(mediaId) || mediaId <= 0 || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid media ID or reason." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("submit_media_report", {
      p_media_id: mediaId,
      p_reason: reason,
      p_note: note || null,
    });

    if (error) {
      console.error("create report RPC error", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, reportId: data?.report_id });
  } catch (error) {
    console.error("create report thrown error", error);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
