"use client";

import Script from "next/script";

/**
 * Load the original JuicyAds v3 script once per document.
 * The vendor snippet queues adzone requests in window.adsbyjuicy,
 * even when the script has not finished downloading. Do not gate
 * placements behind a Next.js onReady callback.
 */
export default function JuicyAdsLoader() {
  return <Script
    id="goongram-juicyads-loader"
    src="https://poweredby.jads.co/js/jads.js"
    strategy="afterInteractive"
    data-cfasync="false"
    onError={() => {
      console.warn("[Goon Gram ads] JuicyAds script could not load. Check network requests and browser extensions.");
    }}
  />;
}
