
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Four existing JuicyAds publisher zones.
 * Original 308×2592 dimensions are preserved.
 *
 * Development only:
 * A close button dismisses the entire ad container.
 */

type Zone = {
  key: string;
  id: 1130835 | 1130836 | 1130843 | 1130846;
  title: string;
};

const ZONES: readonly Zone[] = [
  { key: "desktop", id: 1130835, title: "Desktop ad" },
  { key: "mobile", id: 1130836, title: "Mobile ad" },
  {
    key: "desktop-footer",
    id: 1130843,
    title: "Desktop footer ad",
  },
  {
    key: "mobile-footer",
    id: 1130846,
    title: "Mobile footer ad",
  },
];

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

function StaticAd({
  zone,
  compactOnMobile,
}: {
  zone: Zone;
  compactOnMobile: boolean;
}) {
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;

    requested.current = true;

    try {
      (
        window.adsbyjuicy =
          window.adsbyjuicy || []
      ).push({
        adzone: zone.id,
      });

      if (
        new URLSearchParams(
          window.location.search
        ).has("adsDebug")
      ) {
        console.info(
          "[Goon Gram ads] queued static zone",
          zone.id,
          window.location.pathname
        );
      }
    } catch (error) {
      requested.current = false;

      console.warn(
        "[Goon Gram ads] unable to queue static zone",
        zone.id,
        error
      );
    }
  }, [zone.id]);

  return (
    <section
      aria-label={zone.title}
      className="
        w-[328px] shrink-0 snap-start
        overflow-hidden rounded-lg
        border border-white/10
        bg-[#111216] p-2 text-white
      "
    >
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/55">
        Sponsored
      </div>

      <div
        className={`
          w-full overflow-x-auto overflow-y-auto
          overscroll-contain rounded-sm
          bg-white/[.025]
          ${
            compactOnMobile
              ? "h-[96px] lg:h-[300px]"
              : "h-[300px] sm:h-[360px]"
          }
        `}
      >
        <ins
          id={String(zone.id)}
          data-width="308"
          data-height="2592"
          className="block"
          style={{
            width: 308,
            minHeight: 2592,
          }}
        />
      </div>
    </section>
  );
}

export default function StaticPageAdPair({
  compactOnMobile = false,
}: {
  compactOnMobile?: boolean;
} = {}) {
  const [closed, setClosed] = useState(false);

  const isDevelopment =
    process.env.NODE_ENV === "development";

  // Development only:
  // Unmount ALL four ads when X is clicked.
  if (isDevelopment && closed) {
    return null;
  }

  return (
    <aside
      aria-label="Sponsored advertisements"
      className={`
        relative isolate z-0 w-full min-w-0
        ${isDevelopment ? "pt-8" : ""}
      `}
    >
      {/* Development-only close button */}
      {isDevelopment && (
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Close all advertisements"
          title="Close advertisements"
          className="
            absolute left-0 top-0 z-30
            flex h-7 w-7 items-center
            justify-center rounded-full
            border border-white/15
            bg-[#202126] text-white/80
            shadow-lg
            transition-all duration-200
            hover:bg-[#35363b]
            hover:text-white
            active:scale-95
          "
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}

      {/* All four existing advertisements */}
      <div
        className="
          flex w-full flex-nowrap
          items-stretch gap-3
          overflow-x-auto overscroll-x-contain
          pb-3 snap-x snap-mandatory
          [scrollbar-width:thin]
        "
      >
        {ZONES.map((zone) => (
          <StaticAd
            key={zone.key}
            zone={zone}
            compactOnMobile={compactOnMobile}
          />
        ))}
      </div>
    </aside>
  );
}
