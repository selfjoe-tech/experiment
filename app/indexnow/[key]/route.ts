export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const configured = process.env.INDEXNOW_KEY;
  if (!configured || !/^[a-zA-Z0-9-]{8,128}$/.test(configured)
      || key !== configured + ".txt") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(configured, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
