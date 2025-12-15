"use client";

import { LoginForm } from "@/app/components/auth/LoginForm";
import { ForgotPasswordForm } from "@/app/components/auth/ForgotPasswordForm";
import { Suspense, useState } from "react";


export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");

  return mode === "login" ? (
    <Suspense fallback={<div className="text-white/70 p-6">Loading…</div>}>
  <LoginForm onShowForgot={() => setMode("forgot")} />
</Suspense>
  ) : (
    <ForgotPasswordForm onBackToLogin={() => setMode("login")} />
  );
}