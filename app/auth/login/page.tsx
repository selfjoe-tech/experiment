"use client";

import { LoginForm } from "@/app/components/auth/LoginForm";
import { ForgotPasswordForm } from "@/app/components/auth/ForgotPasswordForm";
import { useState } from "react";


export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");

  return mode === "login" ? (
    <LoginForm onShowForgot={() => setMode("forgot")} />
  ) : (
    <ForgotPasswordForm onBackToLogin={() => setMode("login")} />
  );
}