"use client";

import { useEffect, useState } from "react";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";
import WatchBottomAds from "@/app/components/ads/WatchBottomAds";

const WAIT_MS = 3000;

/**
 * Reuses seven unique ad placements:
 *   1130842 SitewideAd (already mounted in RootLayout),
 *   1130835 / 1130836 / 1130843 / 1130846 StaticPageAdPair,
 *   1130841 / 1107996 WatchBottomAds.
 *
 * Never duplicate the floating zone or trigger watch earnings on this page.
 */
export default function AdBreakClient({ destination }: { destination: string }) {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((WAIT_MS - (Date.now() - startedAt)) / 1000));
      setSecondsLeft(remaining);
    }, 150);
    const redirect = window.setTimeout(() => {
      // Keep the interstitial out of the browser's Back history.
      window.location.replace(destination);
    }, WAIT_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
    };
  }, [destination]);

  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] pb-14 text-white">
      <main className="mx-auto w-full max-w-[1220px] px-4 pb-16 pt-16 sm:px-6 lg:px-10 lg:pt-20">
        <header className="mb-9 max-w-3xl">
          <div className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-pink-300">
            Sponsored message
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Continuing to your page
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            You will be redirected automatically in {secondsLeft} {secondsLeft === 1 ? "second" : "seconds"}.
          </p>
          <div
            role="progressbar"
            aria-label="Redirect countdown"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={3 - secondsLeft}
            className="mt-5 h-1.5 w-full max-w-lg overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full bg-pink-500 transition-[width] duration-150 ease-linear"
              style={{ width: String(((3 - secondsLeft) / 3) * 100) + "%" }}
            />
          </div>
          <a
            href={destination}
            data-skip-ad-break="true"
            className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-white/20 px-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            Continue now
          </a>
        </header>

        <section aria-label="Existing site advertisements" className="space-y-8">
          <StaticPageAdPair compactOnMobile />
          <WatchBottomAds />
        </section>
      </main>
    </div>
  );
}
