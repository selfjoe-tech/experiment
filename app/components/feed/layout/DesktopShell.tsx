"use client";

import { DesktopNavigation } from "./AppNavigation";

export default function DesktopShell({ navHidden: _navHidden = false }: { navHidden?: boolean }) {
  return <DesktopNavigation/>;
}

// No advertising may be mounted from route-specific shells.
export function DesktopAdsColumn() { return null; }
export function JuicyAd() { return null; }
