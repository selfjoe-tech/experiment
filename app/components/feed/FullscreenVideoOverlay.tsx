"use client";

import React, { UIEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import VideoCard, { SponsoredVideoCard } from "./VideoCard";
import type { Video } from "./types";
import { registerView, registerAdView } from "@/lib/actions/mediaFeed";

const PREFETCH_AHEAD = 2;
const SNAP_SETTLE_MS = 90;     // debounce after scroll ends
const SNAP_EPS_PX = 2;         // how close is "already snapped"
const PROGRAMMATIC_GUARD_MS = 220;

type Props = {
  open: boolean;
  onClose: () => void;

  videos?: Video[];
  initialVideoId?: string | null;
  initialIndex?: number | null;

  baseIndex?: number;

  onEndReached?: () => void;
  isLoadingMore?: boolean;

  toggleMute?: () => void;
  isMuted?: boolean;

  urlMode?: "query" | "path";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function FullscreenPlaceholder() {
  // NO animation: animations across many sections make mobile jank.
  return <div className="w-full h-full bg-neutral-900" />;
}

function buildNextHref(opts: { baseHref: string; urlMode: "query" | "path"; videoId: string }) {
  const { baseHref, urlMode, videoId } = opts;

  if (urlMode === "path") {
    const u = new URL(baseHref);
    return `${u.origin}/embed/${videoId}`;
  }

  const u = new URL(baseHref);
  u.searchParams.set("fs", "1");
  u.searchParams.set("v", String(videoId));
  return u.toString();
}

/**
 * Stable viewport height on mobile:
 * visualViewport.height is MUCH better than 100vh / innerHeight when URL bar moves.
 */
function useStableViewportHeight(open: boolean) {
  const [vh, setVh] = useState(0);
  const vhRef = useRef(0);

  useLayoutEffect(() => {
    if (!open) return;

    const vv = window.visualViewport;

    const read = () => {
      const next = Math.round((vv?.height ?? window.innerHeight) || 0);
      if (!next) return;
      if (vhRef.current !== next) {
        vhRef.current = next;
        setVh(next);
      }
    };

    read();

    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read); // iOS URL bar can change height on scroll
    window.addEventListener("resize", read);

    return () => {
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [open]);

  return { vh, vhRef };
}

export default function FullscreenVideoOverlay({
  open,
  onClose,
  videos = [],
  initialVideoId,
  initialIndex,
  baseIndex = 0,
  onEndReached,
  isLoadingMore,
  toggleMute,
  isMuted,
  urlMode = "query",
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { vh, vhRef } = useStableViewportHeight(open);
  const snapH = vh > 0 ? `${vh}px` : "100dvh";

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  const viewedKeysConfirmRef = useRef<Set<string>>(new Set());

  // fallback mute state if not provided
  const [internalMuted, setInternalMuted] = useState(true);
  const effectiveMuted = typeof isMuted === "boolean" ? isMuted : internalMuted;
  const effectiveToggleMute =
    toggleMute ??
    (() => {
      setInternalMuted((m) => !m);
    });

  // URL restore
  const restoreHrefRef = useRef<string | null>(null);

  // guard to ignore scroll events we caused
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<number | null>(null);

  // scroll throttling
  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const didInitialScrollRef = useRef(false);
  const lastPrefetchGlobalLastRef = useRef<number>(-1);

  // lock body scroll + capture current URL
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    restoreHrefRef.current = window.location.href;

    return () => {
      document.body.style.overflow = prevOverflow;

      if (restoreHrefRef.current) {
        window.history.replaceState(window.history.state, "", restoreHrefRef.current);
      }
      restoreHrefRef.current = null;
    };
  }, [open]);

  // cleanup timers/raf when closing
  useEffect(() => {
    if (open) return;

    didInitialScrollRef.current = false;
    viewedKeysConfirmRef.current.clear();
    setActiveIndex(0);
    activeIndexRef.current = 0;
    lastPrefetchGlobalLastRef.current = -1;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;

    if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = null;

    programmaticScrollRef.current = false;
  }, [open]);

  function computeIndex(scrollTop: number, h: number, len: number) {
    if (len <= 0) return 0;
    // center-based rounding is stable for snap-start sections
    return clamp(Math.floor((scrollTop + h * 0.5) / h), 0, len - 1);
  }

  function snapToIndex(idx: number, behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    const h = vhRef.current || 0;
    if (!el || !h) return;

    const top = idx * h;
    if (Math.abs(el.scrollTop - top) <= SNAP_EPS_PX) return;

    programmaticScrollRef.current = true;
    el.scrollTo({ top, behavior });

    if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, PROGRAMMATIC_GUARD_MS);
  }

  // initial scroll (once per open)
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!vhRef.current) return;
    if (videos.length === 0) return;
    if (didInitialScrollRef.current) return;

    const idx =
      typeof initialIndex === "number"
        ? initialIndex
        : initialVideoId != null
        ? videos.findIndex((v) => v.id === initialVideoId)
        : 0;

    const targetIdx = clamp(idx >= 0 ? idx : 0, 0, Math.max(0, videos.length - 1));

    // force exact alignment (no smooth) so it doesn't “land between items”
    snapToIndex(targetIdx, "auto");

    setActiveIndex(targetIdx);
    activeIndexRef.current = targetIdx;
    didInitialScrollRef.current = true;
  }, [open, videos.length, initialVideoId, initialIndex, vh]);

  // URL mount: replace URL for the active video
  useEffect(() => {
    if (!open) return;
    const baseHref = restoreHrefRef.current;
    const v = videos[activeIndex];
    if (!baseHref || !v) return;

    const nextHref = buildNextHref({
      baseHref,
      urlMode,
      videoId: String(v.id),
    });

    window.history.replaceState(window.history.state, "", nextHref);
  }, [open, activeIndex, videos.length, urlMode]);

  // register view/ad-view
  useEffect(() => {
    if (!open) return;
    const v = videos[activeIndex];
    if (!v) return;

    const anyV = v as any;
    const isAd = !!anyV._isAd;

    const key = isAd
      ? `ad-${String(anyV._adId ?? v.id)}`
      : `media-${String(v.mediaId ?? v.id)}`;

    if (viewedKeysConfirmRef.current.has(key)) return;
    viewedKeysConfirmRef.current.add(key);

    if (isAd) {
      const adId = anyV._adId != null ? String(anyV._adId) : null;
      if (adId) registerAdView(adId).catch(() => {});
      return;
    }

    const mediaId = typeof anyV.mediaId === "number" ? anyV.mediaId : Number(v.id);
    if (!Number.isNaN(mediaId)) registerView(mediaId).catch(() => {});
  }, [open, activeIndex, videos.length]);

  // prefetch near end
  useEffect(() => {
    if (!open) return;
    if (!onEndReached) return;
    if (isLoadingMore) return;
    if (videos.length === 0) return;

    const globalActive = baseIndex + activeIndex;
    const globalLast = baseIndex + videos.length - 1;

    if (globalActive < globalLast - PREFETCH_AHEAD) return;

    if (lastPrefetchGlobalLastRef.current === globalLast) return;
    lastPrefetchGlobalLastRef.current = globalLast;

    onEndReached();
  }, [open, activeIndex, videos.length, baseIndex, onEndReached, isLoadingMore]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (programmaticScrollRef.current) return;

    const el = e.currentTarget;
    const h = vhRef.current || el.clientHeight || window.innerHeight || 1;

    // RAF throttle state updates
    if (rafRef.current == null) {
      const top = el.scrollTop;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const idx = computeIndex(top, h, videos.length);

        if (idx !== activeIndexRef.current) {
          activeIndexRef.current = idx;
          setActiveIndex(idx);
        }
      });
    }

    // Debounced "snap settle" to prevent “lazy” half positions on mobile
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      const idx = computeIndex(el.scrollTop, h, videos.length);
      snapToIndex(idx, "smooth");
    }, SNAP_SETTLE_MS);
  };

  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-[90]
        bg-black
        lg:bg-black/70 lg:backdrop-blur-xl
        h-full flex flex-col
      "
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        // IMPORTANT: height uses visualViewport value, not 100vh
        style={{
          height: snapH,
          overscrollBehaviorY: "contain",
          WebkitOverflowScrolling: "touch",
        }}
        className="
          flex-1 overflow-y-scroll
          snap-y snap-mandatory
          touch-pan-y
        "
      >
        {videos.map((video, absIdx) => {
          const anyVideo = video as any;
          const isAd = !!anyVideo._isAd;
          const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;

          const isActive = absIdx === activeIndex;
          const dist = Math.abs(absIdx - activeIndex);

          return (
            <section
              key={`fs-${absIdx}-${String((video as any).id ?? absIdx)}`}
              style={{
                height: snapH,
                scrollSnapAlign: "start",
                // this helps prevent skipping multiple items (supported on modern browsers)
                scrollSnapStop: "always",
              }}
              className="w-full flex items-center justify-center"
            >
              {isActive ? (
                isAd ? (
                  <SponsoredVideoCard
                    video={video}
                    isMuted={effectiveMuted}
                    toggleMute={effectiveToggleMute}
                    visitUrl={visitUrl || "#"}
                    loadLevel="active"
                  />
                ) : (
                  <VideoCard
                    video={video}
                    showFullscreenButton={false}
                    toggleMute={effectiveToggleMute}
                    isMuted={effectiveMuted}
                    onClose={onClose}
                    open={open}
                    loadLevel="active"
                    fullscreen 
                  />
                )
              ) : dist <= 1 ? (
                // near items: lightweight placeholder (still no pulse)
                <FullscreenPlaceholder />
              ) : (
                // far items: even cheaper
                <div className="w-full h-full bg-black" />
              )}
            </section>
          );
        })}

        {isLoadingMore && (
          <div className="py-6 text-center text-sm text-neutral-400">Loading more…</div>
        )}
      </div>
    </div>
  );
}


// "use client";

// import React, { UIEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
// import { ChevronUp, ChevronDown } from "lucide-react";
// import VideoCard, { SponsoredVideoCard } from "./VideoCard";
// import type { Video } from "./types";
// import { registerView, registerAdView } from "@/lib/actions/mediaFeed";

// const PREFETCH_AHEAD = 2;

// // render window (this is the memory fix)
// const RENDER_BEHIND = 1;
// const RENDER_AHEAD = 2;

// type Props = {
//   open: boolean;
//   onClose: () => void;

//   videos?: Video[];
//   initialVideoId?: string | null;

//   // ✅ IMPORTANT: when parent prunes/windowing (VideoFeed), pass its dropped count here
//   baseIndex?: number;

//   onEndReached?: () => void;
//   isLoadingMore?: boolean;

//   toggleMute: () => void;
//   isMuted: boolean;
// };

// function clamp(n: number, min: number, max: number) {
//   return Math.max(min, Math.min(max, n));
// }

// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos = [],
//   initialVideoId,
//   baseIndex = 0,
//   onEndReached,
//   isLoadingMore,
//   toggleMute,
//   isMuted,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);

//   const [activeIndex, setActiveIndex] = useState(0);
//   const activeIndexRef = useRef(0);

//   const viewedKeysConfirmRef = useRef<Set<string>>(new Set());

//   // lock body scroll
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // measure page height (needed for correct index math + spacers)
//   const [pageH, setPageH] = useState(0);
//   useLayoutEffect(() => {
//     if (!open) return;
//     const el = scrollRef.current;
//     if (!el) return;

//     const update = () => setPageH(el.clientHeight || window.innerHeight || 0);
//     update();

//     const ro = new ResizeObserver(update);
//     ro.observe(el);
//     window.addEventListener("resize", update);

//     return () => {
//       ro.disconnect();
//       window.removeEventListener("resize", update);
//     };
//   }, [open]);

//   // reset on close
//   const didInitialScrollRef = useRef(false);
//   useEffect(() => {
//     if (open) return;
//     didInitialScrollRef.current = false;
//     viewedKeysConfirmRef.current.clear();
//     setActiveIndex(0);
//     activeIndexRef.current = 0;
//     lastPrefetchGlobalLastRef.current = -1;
//   }, [open]);

//   // initial scroll (only once)
//   useEffect(() => {
//     if (!open) return;
//     if (!scrollRef.current) return;
//     if (!pageH) return;
//     if (videos.length === 0) return;
//     if (didInitialScrollRef.current) return;

//     const idx =
//       initialVideoId != null
//         ? videos.findIndex((v) => v.id === initialVideoId)
//         : 0;

//     const targetIdx = idx >= 0 ? idx : 0;

//     requestAnimationFrame(() => {
//       const el = scrollRef.current;
//       if (!el) return;
//       el.scrollTop = targetIdx * pageH;
//       setActiveIndex(targetIdx);
//       activeIndexRef.current = targetIdx;
//       didInitialScrollRef.current = true;
//     });
//   }, [open, pageH, videos.length, initialVideoId]);

//   // register view when active changes (avoid depending on full `videos` array identity)
//   useEffect(() => {
//     if (!open) return;
//     const v = videos[activeIndex];
//     if (!v) return;

//     const anyV = v as any;
//     const isAd = !!anyV._isAd;

//     const key = isAd
//       ? `ad-${String(anyV._adId ?? v.id)}`
//       : `media-${String(v.mediaId ?? v.id)}`;

//     if (viewedKeysConfirmRef.current.has(key)) return;
//     viewedKeysConfirmRef.current.add(key);

//     if (isAd) {
//       const adId = anyV._adId != null ? String(anyV._adId) : null;
//       if (adId) {
//         registerAdView(adId).catch((err) =>
//           console.error("registerAdView (fullscreen) error", err)
//         );
//       }
//       return;
//     }

//     const mediaId =
//       typeof (v as any).mediaId === "number"
//         ? (v as any).mediaId
//         : Number(v.id);

//     if (!Number.isNaN(mediaId)) {
//       registerView(mediaId).catch((err) =>
//         console.error("registerView (fullscreen) error", err)
//       );
//     }
//   }, [open, activeIndex, videos.length]);

//   // Prefetch gating like VideoFeed: gate by GLOBAL last index, not list length
//   const lastPrefetchGlobalLastRef = useRef<number>(-1);

//   useEffect(() => {
//     if (!open) return;
//     if (!onEndReached) return;
//     if (isLoadingMore) return;
//     if (videos.length === 0) return;

//     const globalActive = baseIndex + activeIndex;
//     const globalLast = baseIndex + videos.length - 1;

//     if (globalActive < globalLast - PREFETCH_AHEAD) return;

//     // only once per globalLast index
//     if (lastPrefetchGlobalLastRef.current === globalLast) return;
//     lastPrefetchGlobalLastRef.current = globalLast;

//     onEndReached();
//   }, [open, activeIndex, videos.length, baseIndex, onEndReached, isLoadingMore]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const el = e.currentTarget;
//     const h = pageH || el.clientHeight || window.innerHeight || 1;
//     const idx = Math.round(el.scrollTop / h);

//     if (idx >= 0 && idx < videos.length && idx !== activeIndexRef.current) {
//       activeIndexRef.current = idx;
//       setActiveIndex(idx);
//     }
//   };

//   // ✅ VIRTUALIZED WINDOW (memory fix)
//   const start = videos.length
//     ? clamp(activeIndex - RENDER_BEHIND, 0, videos.length - 1)
//     : 0;
//   const end = videos.length
//     ? clamp(activeIndex + RENDER_AHEAD, 0, videos.length - 1)
//     : 0;

//   const windowItems = videos.slice(start, end + 1);
//   const topSpacerH = pageH > 0 ? start * pageH : 0;
//   const bottomSpacerH = pageH > 0 ? (videos.length - 1 - end) * pageH : 0;

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = (pageH || window.innerHeight || 1) * 0.9;
//     container.scrollTo({
//       top: container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };

//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl h-full flex flex-col">
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll overscroll-y-contain"
//       >
//         {/* top spacer (NO SNAP) */}
//         {topSpacerH > 0 && (
//           <div aria-hidden style={{ height: topSpacerH }} className="snap-none" />
//         )}

//         {windowItems.map((video, i) => {
//           const absIdx = start + i;
//           const anyVideo = video as any;
//           const isAd = !!anyVideo._isAd;
//           const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;

//           const dist = Math.abs(absIdx - activeIndex);
//           const loadLevel: "active" | "near" | "off" =
//             dist === 0 ? "active" : dist === 1 ? "near" : "off";

//           if (isAd) {
//             return (
//               <section
//                 data-fullscreen-idx={absIdx}
//                 key={absIdx}
//                 className="snap-center snap-always flex items-center justify-center h-screen lg:h-[100dvh] w-full"
//               >
//                 <SponsoredVideoCard
//                   video={video}
//                   isMuted={isMuted}
//                   toggleMute={toggleMute}
//                   visitUrl={visitUrl || "#"}
//                   loadLevel={loadLevel}
//                 />
//               </section>
//             );
//           }

//           return (
//             <section
//               data-fullscreen-idx={absIdx}
//               key={absIdx}
//               className="snap-center snap-always flex items-center justify-center h-screen lg:h-[100dvh] w-full"
//             >
//               <VideoCard
//                 video={video}
//                 showFullscreenButton={false}
//                 toggleMute={toggleMute}
//                 isMuted={isMuted}
//                 onClose={onClose}
//                 open={open}
//                 loadLevel={loadLevel}
//               />
//             </section>
//           );
//         })}

//         {/* bottom spacer (NO SNAP) */}
//         {bottomSpacerH > 0 && (
//           <div aria-hidden style={{ height: bottomSpacerH }} className="snap-none" />
//         )}

//         {isLoadingMore && (
//           <div className="py-6 text-center text-sm text-neutral-400">
//             Loading more…
//           </div>
//         )}
//       </div>

      
//     </div>
//   );
// }


// "use client";

// import React, {
//   UIEvent,
//   useEffect,
//   useLayoutEffect,
//   useRef,
//   useState,
// } from "react";
// import { ChevronUp, ChevronDown } from "lucide-react";
// import VideoCard, { SponsoredVideoCard } from "./VideoCard";
// import type { Video } from "./types";
// import { registerView, registerAdView } from "@/lib/actions/mediaFeed";

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   videos?: Video[];
//   initialVideoId?: string | null;
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
//   toggleMute: () => void;
//   isMuted: boolean;
// };

// // fetch when user reaches: second-to-last item
// const PREFETCH_OFFSET_FROM_END = 1;

// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos = [],
//   initialVideoId,
//   onEndReached,
//   isLoadingMore,
//   toggleMute,
//   isMuted,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);

//   const [activeIndex, setActiveIndex] = useState(0);
//   const viewedKeysRef = useRef<Set<string>>(new Set());

//   // ✅ prevents re-scrolling when videos append
//   const didInitialScrollRef = useRef(false);

//   // ✅ keeps current scrollTop stable across appends
//   const scrollTopRef = useRef(0);

//   // ✅ prevents spamming onEndReached for the same list length
//   const requestedAtLengthRef = useRef<number>(0);

//   // Lock body scroll while overlay is open
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // Reset per open/close
//   useEffect(() => {
//     if (open) return;
//     didInitialScrollRef.current = false;
//     requestedAtLengthRef.current = 0;
//     viewedKeysRef.current.clear();
//     setActiveIndex(0);
//     scrollTopRef.current = 0;
//   }, [open]);

//   // ✅ Scroll to the clicked video ONLY ONCE (when overlay opens + videos available)
//   useEffect(() => {
//     if (!open) return;
//     if (!scrollRef.current) return;
//     if (videos.length === 0) return;
//     if (didInitialScrollRef.current) return;

//     const container = scrollRef.current;

//     const idx = initialVideoId
//       ? videos.findIndex((v) => v.id === initialVideoId)
//       : 0;

//     const targetIdx = idx >= 0 ? idx : 0;

//     // wait a tick so sections exist
//     requestAnimationFrame(() => {
//       const section = container.querySelector<HTMLElement>(
//         `[data-fullscreen-idx="${targetIdx}"]`
//       );

//       if (section) {
//         section.scrollIntoView({ block: "center" });
//       } else {
//         container.scrollTop = 0;
//       }

//       // record current scrollTop so appends don't yank it
//       scrollTopRef.current = container.scrollTop;
//       setActiveIndex(targetIdx);

//       didInitialScrollRef.current = true;
//     });
//   }, [open, initialVideoId, videos.length]); // 👈 IMPORTANT: depend on videos.length, not videos

//   // ✅ Keep scroll position when new videos append
//   useLayoutEffect(() => {
//     if (!open) return;
//     const el = scrollRef.current;
//     if (!el) return;
//     el.scrollTop = scrollTopRef.current;
//   }, [open, videos.length]);

//   // Register views when activeIndex changes
//   useEffect(() => {
//     if (!open) return;
//     const currentVideo = videos[activeIndex];
//     if (!currentVideo) return;

//     const anyVideo = currentVideo as any;
//     const isAd = !!anyVideo._isAd;
//     const adId: string | undefined = anyVideo._adId; // align with your other code
//     const mediaIdNum = Number(currentVideo.id);

//     const key = isAd ? `ad-${adId ?? currentVideo.id}` : `media-${currentVideo.id}`;
//     if (viewedKeysRef.current.has(key)) return;
//     viewedKeysRef.current.add(key);

//     if (isAd) {
//       if (typeof adId === "string") {
//         registerAdView(adId).catch((err) =>
//           console.error("registerAdView (fullscreen) error", err)
//         );
//       }
//     } else {
//       if (!Number.isNaN(mediaIdNum)) {
//         registerView(mediaIdNum).catch((err) =>
//           console.error("registerView (fullscreen video) error", err)
//         );
//       }
//     }
//   }, [open, activeIndex, videos]);

//   // ✅ Prefetch earlier: when user reaches 1 video before the end
//   useEffect(() => {
//     if (!open) return;
//     if (!onEndReached) return;
//     if (isLoadingMore) return;
//     if (videos.length === 0) return;

//     const triggerIndex = Math.max(0, videos.length - 1 - PREFETCH_OFFSET_FROM_END);
//     if (activeIndex < triggerIndex) return;

//     // only request once per current length
//     if (requestedAtLengthRef.current === videos.length) return;
//     requestedAtLengthRef.current = videos.length;

//     onEndReached();
//   }, [open, activeIndex, videos.length, onEndReached, isLoadingMore]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const target = e.currentTarget;
//     const current = target.scrollTop;

//     scrollTopRef.current = current;

//     // detect which "page" is active
//     const pageHeight = target.clientHeight || window.innerHeight || 1;
//     const approxIndex = Math.round(current / pageHeight);

//     if (approxIndex >= 0 && approxIndex < videos.length && approxIndex !== activeIndex) {
//       setActiveIndex(approxIndex);
//     }
//   };

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = window.innerHeight * 0.9;
//     container.scrollTo({
//       top: container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };

//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl h-full flex flex-col">
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {videos.map((video, index) => {
//           const anyVideo = video as any;
//           const isAd = !!anyVideo._isAd;
//           const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;

//           if (isAd) {
//             return (
//               <section
//                 data-fullscreen-idx={index}
//                 key={index} // ✅ as requested
//                 className="snap-center snap-always flex items-center justify-center h-screen lg:h-[100dvh] w-full"
//               >
//                 <SponsoredVideoCard
//                   video={video}
//                   isMuted={isMuted}
//                   toggleMute={toggleMute}
//                   visitUrl={visitUrl || "#"}
//                 />
//               </section>
//             );
//           }

//           return (
//             <section
//               data-fullscreen-idx={index}
//               key={index} // ✅ as requested
//               className="snap-center snap-always flex items-center justify-center h-screen lg:h-[100dvh] w-full"
//             >
//               <VideoCard
//                 video={video}
//                 showFullscreenButton={false}
//                 toggleMute={toggleMute}
//                 isMuted={isMuted}
//                 onClose={onClose}
//                 open={open}
//               />
//             </section>
//           );
//         })}

//         {isLoadingMore && (
//           <div className="py-6 text-center text-sm text-neutral-400">Loading more…</div>
//         )}
//       </div>

//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
//         <button onClick={() => scrollOneStep("up")} aria-label="Previous video">
//           <ChevronUp className="h-6 w-6" />
//         </button>
//         <button onClick={() => scrollOneStep("down")} aria-label="Next video">
//           <ChevronDown className="h-6 w-6" />
//         </button>
//       </div>
//     </div>
//   );
// }





// "use client";

// import React, { UIEvent, useEffect, useRef, useState } from "react";
// import { X, ChevronUp, ChevronDown, MoveLeft } from "lucide-react";
// import VideoCard, { SponsoredVideoCard } from "./VideoCard";
// import type { Video } from "./types";

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   videos?: Video[];             // can still be optional from the parent's POV
//   initialVideoId?: string | null;
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
//   toggleMute: () => void;
//   isMuted: boolean;
// };

// const SCROLL_END_THRESHOLD = 400; // px from bottom

// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos = [],          // 👈 default to empty array so videos is NEVER undefined
//   initialVideoId,
//   onEndReached,
//   isLoadingMore,
//   toggleMute,
//   isMuted
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);
//   const [fullScreen, setFullScreen] = useState(true)

//   // Lock body scroll while overlay is open
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // When opened, scroll to the clicked video
//   useEffect(() => {
//     if (!open || !scrollRef.current || videos.length === 0) return;

//     const container = scrollRef.current;
//     const idx = initialVideoId
//       ? videos.findIndex((v) => v.id === initialVideoId)
//       : 0;

//     const targetIdx = idx >= 0 ? idx : 0;
//     const section = container.querySelector<HTMLElement>(
//       `[data-fullscreen-idx="${targetIdx}"]`
//     );

//     if (section) {
//       section.scrollIntoView({ block: "center" });
//     } else {
//       container.scrollTop = 0;
//     }
//   }, [open, initialVideoId, videos]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const target = e.currentTarget;
//     const current = target.scrollTop;
//     lastScrollTop.current = current;

//     // Infinite-scroll hook like we had before
//     if (!onEndReached || isLoadingMore) return;

//     const distanceFromBottom =
//       target.scrollHeight - (target.scrollTop + target.clientHeight);

//     if (distanceFromBottom < SCROLL_END_THRESHOLD) {
//       onEndReached();
//     }
//   };

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = window.innerHeight * 0.9; // almost a full page
//     container.scrollTo({
//       top: container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };


//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl  h-full flex flex-col">
//       {/* Top bar */}
      

//       {/* Scrollable vertical feed */}
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {videos.map((video, index) => {
//   const anyVideo = video as any;
//   const isAd = !!anyVideo._isAd;
//   const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;
//   const key = isAd ? `ad-${video.id}` : `media-${video.id}`;

//   if (isAd) {
//     // Sponsored ad card: no fullscreen button, has "Visit page"
//     return (
//       <section
//         data-fullscreen-idx={index}
//         key={key}
//         className="
//           snap-center snap-always
//           flex items-center justify-center
//           h-[calc(100dvh-7.5rem)]
//           h-screen
//           lg:h-[100dvh]
//           w-full
//         "
//       >
//         <SponsoredVideoCard
//           video={video}
//           isMuted={isMuted}
//           toggleMute={toggleMute}
//           visitUrl={visitUrl || "#"}
//           // no onRequestFullscreen → fullscreen button already hidden
//         />
//       </section>
//     );
//   }

//   // Regular content
//   return (
//     <section
//       key={index}
//       data-fullscreen-idx={index}
//       className="
//         snap-center snap-always
//         flex items-center justify-center
//         h-[calc(100dvh-7.5rem)]
//         h-screen
//         lg:h-[100dvh]
//         w-full
//       "
//     >
//       <VideoCard
//         video={video} 
//         showFullscreenButton={false} 
//         toggleMute={toggleMute}
//         isMuted={isMuted}
//         onClose={onClose}
//         open={open}
//       />
//     </section>
//   );
// })}

//         {isLoadingMore && (
//           <div className="py-6 text-center text-sm text-neutral-400">
//             Loading more…
//           </div>
//         )}
//       </div>

//       {/* Up/down controls on the right (desktop only) */}
//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        
//         <NavCircleButton
//           onClick={() => scrollOneStep("up")}
//           ariaLabel="Previous video"
//         >
//           <ChevronUp className="h-6 w-6" />
//         </NavCircleButton>
//         <NavCircleButton
//           onClick={() => scrollOneStep("down")}
//           ariaLabel="Next video"
//         >
//           <ChevronDown className="h-6 w-6" />
//         </NavCircleButton>
//       </div>
//     </div>
//   );
// }

function NavCircleButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-10 w-10 rounded-full border border-white/40 bg-black/60
                 flex items-center justify-center text-white hover:bg-black"
    >
      {children}
    </button>
  );
}







// "use client";

// import React, { UIEvent, useEffect, useRef } from "react";
// import { X, ChevronUp, ChevronDown } from "lucide-react";
// import VideoCard from "./VideoCard";
// import type { Video } from "./types";

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   videos?: Video[];             // <-- make optional
//   initialVideoId?: string | null;
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
// };


// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos,
//   initialVideoId,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   // Lock body scroll while overlay is open
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // When opened, scroll to the clicked video
//   useEffect(() => {
//     if (!open) return;
//     const container = scrollRef.current;
//     if (!container) return;

//     const idx = initialVideoId
//       ? videos.findIndex((v) => v.id === initialVideoId)
//       : 0;

//     const targetIdx = idx >= 0 ? idx : 0;
//     const section = container.querySelector<HTMLElement>(
//       `[data-fullscreen-idx="${targetIdx}"]`
//     );

//     if (section) {
//       section.scrollIntoView({ block: "center" });
//     } else {
//       container.scrollTop = 0;
//     }
//   }, [open, initialVideoId, videos]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     lastScrollTop.current = current;
//   };

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = window.innerHeight * 0.9; // almost a full page
//     container.scrollTo({
//       top:
//         container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };

//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl flex flex-col">
//       {/* Top bar */}
//       <header className="flex items-center justify-between px-6">
//         <span className="text-sm text-white/70">Fullscreen feed</span>
        
//       </header>

//       {/* Scrollable vertical feed */}
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {videos.map((video, index) => (
//           <section
//             key={video.id}
//             data-fullscreen-idx={index}
//             className="snap-center snap-always flex items-center justify-center h-[95vh] w-full mb-10"
//           >
//             {/* Re-use VideoCard but hide its own fullscreen button */}
//             <VideoCard
//               video={video}
//               showFullscreenButton={false}
//             />
//           </section>
//         ))}
//       </div>

//       {/* Up/down controls on the right (desktop only) */}
//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
//       <button
//           onClick={onClose}
//           className="rounded-full p-2 hover:bg-white/10 mb-50"
//           aria-label="Close fullscreen"
//         >
//           <X className="h-5 w-5" />
//         </button>
//         <NavCircleButton
//           onClick={() => scrollOneStep("up")}
//           ariaLabel="Previous video"
//         >
//           <ChevronUp className="h-6 w-6" />
//         </NavCircleButton>
//         <NavCircleButton
//           onClick={() => scrollOneStep("down")}
//           ariaLabel="Next video"
//         >
//           <ChevronDown className="h-6 w-6" />
//         </NavCircleButton>
//       </div>
//     </div>
//   );
// }

// function NavCircleButton({
//   children,
//   onClick,
//   ariaLabel,
// }: {
//   children: React.ReactNode;
//   onClick: () => void;
//   ariaLabel: string;
// }) {
//   return (
//     <button
//       type="button"
//       aria-label={ariaLabel}
//       onClick={onClick}
//       className="h-10 w-10 rounded-full border border-white/40 bg-black/60
//                  flex items-center justify-center text-white hover:bg-black"
//     >
//       {children}
//     </button>
//   );
// }
