import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import JuicyAdsLoader from "@/app/components/ads/JuicyAdsLoader";
import SitewideAd from "@/app/components/ads/SitewideAd";
import AdultAgeGate from "@/app/components/age/AdultAgeGate";
import UploadStatusProvider from "@/app/components/upload/UploadStatusProvider";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Goon Gram";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://goongram.com").replace(/\/$/, "");
const DEFAULT_TITLE = `${SITE_NAME} | Porn GIFs, Videos & Clips`;
const DEFAULT_DESCRIPTION =
  "Goon Gram is a short-form adult video and GIF platform. Discover trending creators, niches, and content in a continuous feed.";
const DEFAULT_OG_IMAGE = "https://goongram.com/images/logo.png";

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": SITE_URL + "/#website", name: SITE_NAME, url: SITE_URL,
      publisher: { "@id": SITE_URL + "/#organization" } },
    { "@type": "Organization", "@id": SITE_URL + "/#organization",
      name: SITE_NAME, url: SITE_URL, logo: SITE_URL + "/icons/logo7.png" },
  ],
};

function SiteJsonLd() {
  // Next recommends rendering JSON-LD script tags in layout/page components.
  // Also: replace "<" to avoid accidental HTML parsing (extra-safe pattern).
  const json = JSON.stringify(siteJsonLd).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(SITE_URL),

    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },

    description: DEFAULT_DESCRIPTION,

    // Per-page titles, canonical URLs, and keywords belong to their own routes.
    other: { rating: "adult" },

    // Put arbitrary verification meta tags in metadata (lands in <head>)
    verification: {
      ...(process.env.GOOGLE_SITE_VERIFICATION
        ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
      other: {
        "juicyads-site-verification": "50181bcfdf34b852dbb8a24813c6930a",
        ...(process.env.BING_SITE_VERIFICATION
          ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {}),
      },
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

    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          alt: `${SITE_NAME} logo`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },

    applicationName: SITE_NAME,
    creator: SITE_NAME,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
        <meta name="juicyads-site-verification" content="d154c93bad30202f17ebc96da399812a"></meta>
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextTopLoader
          color="#ec4899"
          height={3}
          showSpinner={false}
          crawl={true}
          speed={200}
        />

        <SiteJsonLd />
        <AdultAgeGate>
          <UploadStatusProvider>
            <JuicyAdsLoader />
            <SitewideAd />
            {children}
          </UploadStatusProvider>
        </AdultAgeGate>
      </body>
    </html>
  );
}
