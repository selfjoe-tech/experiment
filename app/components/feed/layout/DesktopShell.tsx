"use client";

import { usePathname } from "next/navigation";
import { DesktopNavigation } from "./AppNavigation";
import { DesktopAdRail } from "@/app/components/ads/AdPlacements";

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
  return <DesktopAdRail/>;
}

// Legacy import compatibility.
export function JuicyAd() {
  return <DesktopAdRail/>;
}
