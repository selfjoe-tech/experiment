import { NextResponse } from "next/server";
import { ExtractorError, resolveExternalVideo } from "@/lib/external-download/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function inspect(input: unknown) {
  try {
    const info = await resolveExternalVideo(input);
    // Do not expose raw third-party URLs until the user chooses a quality.
    const { sources: _sources, ...publicInfo } = info;
    return NextResponse.json(publicInfo, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const status = error instanceof ExtractorError ? error.status : 502;
    const message = error instanceof ExtractorError ? error.message : "Video extraction is currently unavailable.";
    return NextResponse.json({ error: message }, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  return inspect(data?.url);
}

// Preview-only integration probe. Not available on production domains.
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response(null, { status: 405 });
  return inspect(new URL(request.url).searchParams.get("url"));
}
