import type { Metadata } from "next";
import HomeTimeline from "@/app/components/feed/HomeTimeline";

export const metadata: Metadata = {
  title: "Home | Goon Gram",
  description: "Discover image and video posts from the Goon Gram community.",
  alternates: { canonical: "https://goongram.com/" },
};

export default function HomePage() {
  return <HomeTimeline />;
}
