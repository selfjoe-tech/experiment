"use client";

import { usePathname } from "next/navigation";
import { DesktopNavigation } from "./AppNavigation";
import { SponsoredAdPanel } from "@/app/components/ads/AdPlacements";

export default function DesktopShell({ navHidden: _navHidden = false }: { navHidden?: boolean }) {
  const pathname = usePathname();
  // Home and Reels have dedicated rails, avoiding duplicate advertisement IDs.
  const showShellAds = pathname !== "/" && pathname !== "/reels" && !pathname.startsWith("/watch/");
  return <>
    <DesktopNavigation />
    {showShellAds && <DesktopAdsColumn />}
  </>;
}

export function DesktopAdsColumn() {
  return <aside aria-label="Sponsored advertisements" className="fixed inset-y-0 right-0 z-30 hidden w-[340px] overflow-y-auto border-l border-white/10 bg-[#0b0d10] px-4 pb-7 pt-7 text-white lg:block">
    <SponsoredAdPanel zone={1108263} withContacts adHeight={440} />
  </aside>;
}

// Maintained for legacy imports.
export function JuicyAd() {
  return <SponsoredAdPanel zone={1108263} withContacts={false} adHeight={400}/>;
}
