"use client";

import { useCallback, useEffect, useRef } from "react";
import { ExternalLink, Mail } from "lucide-react";

// Current JuicyAds inventory. Every zone is used at most once per page.
export type AdZone =
  | 1130835 // desktop right rail
  | 1130836 // mobile menu
  | 1130838 // watch right rail
  | 1130839 // paused Reel
  | 1130841 // Explore grid
  | 1130842 // mobile header
  | 1130843 // desktop footer
  | 1130846; // mobile menu footer

const SIZES: Record<AdZone, { width: number; height: number }> = {
  1130835: { width: 308, height: 2592 },
  1130836: { width: 308, height: 2592 },
  1130838: { width: 308, height: 2592 },
  1130839: { width: 308, height: 2872 },
  1130841: { width: 266, height: 151 },
  1130842: { width: 125, height: 137 },
  1130843: { width: 308, height: 2592 },
  1130846: { width: 308, height: 2592 },
};

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

/**
 * Register after mounting and again on client navigation.
 * Next/Script caches the library; each fresh ins still needs a fresh push.
 */
export function AdSlot({ zone }: { zone: AdZone }) {
  const node = useRef<HTMLElement | null>(null);
  const requested = useRef<HTMLElement | null>(null);
  const dimensions = SIZES[zone];

  const queueAd = useCallback(() => {
    const current = node.current;
    if (!current || requested.current === current || current.getClientRects().length === 0) return;

    // Use JuicyAds' own queue exactly as its supplied snippet does. The
    // external script processes queued placements when it becomes ready.
    requested.current = current;
    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: zone });
      if (new URLSearchParams(window.location.search).has("adsDebug")) {
        console.info("[Goon Gram ads] queued zone", zone, window.location.pathname);
      }
    } catch (error) {
      requested.current = null;
      console.warn("[Goon Gram ads] queue failed", zone, error);
    }
  }, [zone]);

  useEffect(() => {
    const current = node.current;
    if (!current) return;

    const observer = new IntersectionObserver(
      entries => { if (entries.some(entry => entry.isIntersecting)) queueAd(); },
      { rootMargin: "250px" }
    );
    observer.observe(current);

    // Parent visibility can change without changing the zone or pathname.
    const resizeObserver = new ResizeObserver(queueAd);
    resizeObserver.observe(current);
    const frame = window.requestAnimationFrame(queueAd);

    window.addEventListener("resize", queueAd);
    document.addEventListener("visibilitychange", queueAd);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", queueAd);
      document.removeEventListener("visibilitychange", queueAd);
    };
  }, [queueAd]);

  return <ins
    id={String(zone)}
    ref={node}
    data-width={dimensions.width}
    data-height={dimensions.height}
    className="block"
    style={{ width: dimensions.width, minHeight: dimensions.height }}
  />;
}

export function AdContactFooter() {
  return <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">
    <p className="mb-3 font-semibold text-white/75">Connect</p>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <a href="https://www.reddit.com/r/goongram/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">Reddit <ExternalLink size={11}/></a>
      <a href="https://x.com/goongram" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">X <ExternalLink size={11}/></a>
      <a href="https://discord.gg/MfS4rqQU" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">Discord <ExternalLink size={11}/></a>
    </div>
    <a href="mailto:contact@goongram.com" className="mt-4 inline-flex items-center gap-2 break-all text-white/75 hover:text-white">
      <Mail size={15}/> contact@goongram.com
    </a>
    <div className="mt-4 flex items-center gap-3 text-[11px] text-white/35">
      <a href="/ads" className="hover:text-white">Advertise</a>
      <span>© {new Date().getFullYear()} Goon Gram</span>
    </div>
  </div>;
}

export function SponsoredAdPanel({
  zone = 1130835,
  withContacts = true,
  adHeight = 390,
  title = "Sponsored",
}: {
  zone?: AdZone;
  withContacts?: boolean;
  adHeight?: number;
  title?: string;
}) {
  return <section aria-label={title} className="w-full min-w-0">
    <div className="mb-3 flex items-center justify-between text-xs">
      <h2 className="font-semibold tracking-wide text-white/65">{title}</h2>
      <a href="/ads" className="text-white/40 hover:text-white">Advertise</a>
    </div>
    <div className="w-full max-w-[320px] overflow-hidden rounded-lg border border-white/10 bg-white/[.025] p-[5px]">
      <div className="mx-auto w-[308px] max-w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-sm" style={{height:adHeight}}>
        <AdSlot zone={zone}/>
      </div>
    </div>
    {withContacts && <AdContactFooter/>}
  </section>;
}

/** The right rail scrolls independently of the feed. */
export function DesktopAdRail({ primaryZone = 1130835 }: { primaryZone?: 1130835 | 1130838 }) {
  return <aside aria-label="Sponsored advertisements" className="fixed inset-y-0 right-0 z-20 hidden w-[340px] overflow-y-auto overscroll-y-contain border-l border-white/10 bg-[#0b0d10] px-4 pb-10 pt-7 text-white lg:block">
    <SponsoredAdPanel zone={primaryZone} withContacts={false} adHeight={445}/>
    <AdContactFooter/>
    <div className="mt-12 border-t border-white/10 pt-6">
      <SponsoredAdPanel zone={1130843} withContacts={false} adHeight={370} title="Sponsored · Footer"/>
    </div>
  </aside>;
}

export function DesktopReelsAds() {
  return <DesktopAdRail primaryZone={1130835}/>;
}

/** Header remains 58px high. The supplied tall 125x137 creative is proportionally scaled. */
export function MobileHeaderAd() {
  return <div aria-label="Sponsored header advertisement" className="relative h-[47px] w-[44px] shrink-0 overflow-hidden lg:hidden">
    <div className="absolute left-0 top-0 origin-top-left scale-[0.34]">
      <AdSlot zone={1130842}/>
    </div>
  </div>;
}

export function MobileMenuAds() {
  return <div className="min-w-0 space-y-8 px-4 pb-8">
    <SponsoredAdPanel zone={1130836} withContacts={false} adHeight={310}/>
    <div className="border-t border-white/10 pt-7">
      <SponsoredAdPanel zone={1130846} withContacts={false} adHeight={300} title="Sponsored · Footer"/>
    </div>
    <AdContactFooter/>
  </div>;
}

export function ReelsPauseAd() {
  return <div role="complementary" aria-label="Advertisement while video is paused" className="w-[min(308px,calc(100vw-48px))] rounded-lg border border-white/20 bg-[#101115]/95 p-1.5 shadow-2xl backdrop-blur-md">
    <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-white/65">Sponsored</div>
    <div className="max-h-[125px] w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-sm">
      <AdSlot zone={1130839}/>
    </div>
  </div>;
}

/** One sponsored tile within each Explore grid. Keeps the ad's original dimensions. */
export function ExploreGridAd() {
  return <div className="relative flex h-full w-full min-w-0 items-center justify-center overflow-hidden rounded-sm bg-white/[.04]" aria-label="Sponsored Explore placement">
    <div className="pointer-events-none absolute inset-x-1 top-1 text-center text-[9px] font-medium uppercase tracking-widest text-white/50">Sponsored</div>
    <div className="relative h-[151px] w-[266px] shrink-0 origin-center scale-[0.35] sm:scale-[0.5] xl:scale-[0.65]">
      <AdSlot zone={1130841}/>
    </div>
  </div>;
}

// Legacy mobile banner has been retired: the new mobile placement lives in the header.
export function MobileBannerAd() {
  return null;
}
