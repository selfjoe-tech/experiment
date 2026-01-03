import type { Metadata } from "next";
import AdsPageClient from "./_components/AdsPageClient";

const SITE_NAME = "Upskirt Candy";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

function abs(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const title = `Advertise on ${SITE_NAME}`;
  const description =
    "Run premium banner and in-feed sponsored ads on Upskirt Candy. Preview placements and contact sales@upskirtcandy.com to get started.";
  const canonical = abs("/ads");

  return {
    title,
    description,
    alternates: { canonical },

    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} Ads` },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },

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
  };
}

export default function AdsPage() {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Advertise on ${SITE_NAME}`,
    url: abs("/ads"),
    description:
      "Advertising information and ad placement previews for Upskirt Candy.",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  }).replace(/</g, "\\u003c"); // Next recommends sanitizing "<" in JSON-LD :contentReference[oaicite:2]{index=2}

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <AdsPageClient />
    </>
  );
}
