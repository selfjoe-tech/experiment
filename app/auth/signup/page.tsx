import { Suspense } from "react";
import { SignupForm } from "./SignupPage";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="text-white/70 p-6">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}