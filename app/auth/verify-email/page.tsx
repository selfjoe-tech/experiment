import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailPage from "./VerifyEmailPage";

export const metadata: Metadata = {
  title: "Verify your email | Goon Gram",
  description: "Verify your email address to finish creating your Goon Gram account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/70">Loading…</div>}>
      <VerifyEmailPage />
    </Suspense>
  );
}
