// app/explore/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  // Users will usually land on /explore/gifs, but this still helps
  title: "Explore Porn GIFs, Images, Creators & Niches | UpskirtCandy",
  description:
    "Browse trending adult Porn GIFs, images, creators and niches on UpskirtCandy. Discover new loops and creators across categories and niches.",
  alternates: {
    canonical: "https://upskirtcandy.com/explore",
  },
  robots: {
    // optional: you *can* noindex the redirect stub if you want
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Explore Porn videos on UpskirtCandy",
    description:
      "Dive into trending adult Porn GIFs, images, creators and niches on UpskirtCandy.",
    url: "https://upskirtcandy.com/explore",
    siteName: "UpskirtCandy",
    type: "website",
  },
};

export default function ExploreIndex() {
  redirect("/explore/gifs");
}
