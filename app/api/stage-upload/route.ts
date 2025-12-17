// app/api/stage-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function projectRefFromUrl(supabaseUrl: string) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const filename = body?.filename as string | undefined;
    const contentType = (body?.contentType as string | undefined) ?? "video/mp4";
    const bucket = (body?.bucket as string | undefined) ?? "uploads-staging";

    if (!filename) {
      return NextResponse.json({ error: "Missing filename" }, { status: 400 });
    }

    // Prefer server-only vars in production
    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "Server misconfigured: missing Supabase env vars",
          hasSupabaseUrl: !!supabaseUrl,
          hasServiceRole: !!serviceKey,
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const objectName = `trim/in/${crypto.randomUUID()}-${sanitizeName(filename)}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(objectName, { upsert: true });

    if (error || !data?.token) {
      return NextResponse.json(
        {
          error: "Failed to create signed upload token",
          details: error?.message ?? "unknown",
          bucket,
          objectName,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        bucket,
        objectName,
        token: data.token,
        signedUrl: (data as any).signedUrl, // keep if your SDK returns it
        projectRef: projectRefFromUrl(supabaseUrl),
        contentType,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err: any) {
    console.error("stage-upload error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
