import { NextResponse } from "next/server";
/** Legacy trimming pipeline has been retired. Videos upload directly to Cloudflare R2. */
export const runtime = "nodejs";
export async function POST() {
  return NextResponse.json(
    { error: "This trim endpoint is retired. Upload the original video through /upload." },
    { status: 410 }
  );
}
