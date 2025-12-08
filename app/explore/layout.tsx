"use client";

import React, { useState } from "react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import type { FeedTab } from "@/app/components/feed/types";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  const [navHidden, setNavHidden] = useState(false);
  // You can wire navHidden to scroll if you like; explore pages are mostly static.

  // Tabs in MobileChrome aren’t used here, but it provides the same top/bottom bars.
  const [activeTab, setActiveTab] = useState<FeedTab>("forYou");
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <div className="relative min-h-screen bg-black text-white">
      <DesktopShell navHidden={navHidden} />
      <MobileChrome
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSearching={isSearching}
        onSearchOpen={() => setIsSearching(true)}
        onSearchClose={() => { setIsSearching(false); setQuery(""); }}
        searchQuery={query}
        setSearchQuery={setQuery}
      />
      {children}
    </div>
  );
}
