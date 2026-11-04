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

export default function MobileChrome({ bottomNavHidden = false }: Props) {
  return <MobileNavigation hidden={bottomNavHidden}/>;
}

// Legacy compatibility. Sponsored inventory is now managed by the shared menu.
export function JuicyAd308x1044_1108082() {
  return null;
}

export function MobiledAdsColumn() {
  return null;
}
