import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

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

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !baseUrl) {
      return NextResponse.json({ error: "R2 upload not configured." }, { status: 503 });
    }
    const origin = new URL(baseUrl);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
      return NextResponse.json({ error: "Invalid R2 public URL configuration." }, { status: 503 });
    }
    const key = `${contentType.startsWith("video/") ? "videos" : "images"}/${user.id}/${crypto.randomUUID()}.${extension}`;
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    const publicUrl = `${baseUrl.replace(/\/$/, "")}/${key}`;
    return NextResponse.json({ signedUrl, publicUrl, key, contentType }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("r2-upload signing error", error);
    return NextResponse.json({ error: "Failed to prepare R2 upload." }, { status: 500 });
  }
}
