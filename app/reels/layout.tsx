import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reels | Goon Gram",
  description: "Explore a fullscreen feed of trending Goon Gram videos.",
  alternates: { canonical: "https://goongram.com/reels" },
};

export default function ReelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
