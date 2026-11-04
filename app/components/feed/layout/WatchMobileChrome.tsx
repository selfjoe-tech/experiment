"use client";

import type { FeedTab } from "@/app/components/feed/types";
import Script from "next/script";
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
  return <MobileNavigation hidden={bottomNavHidden} />;
}

export function WatchMobileJuicyAd() {
  return <>
    <Script id="watch-juicyads-script" src="https://poweredby.jads.co/js/jads.js" strategy="afterInteractive" />
    <div className="overflow-hidden"><ins id="1125710" data-width="308" data-height="2592" /></div>
    <Script id="watch-juicyads-init" strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: "(window.adsbyjuicy = window.adsbyjuicy || []).push({adzone:1125710});" }} />
  </>;
}

export function WatchMobileAdsColumn() {
  return <aside aria-label="Sponsored" className="max-h-[400px] max-w-full overflow-y-auto"><WatchMobileJuicyAd /></aside>;
}
