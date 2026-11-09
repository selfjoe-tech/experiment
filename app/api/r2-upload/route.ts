import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignR2, r2PublicUrl } from "@/lib/server/r2";

export const runtime = "nodejs";

const allowed: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { contentType?: string; size?: number };
    const contentType = body.contentType ?? "";
    const extension = allowed[contentType];
    const size = Number(body.size);
    if (!extension || !Number.isSafeInteger(size) || size < 1) {
      return NextResponse.json({ error: "Unsupported file type or size." }, { status: 400 });
    }
    const limit = contentType.startsWith("video/") ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (size > limit) return NextResponse.json({ error: "File exceeds allowed size." }, { status: 413 });

    const key = (contentType.startsWith("video/") ? "videos" : "images") +
      "/" + user.id + "/" + crypto.randomUUID() + "." + extension;
    const signedUrl = presignR2({ key, method: "PUT", contentType, expires: 300 });
    const publicUrl = r2PublicUrl(key);
    return NextResponse.json({ signedUrl, publicUrl, key, contentType }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("r2-upload signing error", error);
    return NextResponse.json({ error: "Failed to prepare R2 upload." }, { status: 503 });
  }
}
