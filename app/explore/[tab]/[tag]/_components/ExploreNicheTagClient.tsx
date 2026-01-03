"use client";

import React, { useCallback, useState } from "react";
import TagVideoFeed from "@/app/components/feed/TagVideoFeed";
import type { FeedTab } from "@/app/components/feed/types";

export default function ExploreNicheTagClient({
  tab,
  tagSlug,
}: {
  tab: string;
  tagSlug: string;
}) {
  // Keep MobileChrome nav happy (even if not displayed)
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const onScrollDirectionChange = useCallback((direction: "up" | "down") => {
    const nextHidden = direction === "down";
    setDesktopNavHidden((prev) => (prev === nextHidden ? prev : nextHidden));
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <TagVideoFeed tagSlug={tagSlug} onScrollDirectionChange={onScrollDirectionChange} />
    </div>
  );
}
