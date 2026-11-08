
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const ZONE = 1130842;

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

export default function SitewideAd() {
  const requested = useRef(false);
  const [closed, setClosed] = useState(false);

  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (requested.current) return;

    requested.current = true;

    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({
        adzone: ZONE,
      });

      if (
        new URLSearchParams(window.location.search).has("adsDebug")
      ) {
        console.info(
          "[Goon Gram ads] queued sitewide zone",
          ZONE
        );
      }
    } catch (error) {
      requested.current = false;

      console.warn(
        "[Goon Gram ads] unable to queue sitewide placement",
        error
      );
    }
  }, []);

  // Completely unmount the placement in local development.
  if (isDevelopment && closed) {
    return null;
  }

  return (
    <aside
      aria-label="Sponsored advertisement"
      className="
        pointer-events-none fixed isolate
        right-2 top-[68px] z-[45]
        w-[137px] overflow-hidden
        rounded-lg border border-white/10
        bg-[#101115] p-[5px] shadow-lg
        lg:right-4 lg:top-4
      "
    >
      <div className="relative flex items-center justify-between pb-1">
        <span className="text-[9px] font-medium uppercase tracking-wide text-white/50">
          Sponsored
        </span>

        {isDevelopment && (
          <button
            type="button"
            onClick={() => setClosed(true)}
            aria-label="Close advertisement"
            title="Close advertisement"
            className="
              pointer-events-auto relative z-20
              flex h-5 w-5 items-center justify-center
              rounded bg-white/10 text-white
              transition-colors hover:bg-white/25
            "
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <ins
        id={String(ZONE)}
        data-width="125"
        data-height="137"
        className="pointer-events-auto block"
        style={{
          width: 125,
          height: 137,
        }}
      />
    </aside>
  );
}
