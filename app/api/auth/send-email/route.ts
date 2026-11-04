import {
  sendAuthHookEmail,
  verifySendEmailHookSignature,
  type SendEmailHookPayload,
} from "@/lib/server/authEmail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;

  if (!secret) {
    console.error("SEND_EMAIL_HOOK_SECRET is not configured.");
    return Response.json({ error: "Email hook is not configured." }, { status: 500 });
  }

  if (!verifySendEmailHookSignature(rawBody, request.headers, secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: SendEmailHookPayload;
  try {
    payload = JSON.parse(rawBody) as SendEmailHookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    await sendAuthHookEmail(payload);
    return new Response(null, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email delivery error";
    console.error("Goon Gram Auth email delivery failed:", message);
    return Response.json({ error: "Email delivery failed." }, { status: 500 });
  }
}
