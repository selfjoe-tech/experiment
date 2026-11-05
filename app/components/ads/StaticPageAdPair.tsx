"use client";

import { useEffect, useRef } from "react";

/**
 * Four reserved 308px-wide panels sharing the same horizontally scrollable rail.
 * The first two are existing live JuicyAds zones. Additional zones are never
 * reused or invented: set NEXT_PUBLIC_JUICYADS_EXTRA_ZONE_1/2 to two new,
 * distinct JuicyAds IDs configured at 308x2592 in the publisher dashboard.
 *
 * The unconfigured third and fourth panels remain visibly reserved but do
 * not request ads until the actual publisher IDs have been supplied.
 */
type Zone = { key: string; id: number | null; title: string };
const existingIds = new Set([1130835, 1130836, 1130841, 1130842]);
const parseExtraId = (value: string | undefined): number | null => {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && !existingIds.has(n) ? n : null;
};
const extra1 = parseExtraId(process.env.NEXT_PUBLIC_JUICYADS_EXTRA_ZONE_1);
const parsedExtra2 = parseExtraId(process.env.NEXT_PUBLIC_JUICYADS_EXTRA_ZONE_2);
const extra2 = parsedExtra2 !== extra1 ? parsedExtra2 : null;
const ZONES: readonly Zone[] = [
  { key: "original-desktop", id: 1130835, title: "Sponsored placement 1" },
  { key: "original-mobile", id: 1130836, title: "Sponsored placement 2" },
  { key: "extra-1", id: extra1, title: "Sponsored placement 3" },
  { key: "extra-2", id: extra2, title: "Sponsored placement 4" },
];

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

function StaticAd({ zone, compactOnMobile }: { zone: Zone; compactOnMobile: boolean }) {
  const requested = useRef(false);

  useEffect(() => {
    if (zone.id === null || requested.current) return;
    requested.current = true;
    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: zone.id });
      if (new URLSearchParams(window.location.search).has("adsDebug")) {
        console.info("[Goon Gram ads] queued static zone", zone.id, window.location.pathname);
      }
    } catch (error) {
      requested.current = false;
      console.warn("[Goon Gram ads] unable to queue static zone", zone.id, error);
    }
  }, [zone.id]);

  return (
    <section aria-label={zone.title}
      className="w-[328px] shrink-0 snap-start overflow-hidden rounded-lg border border-white/10 bg-[#111216] p-2 text-white">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/55">
        Sponsored
      </div>
      <div className={`w-full overflow-x-auto overflow-y-auto overscroll-contain rounded-sm bg-white/[.025] ${compactOnMobile ? "h-[96px] lg:h-[300px]" : "h-[300px] sm:h-[360px]"}`}>
        {zone.id !== null ? <ins
          id={String(zone.id)}
          data-width="308"
          data-height="2592"
          className="block"
          style={{ width: 308, minHeight: 2592 }}
        /> : <div className="flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-2 px-6 text-center text-white/45">
          <span className="text-xs font-medium">Advertising space</span>
          <span className="text-[10px] leading-4">Awaiting publisher ad zone</span>
        </div>}
      </div>
    </section>
  );
}

export default function StaticPageAdPair({ compactOnMobile = false }: { compactOnMobile?: boolean } = {}) {
  return (
    <aside aria-label="Sponsored advertisements" className="relative isolate z-0 w-full min-w-0">
      <div className="flex w-full flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-3 snap-x snap-mandatory [scrollbar-width:thin]">
        {ZONES.map(zone => <StaticAd key={zone.key} zone={zone} compactOnMobile={compactOnMobile} />)}
      </div>
    </aside>
  );
}
