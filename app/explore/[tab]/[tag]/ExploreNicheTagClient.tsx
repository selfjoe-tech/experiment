"use client";

import React, { useCallback, useState } from "react";
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

export default function ExploreNicheTagClient() {
  const params = useParams<{ tab: string; tag: string }>();
  const rawTab = params?.tab || "niches";
  const tagSlug = params?.tag || "";

  const tab: string = ["gifs", "images", "creators", "niches"].includes(rawTab) ? rawTab : "niches";

  // Keep MobileChrome nav happy (even if not displayed)
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const onScrollDirectionChange = useCallback((direction: "up" | "down") => {
    const nextHidden = direction === "down";
    setDesktopNavHidden((prev) => (prev === nextHidden ? prev : nextHidden));
  }, []);

  // These values are still computed here if you use them for UI later
  const nicheTitle = slugToTitle(tagSlug);
  const contentKind = tab === "images" ? "Images" : tab === "gifs" ? "GIFs" : "Videos";

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
        
      <TagVideoFeed tagSlug={tagSlug} onScrollDirectionChange={onScrollDirectionChange} />
    </div>
  );
}
