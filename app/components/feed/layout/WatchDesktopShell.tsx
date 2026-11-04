"use client";

import { DesktopNavigation } from "./AppNavigation";

export default function WatchDesktopShell({ navHidden: _navHidden = false }: { navHidden?: boolean }) {
  return <DesktopNavigation />;
}

// Compatibility export for existing watch layout imports.
export function WatchDesktopAdsColumn() {
  return null;
}
