import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const filename = body?.filename as string | undefined;
  const contentType = (body?.contentType as string | undefined) ?? "video/mp4";
  const bucket = (body?.bucket as string | undefined) ?? "uploads-staging";

  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const objectName = `trim/in/${crypto.randomUUID()}-${sanitizeName(filename)}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(objectName, { upsert: true });

  if (error || !data?.signedUrl || !data?.token) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket,
    objectName,
    contentType,
    signedUrl: data.signedUrl,
    token: data.token, // not used by PUT, but handy for debugging
  });
}
