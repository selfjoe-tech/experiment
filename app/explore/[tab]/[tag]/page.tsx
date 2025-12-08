// app/explore/[tab]/[tag]/page.tsx
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
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
  const tab = params?.tab || "niches";
  const tagSlug = params?.tag || "";

  // Just to keep MobileChrome + nav working; we don't show ForYou/Trending switch.
  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const nicheTitle = slugToTitle(tagSlug); // e.g. "Gaming Fever"

  // You said this route is specifically for niches; if someone hits /explore/gifs/foo
  // you could optionally guard/redirect, but I'll just let it run.

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      

      {/* Top center: show the niche name instead of ForYou/Trending tabs */}
      

      <TagVideoFeed
        tagSlug={tagSlug}
        onScrollDirectionChange={(direction) =>
          setDesktopNavHidden(direction === "down")
        }
      />
    </div>
  );
}
