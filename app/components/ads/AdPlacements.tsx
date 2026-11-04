"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { Mail, ExternalLink } from "lucide-react";

// Original Goon Gram JuicyAds zones, preserved across the new shell.
export type AdZone = 1108263 | 1107996 | 1108264 | 1125709 | 1125710;

const SLOTS: Record<AdZone, { width: number; height: number }> = {
  1108263: { width: 308, height: 2592 }, // desktop feed / Reels
  1107996: { width: 300, height: 50 },   // mobile top banner
  1108264: { width: 308, height: 2592 }, // mobile menu
  1125709: { width: 308, height: 2592 }, // watch desktop
  1125710: { width: 308, height: 2592 }, // watch mobile
};

declare global {
  interface Window { adsbyjuicy?: any[] }
}

export function AdSlot({ zone }: { zone: AdZone }) {
  const pathname = usePathname();
  const registered = useRef<string | null>(null);
  const slotRef = useRef<HTMLElement | null>(null);
  const registrationKey = `${pathname}:${zone}`;

  const queueAd = useCallback(() => {
    // Next.js loads the script only once: re-request the placement on navigation.
    if (registered.current === registrationKey || !slotRef.current?.getClientRects().length) return;
    registered.current = registrationKey;
    window.adsbyjuicy = window.adsbyjuicy || [];
    window.adsbyjuicy.push({ adzone: zone });
  }, [registrationKey, zone]);

  useEffect(() => {
    registered.current = null;
    const frame = window.requestAnimationFrame(queueAd);
    window.addEventListener("resize", queueAd);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", queueAd);
    };
  }, [queueAd]);

  const slot = SLOTS[zone];
  return <>
    <Script
      id="goongram-juicyads-loader"
      src="https://poweredby.jads.co/js/jads.js"
      strategy="afterInteractive"
      data-cfasync="false"
      onReady={queueAd}
    />
    <ins
      key={registrationKey}
      ref={slotRef}
      id={String(zone)}
      data-width={slot.width}
      data-height={slot.height}
      className="block"
      style={{ minWidth: slot.width }}
    />
  </>;
}

export function AdContactFooter() {
  return <div className="mt-5 border-t border-white/10 pt-4 text-xs text-white/55">
    <div className="mb-3 font-semibold text-white/75">Stay connected</div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <a href="https://www.reddit.com/r/goongram/" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-white">
        Reddit <ExternalLink size={11} />
      </a>
      <a href="https://x.com/goongram" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-white">
        X <ExternalLink size={11} />
      </a>
      <a href="https://discord.gg/MfS4rqQU" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-white">
        Discord <ExternalLink size={11} />
      </a>
    </div>
    <a href="mailto:contact@goongram.com"
      className="mt-4 inline-flex items-center gap-2 break-all text-white/75 transition-colors hover:text-white">
      <Mail size={15} className="shrink-0" /> contact@goongram.com
    </a>
    <div className="mt-4 flex items-center gap-3 text-[11px] text-white/35">
      <Link href="/ads" className="hover:text-white">Advertise</Link>
      <span>© {new Date().getFullYear()} Goon Gram</span>
    </div>
  </div>;
}

export function SponsoredAdPanel({
  zone = 1108263,
  withContacts = true,
  adHeight = 390,
}: {
  zone?: AdZone;
  withContacts?: boolean;
  adHeight?: number;
}) {
  return <section aria-label="Sponsored advertisements" className="w-full min-w-0">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold text-white/65">Sponsored</h2>
      <Link href="/ads" className="text-xs text-white/40 hover:text-white">Advertise</Link>
    </div>
    <div className="w-full max-w-[320px] overflow-hidden rounded-lg border border-white/10 bg-black/50">
      <div className="w-full overflow-x-hidden overflow-y-auto overscroll-contain"
        style={{ height: adHeight, maxHeight: adHeight }}>
        <AdSlot zone={zone} />
      </div>
    </div>
    {withContacts && <AdContactFooter />}
  </section>;
}

export function DesktopReelsAds() {
  return <aside aria-label="Sponsored" className="fixed inset-y-0 right-0 z-30 hidden w-[340px] overflow-y-auto overscroll-y-contain border-l border-white/10 bg-[#0b0d10] px-4 pb-7 pt-7 text-white lg:block">
    <SponsoredAdPanel zone={1108263} withContacts adHeight={440} />
  </aside>;
}

export function MobileBannerAd() {
  return <div aria-label="Sponsored advertisement" className="mx-auto flex h-[60px] w-full items-center justify-center border-b border-white/10 bg-[#0b0d10]">
    <div className="h-[50px] w-[300px] overflow-hidden">
      <AdSlot zone={1107996} />
    </div>
  </div>;
}

export function MobileMenuAds() {
  return <div className="min-w-0 px-4 pb-8">
    <SponsoredAdPanel zone={1108264} withContacts adHeight={340} />
  </div>;
}
