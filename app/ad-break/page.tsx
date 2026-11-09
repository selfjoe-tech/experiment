import type { Metadata } from "next";
import AdBreakClient from "./AdBreakClient";

export const metadata: Metadata = {
  title: "Continuing to your page",
  description: "A short sponsored message before continuing to your destination.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

function safeDestination(input: unknown): string {
  if (typeof input !== "string" || input.length > 2048 ||
      !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return "/";
  try {
    const url = new URL(input, "https://goongram.com");
    if (url.origin !== "https://goongram.com") return "/";
    if (/^\/(?:ad-break|api|_next|admin|auth|upload|verify|logout)(?:\/|$)/i.test(url.pathname)) {
      return "/";
    }
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}

export default async function AdBreakPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  return <AdBreakClient destination={safeDestination(raw)} />;
}
