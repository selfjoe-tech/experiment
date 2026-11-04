// app/api/stage-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const STAGING_BUCKET = "uploads-staging";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function projectRefFromUrl(supabaseUrl: string) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const filename = String(body?.filename ?? "").trim();
    const contentType = String(body?.contentType ?? "video/mp4").trim();
    const size = Number(body?.size);

    if (!filename) {
      return NextResponse.json({ error: "Missing filename." }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "Video must be 50 MB or smaller." },
        { status: 413 }
      );
    }

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported video type." },
        { status: 415 }
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Supabase URL is not configured." }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const objectName =
      `trim/in/${user.id}/${crypto.randomUUID()}-${sanitizeName(filename)}`;

    const { data, error } = await supabaseAdmin.storage
      .from(STAGING_BUCKET)
      .createSignedUploadUrl(objectName, { upsert: false });

    if (error || !data?.token || !data?.signedUrl) {
      console.error("stage-upload createSignedUploadUrl failed", error);
      return NextResponse.json(
        { error: "Could not prepare the upload. Check the uploads-staging bucket." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        bucket: STAGING_BUCKET,
        objectName,
        token: data.token,
        signedUrl: data.signedUrl,
        projectRef: projectRefFromUrl(supabaseUrl),
        contentType,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("stage-upload error", error);
    return NextResponse.json(
      { error: "Could not prepare the upload." },
      { status: 500 }
    );
  }
}
