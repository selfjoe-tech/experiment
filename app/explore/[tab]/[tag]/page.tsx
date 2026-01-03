import type { Metadata } from "next";
import ExploreNicheTagClient from "./ExploreNicheTagClient";

const SITE_NAME = "Upskirt Candy";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

function abs(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function slugToTitle(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeTab(rawTab: string) {
  return ["gifs", "images", "creators", "niches"].includes(rawTab) ? rawTab : "niches";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tab: string; tag: string }>;
}): Promise<Metadata> {

  const attribute = await params;
  const rawTab = attribute?.tab || "niches";
  const tagSlug = attribute?.tag || "";

  const tab = normalizeTab(rawTab);
  const nicheTitle = slugToTitle(tagSlug);

  const contentKind = tab === "images" ? "Images" : tab === "gifs" ? "GIFs" : "Videos";

  const title = `${nicheTitle} ${contentKind} | ${SITE_NAME}`;
  const description = `Watch ${nicheTitle.toLowerCase()} ${contentKind.toLowerCase()} on ${SITE_NAME}. Browse trending, newest and most viewed clips in this niche.`;
  const canonical = abs(`/explore/${tab}/${tagSlug}`);

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ExploreNicheTagPage() {
  // ✅ no props passed, your UI still uses useParams()
  return <ExploreNicheTagClient />;
}
