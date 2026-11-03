# Goon Gram authentication email setup

The application uses Supabase Auth for account creation, password verification, sessions, password recovery token generation and OTP verification. Signup does not require an email confirmation. The custom Send Email Auth Hook and Nodemailer are used only to deliver password-recovery OTPs.

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

## 2. Disable signup email confirmation

In the Supabase Dashboard, for each Supabase project used by this application:

1. Open **Authentication → Sign In / Providers → Email**.
2. Keep the Email provider enabled.
3. Turn **Confirm email** OFF.
4. Save the setting.

With email confirmation disabled, `supabase.auth.signUp()` returns an authenticated session and the application signs the user in immediately. There is no signup verification page, signup OTP, or signup confirmation email.

This setting is project-wide. Configure it separately for the staging and production Supabase projects. Do not test a Preview deployment against the production Supabase project.

## 3. Configure the Supabase Send Email Auth Hook for recovery only

In the Supabase Dashboard:

1. Open **Authentication → Hooks**.
2. Add the **Send Email** hook and choose the HTTP request option.
3. Set the endpoint URL to the deployed Goon Gram endpoint:

   `https://YOUR-DEPLOYMENT-DOMAIN/api/auth/send-email`

4. Generate/copy the hook signing secret and add the exact secret as `SEND_EMAIL_HOOK_SECRET` in the matching Vercel environment.
5. Deploy/redeploy the Vercel deployment after adding the environment variables.
6. Enable the hook and save it.

The endpoint verifies Supabase's Standard Webhooks signature, including the request timestamp, before it reads or sends the OTP. It accepts only the `recovery` Auth email action and returns HTTP 200 only after SMTP delivery succeeds. Other Auth email action types are intentionally rejected.

Password recovery still uses Supabase to generate, expire and verify the six-digit OTP. The application sends the code through Nodemailer and verifies it with `supabase.auth.verifyOtp({ type: "recovery" })`. No signup email template or confirmation redirect is required.

## 4. Test the flow

1. Use a separate staging Supabase project and point the Vercel Preview environment variables at it.
2. Disable **Confirm email** on the staging project.
3. Configure the staging project's Send Email Auth Hook to point to the Preview deployment, and copy its signing secret to that Preview's environment variables.
4. Create a test account. Signup should establish a session and redirect directly to the application; no email should be sent.
5. Use **Forgot password** for the test account. The recovery OTP should arrive from the configured Goon Gram sender.
6. Enter the six-digit code and complete the password reset. Confirm that the new password works and the previous password no longer works.

## Security note

Disabling email confirmation means Supabase does not prove that a new user controls the email address they enter. Someone may register using another person's address, creating account-impersonation or account-squatting risks. Do not treat the email address as verified identity evidence. Before enabling public signup in production, configure CAPTCHA protection and appropriate signup rate limits in Supabase Auth.

The Send Email hook is configured per Supabase project. Changing it on the live project affects that project's Auth email events.
