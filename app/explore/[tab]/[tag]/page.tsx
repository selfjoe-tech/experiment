"use client";

import React, { useState } from "react";
import Head from "next/head"; // 👈 NEW
import { useParams } from "next/navigation";
import TagVideoFeed from "@/app/components/feed/TagVideoFeed";
import type { FeedTab } from "@/app/components/feed/types";

function slugToTitle(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function ExploreNicheTagPage() {
  const params = useParams<{ tab: string; tag: string }>();
  const rawTab = params?.tab || "niches";
  const tagSlug = params?.tag || "";

  // normalize tab
  const tab: string =
    ["gifs", "images", "creators", "niches"].includes(rawTab) ? rawTab : "niches";

  // Keep MobileChrome nav happy (even if not displayed)
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const nicheTitle = slugToTitle(tagSlug); // e.g. "Gaming Fever"

  // ====== SEO STRINGS ======
  const contentKind =
    tab === "images"
      ? "Images"
      : tab === "gifs"
      ? "GIFs"
      : "Videos";

  const title = `${nicheTitle} ${contentKind} | UpskirtCandy`;
  const description = `Watch ${nicheTitle.toLowerCase()} ${contentKind.toLowerCase()} on UpskirtCandy. Browse trending, newest and most viewed clips in this niche.`;
  const canonical = `https://upskirtcandy.com/explore/${tab}/${tagSlug}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "UpskirtCandy",
      url: "https://upskirtcandy.com",
    },
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index,follow" />

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="UpskirtCandy" />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema),
          }}
        />
      </Head>

      <div className="relative min-h-screen bg-black text-white overflow-hidden">
        <TagVideoFeed
          tagSlug={tagSlug}
          onScrollDirectionChange={(direction) =>
            setDesktopNavHidden(direction === "down")
          }
        />
      </div>
    </>
  );
}
