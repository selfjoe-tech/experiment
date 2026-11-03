"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import AuthDialog from "@/app/components/auth/AuthDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  resendSignupOtpAction,
  verifySignupOtpAction,
} from "@/lib/actions/auth";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;

  const visible = local.length <= 2 ? local[0] ?? "" : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startVerifyTransition(async () => {
      const result = await verifySignupOtpAction(email, otp);

      if (!result.success) {
        setError(result.message ?? "Could not verify the code.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  };

  const onResend = () => {
    setError(null);
    setNotice(null);

    startResendTransition(async () => {
      const result = await resendSignupOtpAction(email);
      if (result.success) {
        setOtp("");
        setNotice(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const emailIsValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <AuthDialog title="Verify email">
      <h2 className="mb-3 text-xl font-semibold">Verify your email</h2>

      <p className="mb-6 text-sm leading-6 text-white/65">
        Enter the six-digit code we sent to{" "}
        <span className="font-medium text-white">
          {emailIsValid ? maskEmail(email) : "your email address"}
        </span>
        . You need to verify your email before signing in.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="signup-otp">Verification code</Label>
          <Input
            id="signup-otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            className="h-14 bg-black text-center text-2xl font-semibold tracking-[0.45em] text-white placeholder:text-white/25"
            disabled={!emailIsValid || isVerifying}
            autoFocus
          />
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-red-400">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="text-center text-xs text-emerald-400">
            {notice}
          </p>
        )}

        <Button
          type="submit"
          disabled={!emailIsValid || otp.length !== 6 || isVerifying}
          className="h-12 w-full rounded-full bg-white font-semibold text-black hover:bg-white/90"
        >
          {isVerifying ? "Verifying…" : "Verify email"}
        </Button>

        <div className="flex flex-col items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onResend}
            disabled={!emailIsValid || isResending || isVerifying}
            className="text-sm text-white/75 underline underline-offset-4 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isResending ? "Sending…" : "Resend verification code"}
          </button>

          <Link
            href="/auth/signup"
            className="text-xs text-white/45 transition hover:text-white/75"
          >
            Back to sign up
          </Link>
        </div>
      </form>
    </AuthDialog>
  );
}
