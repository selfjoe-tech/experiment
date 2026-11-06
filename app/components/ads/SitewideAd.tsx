"use client";

import { useEffect, useRef } from "react";

/**
 * The site's only JuicyAds placement. Never conditional on route, viewport,
 * scrolling, tabs, menu state, or video playback. Native 125x137 dimensions.
 */
const ZONE = 1130842;

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

export default function SitewideAd() {
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: ZONE });
      if (new URLSearchParams(window.location.search).has("adsDebug")) {
        console.info("[Goon Gram ads] queued permanent sitewide zone", ZONE);
      }
    } catch (error) {
      requested.current = false;
      console.warn("[Goon Gram ads] unable to queue sitewide placement", error);
    }
  }, []);

  return (
    <aside
      aria-label="Sponsored advertisement"
      className="pointer-events-none fixed isolate right-2 top-[68px] z-[1] w-[137px] overflow-hidden rounded-lg border border-white/10 bg-[#101115] p-[5px] shadow-lg lg:right-4 lg:top-4"
    >
      <div className="pb-1 text-[9px] font-medium uppercase tracking-wide text-white/50">Sponsored</div>
      <ins
        id={String(ZONE)}
        data-width="125"
        data-height="137"
        className="pointer-events-auto block"
        style={{ width: 125, height: 137 }}
      />
    </aside>
  );
}
