// app/api/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mediaId, reason, note } = body as {
      mediaId: number | string;
      reason: string;
      note?: string;
    };

    if (!mediaId || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing mediaId or reason" },
        { status: 400 }
      );
    }

    const store = await cookies();
    const reporterId = store.get("userId")?.value ?? null;

    const payload: any = {
      media_id: mediaId,
      reason,
      note: note && note.trim().length > 0 ? note.trim() : null,
    };

    // If your reports table has reporter_id and allows null, this will fill it
    if (reporterId) {
      payload.reporter_id = reporterId;
    }

    const { error } = await supabase.from("reports").insert(payload);

    if (error) {
      console.error("create report error", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("create report thrown error", err);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
