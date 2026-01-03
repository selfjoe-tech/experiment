import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "./SignupPage";

const SITE_NAME = "Upskirt Candy";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

function abs(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const title = `Sign up | ${SITE_NAME}`;
  const description = `Create an account on ${SITE_NAME}.`;
  const canonical = abs("/auth/signup"); // change if your route is different

  return {
    title,
    description,
    alternates: { canonical },

    // ✅ Auth pages should not be indexed
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "none",
        "max-video-preview": 0,
        "max-snippet": 0,
      },
    },
  };
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="text-white/70 p-6">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
