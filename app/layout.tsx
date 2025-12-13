import type { Metadata,  Viewport } from "next";
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

const SITE_URL = "https://upskirtcandy.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Upskirt Candy – Porn GIFs & Videos",
    template: "%s • Upskirt Candy",
  },
  description:
    "Upskirt Candy is a short-form porn video & GIF platform similar to RedGif. Discover trending creators, niches and content in a doom-scroll style feed.",
    keywords: [
    "Upskirt Candy",
    "adult gifs",
    "adult short clips",
    "nsfw gifs",
    "creator platform",
    "adult creators",
    "porn",
    "xvideos",
    "upskirt",
    "upskirt creampie",
    "sex",
    "pornhub",
    "secretary",
    "sub",
    "stepsister",
    "redgif",
    "onlyfans",
    "fansly",
    "loyalfans",
    "privacy.com"
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Upskirt Candy",
    title: "Upskirt Candy – Porn GIFs, Videos and Images of Upskirts",
    description:
      "Scroll through endless Porn GIFs, videos and images from verified creators.",
    images: [
      {
        url: "/icons/logo7.png", // create a nice branded 1200x630 image
        width: 1200,
        height: 630,
        alt: "Upskirt Candy – Porn Adult GIF & video platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Upskirt Candy – Porn GIFs & Videos & Images - Upskirt - Upskirt Creampie",
    description:
      "Adult short-form GIFs, videos and images from verified creators.",
    images: ["/icons/logo7.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
