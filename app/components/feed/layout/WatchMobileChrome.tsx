"use client";

import type { FeedTab } from "@/app/components/feed/types";
import { MobileNavigation } from "./AppNavigation";

type Props = {
  activeTab?: FeedTab;
  onTabChange?: (tab: FeedTab) => void;
  isSearching?: boolean;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  searchQuery?: string;
  setSearchQuery?: (value: string) => void;
  isLoggedIn?: boolean;
  bottomNavHidden?: boolean;
};

export default function WatchMobileChrome({ bottomNavHidden = false }: Props) {
  return <MobileNavigation hidden={bottomNavHidden}/>;
}

// Legacy compatibility; removed old watch mobile ad zone.
export function WatchMobileJuicyAd() { return null; }
export function WatchMobileAdsColumn() { return null; }
