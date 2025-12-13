// app/api/admin/check-username/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUsername = searchParams.get("username");

  if (!rawUsername) {
    return NextResponse.json(
      { error: "Missing username", exists: false },
      { status: 400 }
    );
  }

  // Normalize: strip leading @ and trim
  const username = rawUsername.trim().replace(/^@/, "");

  if (!username) {
    return NextResponse.json({ exists: false });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("check-username error", error);
    return NextResponse.json(
      { error: "Database error", exists: false },
      { status: 500 }
    );
  }

  const exists = !!data;
  return NextResponse.json({ exists });
}
