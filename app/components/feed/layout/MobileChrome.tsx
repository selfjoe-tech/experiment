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

export default function MobileChrome({ bottomNavHidden = false }: Props) {
  return <MobileNavigation hidden={bottomNavHidden} />;
}

// Kept for the existing watch page's inline ad placement.
export function JuicyAd308x1044_1108082() {
  return <>
    <Script id="juicyads-jads" src="https://poweredby.jads.co/js/jads.js" strategy="afterInteractive" />
    <div className="flex max-w-full justify-center overflow-hidden">
      <ins id="1108264" data-width="308" data-height="2592" />
    </div>
    <Script id="juicyads-init-1108264" strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: "(window.adsbyjuicy = window.adsbyjuicy || []).push({adzone:1108264});" }} />
  </>;
}

export function MobiledAdsColumn() {
  return <aside aria-label="Sponsored" className="max-h-[400px] w-[320px] max-w-full overflow-y-auto">
    <JuicyAd308x1044_1108082 />
  </aside>;
}
