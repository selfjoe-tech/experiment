import type { Metadata } from "next";
import LoginPageClient from "./_components/LoginPageClient";

const SITE_NAME = "Upskirt Candy";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

function abs(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const title = `Login | ${SITE_NAME}`;
  const description = "Log in to your Upskirt Candy account.";
  const canonical = abs("/auth/login");

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

export default function LoginPage() {
  return <LoginPageClient />;
}
