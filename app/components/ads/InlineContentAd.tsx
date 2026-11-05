"use client";

import { useEffect, useRef } from "react";

/**
 * The only extra publisher zone: one 266×151 in-content placement per page.
 *
 * Do not place this component inside .map(), virtualization, modals, menus,
 * playback branches or tab-dependent JSX. The site's working 1130842
 * remains untouched in RootLayout.
 */
const ZONE = 1130841;

declare global {
  interface Window {
    adsbyjuicy?: Array<{ adzone: number }>;
  }
}

export default function InlineContentAd({ variant = "banner" }: { variant?: "banner" | "tile" }) {
  const requested = useRef(false);
  const frame = useRef<HTMLDivElement>(null);
  const creative = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    try {
      (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: ZONE });
      if (new URLSearchParams(window.location.search).has("adsDebug")) {
        console.info("[Goon Gram ads] queued stable in-content zone", ZONE, window.location.pathname);
      }
    } catch (error) {
      requested.current = false;
      console.warn("[Goon Gram ads] unable to queue in-content placement", error);
    }
  }, []);

  useEffect(() => {
    if (variant !== "tile") return;
    const box = frame.current;
    const content = creative.current;
    if (!box || !content) return;
    const measure = () => {
      // Resize only the visual wrapper, never replace or re-request <ins>.
      const scale = Math.min(1, Math.max(0.1, box.clientWidth / 266));
      content.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [variant]);

  return <section aria-label="Sponsored advertisement"
    className={variant === "tile"
      ? "relative isolate z-0 h-full w-full min-w-0 overflow-hidden rounded-[2px] bg-[#18191e]"
      : "relative isolate z-0 mx-auto w-[278px] max-w-full rounded-lg border border-white/10 bg-[#101115] p-[5px]"}>
    {variant === "banner" && <div className="pb-1 text-[9px] font-medium uppercase tracking-wider text-white/50">Sponsored</div>}
    <div ref={frame} className={variant === "tile" ? "relative h-full w-full" : "relative h-[151px] w-[266px] max-w-full"}>
      <div ref={creative}
        className={variant === "tile" ? "absolute left-1/2 top-1/2 origin-center" : "relative"}
        style={variant === "tile" ? { width: 266, height: 151, transform: "translate(-50%, -50%) scale(0.38)" } : undefined}>
        <ins id={String(ZONE)} data-width="266" data-height="151" className="block"
          style={{ width: 266, height: 151 }}/>
      </div>
    </div>
    {variant === "tile" && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white/75">Sponsored</span>}
  </section>;
}
