
"use client";

import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import AdDismissButton from "@/app/components/ads/AdDismissButton";
import { XIcon } from "@/app/components/ui/ContactUs";

/**
 * Four existing JuicyAds publisher zones.
 * Original 308×2592 dimensions are preserved.
 *
 * Every placement stays mounted once per page. The visible close button
 * dismisses this group without reloading ads or removing home-only links.
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
  const pathname = usePathname();
  const showHomeLinks = pathname === "/";

  // If no content is left on a non-home page, remove the ad section entirely.
  if (closed && !showHomeLinks) return null;

  return (
    <aside
      aria-label="Sponsored advertisements"
      className="relative isolate z-0 w-full min-w-0"
    >
      {!closed && (
        <>
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/65">
              Sponsored advertisements
            </span>
            <AdDismissButton
              onClick={() => setClosed(true)}
              label="Close all advertisements"
            />
          </div>

          {/* The four original publisher zones are mounted at most once per page. */}
          <div
            className="flex w-full flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-3 snap-x snap-mandatory [scrollbar-width:thin]"
          >
            {ZONES.map((zone) => (
              <StaticAd
                key={zone.key}
                zone={zone}
                compactOnMobile={compactOnMobile}
              />
            ))}
          </div>
        </>
      )}

      {/* These links belong to the home page, not the shared ad placement. */}
      {showHomeLinks && (
        <nav
          aria-label="Follow and contact Goon Gram"
          className="mt-3 w-full min-w-0 border-t border-white/10 pt-3"
        >
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
            Connect with us
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://x.com/gooongram"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Goon Gram on X"
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[.045] px-2 py-3 text-[12px] font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              <XIcon />
              <span>X</span>
            </a>
            <a
              href="mailto:contact@goongram.com"
              aria-label="Email Goon Gram"
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[.045] px-2 py-3 text-[12px] font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              <Mail size={21} aria-hidden="true" />
              <span>Email</span>
            </a>
          </div>
        </nav>
      )}
    </aside>
  );
}
