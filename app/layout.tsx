import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Upskirt Candy";
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");
const DEFAULT_TITLE = `${SITE_NAME} | Porn GIFs, Videos & Clips`;
const DEFAULT_DESCRIPTION =
  "Upskirt Candy is a short-form adult video and GIF platform. Discover trending creators, niches, and content in a continuous feed.";
const DEFAULT_OG_IMAGE =
  "https://dzgpkywovaezlaabuxhl.supabase.co/storage/v1/object/public/og-images/brand/logo7.png";

const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    SITE_NAME,
    "adult gifs",
    "adult short clips",
    "nsfw gifs",
    "adult creator platform",
    "porn gifs",
    "upskirt videos",
    "upskirt creampie",
    "adult social feed",
    "short form adult video",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
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
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  applicationName: SITE_NAME,
  creator: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="juicyads-site-verification" content="50181bcfdf34b852dbb8a24813c6930a"></meta>
        <meta name="6a97888e-site-verification" content="469cfda4ca51063fa73eab8f03ed6f37"></meta>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
