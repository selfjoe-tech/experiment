import type { Metadata } from "next";
import HomeTimeline from "@/app/components/feed/HomeTimeline";
import { getHomeInitialFeed } from "@/lib/server/homeInitialFeed";

export const metadata: Metadata = {
  title: "Home | Goon Gram",
  description: "Discover image and video posts from the Goon Gram community.",
  alternates: { canonical: "https://goongram.com/" },
};

export default async function HomePage() {
  const initial = await getHomeInitialFeed();
  return <HomeTimeline initial={initial} />;
}
