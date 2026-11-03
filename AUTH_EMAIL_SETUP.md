# Goon Gram authentication email setup

The application uses Supabase Auth for user creation, OTP generation, OTP expiry, verification and sessions. Supabase's Send Email Auth Hook forwards authentication email events to the Goon Gram Next.js endpoint, which sends the messages through Nodemailer and your SMTP provider.

## 1. Configure SMTP variables in Vercel

Add these variables to the Vercel project. Set them for Preview and Production deployments as appropriate.

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Goon Gram <no-reply@goongram.com>
SEND_EMAIL_HOOK_SECRET=
```

Use the host, port, username and password from your SMTP provider. Port 465 normally uses `SMTP_SECURE=true`; port 587 normally uses `SMTP_SECURE=false`.

`SMTP_FROM` must be an address/domain authorized by your SMTP provider. Verify SPF, DKIM and DMARC for `goongram.com` with that provider.

`SEND_EMAIL_HOOK_SECRET` is the signing secret generated in the Supabase Dashboard when creating the HTTP Send Email Hook. Copy its complete value, including the `v1,whsec_` prefix. Do not put any of these values in `NEXT_PUBLIC_*` variables or commit them to Git.

## 2. Configure the Supabase Send Email Auth Hook

In the Supabase Dashboard:

1. Open **Authentication → Hooks**.
2. Add the **Send Email** hook and choose the HTTP request option.
3. Set the endpoint URL to the deployed Goon Gram endpoint:

   `https://YOUR-DEPLOYMENT-DOMAIN/api/auth/send-email`

4. Generate/copy the hook signing secret and add the exact secret as `SEND_EMAIL_HOOK_SECRET` in the matching Vercel environment.
5. Deploy/redeploy the Vercel deployment after adding the environment variables.
6. Enable the hook and save it.

The endpoint verifies Supabase's Standard Webhooks signature, including the request timestamp, before it reads or sends the OTP. It returns HTTP 200 only after SMTP delivery succeeds.

## 3. Keep email authentication enabled

In **Authentication → Sign In / Providers → Email**:

- Keep Email provider enabled.
- Keep email confirmations enabled.
- Set a reasonable email OTP expiry (for example, 10–60 minutes).
- Keep Supabase's OTP and signup rate limits enabled.

No Supabase confirmation-link template or redirect URL is used for the signup OTP flow. The code is entered at `/auth/verify-email` and verified by Supabase Auth.

## 4. Test the flow

1. Deploy the migration branch as a Vercel Preview.
2. Use a separate staging Supabase project for testing. The Send Email Hook is configured on the Supabase project itself, not per Vercel deployment; configuring it on the live project affects all email Auth events for that project.
3. Configure the staging project's hook URL to point to the Preview deployment and copy its signing secret to that Preview's environment variables.
4. Create a test account.
5. Confirm that the email arrives from the configured Goon Gram sender.
6. Enter the six-digit code. A successful verification should establish the Supabase SSR session and redirect to `/`.
7. Test the resend action and confirm that an expired/incorrect code is rejected.

## Notes

- The hook sends signup, password-recovery, sign-in and other Supabase Auth email events through the same Nodemailer transport with event-specific Goon Gram subjects and content.
- Resending signup confirmation uses Supabase's `auth.resend({ type: "signup" })`; Supabase continues to enforce its Auth-side rate limits.
- The hook endpoint must stay server-side. It uses SMTP credentials and a signing secret and must never be exposed to the browser.
- Supabase's HTTP Auth Hook has a short response timeout. The SMTP client timeouts are configured below five seconds. A slow or unavailable SMTP provider will cause the Auth request to fail rather than silently treating an undelivered email as sent.
