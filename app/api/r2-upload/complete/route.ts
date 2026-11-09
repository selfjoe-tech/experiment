import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignR2, r2PublicUrl } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json() as { key?: string; size?: number; contentType?: string };
    const key = body.key ?? "";
    const size = Number(body.size);
    const contentType = body.contentType ?? "";
    const mediaFolder = key.startsWith("videos/" + user.id + "/") ? "videos" :
      key.startsWith("images/" + user.id + "/") ? "images" : null;
    const allowedVideo = ["video/mp4", "video/webm", "video/quicktime"];
    const allowedImage = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
    const validType = mediaFolder === "videos"
      ? allowedVideo.includes(contentType)
      : mediaFolder === "images" && allowedImage.includes(contentType);
    const maxSize = mediaFolder === "videos" ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (!mediaFolder || !validType || !Number.isSafeInteger(size) || size < 1 || size > maxSize ||
        !/^[a-z0-9-]+\/[0-9a-f-]+\/[0-9a-f-]+\.(mp4|webm|mov|jpg|png|gif|webp|avif)$/i.test(key)) {
      return NextResponse.json({ error: "Invalid object." }, { status: 400 });
    }

    const signedUrl = presignR2({ key, method: "HEAD" });
    const result = await fetch(signedUrl, { method: "HEAD", cache: "no-store" });
    if (!result.ok) return NextResponse.json({ error: "R2 object not found." }, { status: 409 });
    const actualBytes = Number(result.headers.get("content-length"));
    const actualType = result.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (actualBytes !== size || actualType !== contentType) {
      return NextResponse.json({ error: "R2 file metadata does not match the upload." }, { status: 409 });
    }
    return NextResponse.json(
      { ok: true, publicUrl: r2PublicUrl(key) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("r2-upload completion error", error);
    return NextResponse.json({ error: "Could not verify the uploaded file." }, { status: 503 });
  }
}
