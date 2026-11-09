"use client";

import { useEffect, useRef, useState } from "react";
import AdDismissButton from "@/app/components/ads/AdDismissButton";
import InlineContentAd from "@/app/components/ads/InlineContentAd";

/**
 * Additional Watch-page ads sourced from existing publisher inventory.
 * WatchMonetizedAds already owns 1130835, 1130836, 1130843 and 1130846;
 * the sitewide ad owns 1130842. Never repeat those IDs in this section.
 */
const FOOTER_BANNER_ZONE = 1107996;

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

function WatchFooterBannerAd() {
  const requested = useRef(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: FOOTER_BANNER_ZONE });
      if (new URLSearchParams(window.location.search).has("adsDebug")) {
        console.info("[Goon Gram ads] queued Watch footer banner zone", FOOTER_BANNER_ZONE);
      }
    } catch (error) {
      requested.current = false;
      console.warn("[Goon Gram ads] unable to queue Watch footer banner", error);
    }
  }, []);

  if (closed) return null;

  return (
    <section
      aria-label="Sponsored banner advertisement"
      className="w-[312px] max-w-full min-w-0 rounded-lg border border-white/10 bg-[#101115] p-[5px]"
    >
      <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/65">
          Sponsored
        </span>
        <AdDismissButton onClick={() => setClosed(true)} label="Close banner advertisement" />
      </div>
      <div className="w-full overflow-x-auto">
        <ins
          id={String(FOOTER_BANNER_ZONE)}
          data-width="300"
          data-height="50"
          className="block"
          style={{ width: 300, height: 50 }}
        />
      </div>
    </section>
  );
}

export default function WatchBottomAds() {
  return (
    <aside aria-label="More sponsored advertisements" className="border-t border-white/10 pt-6">
      <div className="flex flex-wrap items-start gap-4">
        {/* Existing in-content zone 1130841, not otherwise mounted on Watch. */}
        <InlineContentAd />
        {/* Existing 300×50 mobile-banner zone; one instance on this page. */}
        <WatchFooterBannerAd />
      </div>
    </aside>
  );
}
