import type { Metadata } from "next";
import HistoryClient from "./HistoryClient";
import type { HistoryTab } from "@/lib/actions/history";

export const metadata: Metadata = {
  title: "History | Goon Gram",
  description: "Your liked and bookmarked videos and images.",
  robots: { index: false, follow: false },
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab: HistoryTab = params.tab === "bookmarked" ? "bookmarked" : "liked";
  return <HistoryClient initialTab={initialTab} />;
}
