// app/components/feed/TagVideoFeed.tsx
"use client";

import React, {
  UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import VideoCard from "./VideoCard";
import type { Video } from "./types";
import { fetchVideosByTagBatch, registerView } from "@/lib/actions/mediaFeed";
import { Loader, LoaderPinwheel } from "lucide-react";

const BATCH_SIZE = 3;
const PREFETCH_AHEAD = 2;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props = {
  tagSlug: string;
  onScrollDirectionChange?: (direction: "up" | "down") => void;
};

export default function TagVideoFeed({ tagSlug, onScrollDirectionChange }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  const [maximize, setMaximize] = useState(false);

  const [videos, setVideos] = useState<Video[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // Exclude session duplicates
  const seenIdsRef = useRef<Set<number>>(new Set());
  // Only count a view once per session (even if user scrolls back)
  const viewedIdsRef = useRef<Set<number>>(new Set());

  // Ignore stale async results when tag changes
  const tagSessionRef = useRef(0);

  const toggleMute = () => setIsMuted((p) => !p);

  // --- overlay mode ---
  const [overlayOpen, setOverlayOpen] = useState(false);

  // card height for scroll math
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => setCardH(el.clientHeight || window.innerHeight || 0);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // preserve abs index when switching UI layouts
  const pendingScrollAbsIndexRef = useRef<number | null>(null);

  const requestScrollToAbsIndex = useCallback((absIndex: number) => {
    pendingScrollAbsIndexRef.current = absIndex;
  }, []);

  const openOverlayAtIndex = useCallback(
    (absIndex: number) => {
      requestScrollToAbsIndex(absIndex);
      setOverlayOpen((prev) => !prev);
    },
    [requestScrollToAbsIndex]
  );

  const closeOverlay = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setOverlayOpen(false);
      return;
    }
    const h = cardH || el.clientHeight || window.innerHeight || 1;
    const absIndex = Math.round(el.scrollTop / h);
    requestScrollToAbsIndex(absIndex);
    setOverlayOpen(false);
  }, [cardH, requestScrollToAbsIndex]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScrollAbsIndexRef.current == null) return;
    if (!cardH) return;

    el.scrollTop = pendingScrollAbsIndexRef.current * cardH;
    pendingScrollAbsIndexRef.current = null;
  }, [overlayOpen, cardH]);

  useEffect(() => {
    if (!overlayOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [overlayOpen, closeOverlay]);

  // current snapped index
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const videosLenRef = useRef(0);
  useEffect(() => {
    videosLenRef.current = videos.length;
  }, [videos.length]);

  const rafTickingRef = useRef(false);

  // prevent spamming prefetch while snapping near the end
  const lastPrefetchLenRef = useRef<number>(0);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;
    if (!tagSlug) return;

    const sessionAtStart = tagSessionRef.current;

    loadingRef.current = true;
    setLoading(true);
    setFeedError(null);

    try {
      const excludeIds = Array.from(seenIdsRef.current);

      const batch = await fetchVideosByTagBatch({
        slug: tagSlug,
        limit: BATCH_SIZE,
        excludeIds,
      });

      if (tagSessionRef.current !== sessionAtStart) return;

      if (!batch || batch.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }

      // update exclude set
      for (const v of batch) {
        if (typeof v.mediaId === "number") seenIdsRef.current.add(v.mediaId);
      }

      setVideos((prev) => [...prev, ...batch]);
    } catch (err: any) {
      console.error("Tag feed loadMore error", err);
      setFeedError(err?.message ?? "Failed to load videos.");
    } finally {
      if (tagSessionRef.current === sessionAtStart) {
        setLoading(false);
        setInitialLoaded(true);
      }
      loadingRef.current = false;
    }
  }, [tagSlug]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;

    const cur = el.scrollTop;
    const delta = cur - lastScrollTop.current;
    if (Math.abs(delta) > 4 && onScrollDirectionChange) {
      onScrollDirectionChange(delta > 0 ? "down" : "up");
    }
    lastScrollTop.current = cur;

    if (rafTickingRef.current) return;
    rafTickingRef.current = true;

    requestAnimationFrame(() => {
      rafTickingRef.current = false;

      const h = cardH || el.clientHeight || window.innerHeight || 1;
      const absoluteIndex = Math.round(el.scrollTop / h);

      const idx = clamp(absoluteIndex, 0, Math.max(0, videosLenRef.current - 1));
      if (idx !== currentIndexRef.current) {
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
      }

      // Prefetch when near end
      const len = videosLenRef.current;
      if (!loadingRef.current && hasMoreRef.current && len > 0) {
        const shouldPrefetch = absoluteIndex >= len - 1 - PREFETCH_AHEAD;

        if (shouldPrefetch && lastPrefetchLenRef.current !== len) {
          lastPrefetchLenRef.current = len;
          loadMore();
        }
      }
    });
  };

  // Register view when item becomes ACTIVE (not when fetched)
  useEffect(() => {
    const v = videos[currentIndex];
    if (!v) return;

    const mediaId = v.mediaId;
    if (typeof mediaId !== "number") return;
    if (viewedIdsRef.current.has(mediaId)) return;

    viewedIdsRef.current.add(mediaId);
    registerView(mediaId);
  }, [currentIndex, videos]);

  // ✅ Reset + trigger initial load reliably on client-side navigation
  useEffect(() => {
    tagSessionRef.current += 1;
    const mySession = tagSessionRef.current;

    // hard reset everything
    setVideos([]);
    setHasMore(true);
    hasMoreRef.current = true;

    setLoading(false);
    loadingRef.current = false;

    setInitialLoaded(false);
    setFeedError(null);

    seenIdsRef.current.clear();
    viewedIdsRef.current.clear();

    lastScrollTop.current = 0;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    lastPrefetchLenRef.current = 0;

    // defer load until after route commit/layout settles
    requestAnimationFrame(() => {
      if (tagSessionRef.current !== mySession) return;

      const el = scrollRef.current;
      if (el) el.scrollTop = 0;

      if (tagSlug) loadMore();
    });
  }, [tagSlug, loadMore]);

  // ✅ Safety net: if we land on the page and still have nothing, fetch once
  useEffect(() => {
    if (!tagSlug) return;
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;
    if (videos.length > 0) return;

    loadMore();
  }, [tagSlug, videos.length, loadMore]);

  const noVideos = !loading && initialLoaded && videos.length === 0;

  const mainClass = overlayOpen
    ? "relative z-[80] h-[100dvh] w-full overflow-y-scroll overscroll-y-contain snap-y snap-mandatory shadow-2xl backdrop-blur"
    : "relative h-screen snap-y snap-mandatory overflow-y-scroll overscroll-y-contain lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]";

  const sectionHeightClass = overlayOpen
    ? "h-full w-full"
    : "h-screen w-full lg:h-[100dvh]";

  return (
    <>
      <div className={overlayOpen ? "fixed inset-0 z-[80] grid place-items-center" : "relative"}>
        <main ref={scrollRef} onScroll={handleScroll} className={mainClass}>
          {feedError && (
            <div className="sticky top-0 z-20 bg-red-900/90 text-red-100 text-xs px-4 py-2 text-center">
              {feedError}
            </div>
          )}

          {noVideos && (
            <div className="flex h-full items-center justify-center text-white/70">
              {"No internet :("}
            </div>
          )}

          {videos.map((video, index) => {
            // Only one active => only one <video> mounts (assuming your VideoCard wrapper/placeholder is in place)
            const loadLevel: "active" | "near" | "off" =
              index === currentIndex ? "active" : "off";

            const key = `media-${video.mediaId ?? video.id}`;
            const absIndex = index;

            return (
              <section
                key={key}
                className={`snap-center snap-always flex items-center justify-center w-full ${sectionHeightClass}`}
              >
                <VideoCard
                  video={video}
                  onRequestFullscreen={() => openOverlayAtIndex(absIndex)}
                  toggleMute={toggleMute}
                  isMuted={isMuted}
                  loadLevel={loadLevel}
                  maximize={maximize}
                  changeMaxButton={() => setMaximize((prev) => !prev)}
                />
              </section>
            );
          })}
        </main>
      </div>

      {loading && (
        <div className="pointer-events-none fixed bottom-15 left-1/2 -translate-x-1/2 z-[95]">
          <div className="rounded-full bg-black/70 border border-white/15 px-4 py-2 text-xs text-white/80 backdrop-blur">
            <Loader />
          </div>
        </div>
      )}
    </>
  );
}




// // app/components/feed/TagVideoFeed.tsx
// "use client";

// import React, { UIEvent, useCallback, useEffect, useRef, useState } from "react";
// import VideoCard from "./VideoCard";
// import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
// import type { Video } from "./types";
// import { useInView } from "@/app/components/media/useInView";
// import { fetchVideosByTagBatch, registerView } from "@/lib/actions/mediaFeed";

// type Props = {
//   tagSlug: string; // e.g. "gaming-fever"
//   onScrollDirectionChange?: (direction: "up" | "down") => void;
// };

// export default function TagVideoFeed({ tagSlug, onScrollDirectionChange }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   const [videos, setVideos] = useState<Video[]>([]);
//   const [isMuted, setIsMuted] = useState(true);
//   const [loading, setLoading] = useState(false);
//   const [initialLoaded, setInitialLoaded] = useState(false);
//   const [hasMore, setHasMore] = useState(true);
//   const [feedError, setFeedError] = useState<string | null>(null);

//   const seenIdsRef = useRef<Set<number>>(new Set());
//   const loadingRef = useRef(false);

//   // IMPORTANT: keep hasMore in a ref so loadMore doesn't need it as a dependency
//   const hasMoreRef = useRef(true);
//   useEffect(() => {
//     hasMoreRef.current = hasMore;
//   }, [hasMore]);

//   // used to ignore stale async results when tag changes
//   const tagSessionRef = useRef(0);

//   const [fullscreenOpen, setFullscreenOpen] = useState(false);
//   const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(null);

//   const toggleMute = () => setIsMuted((prev) => !prev);

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     const delta = current - lastScrollTop.current;

//     if (Math.abs(delta) > 4 && onScrollDirectionChange) {
//       onScrollDirectionChange(delta > 0 ? "down" : "up");
//     }

//     lastScrollTop.current = current;
//   };

//   const { ref: sentinelRef, inView: sentinelInView } = useInView<HTMLDivElement>({
//     threshold: 0.1,
//   });

//   const loadMore = useCallback(async (opts?: { initial?: boolean }) => {
//     if (loadingRef.current) return;
//     if (!hasMoreRef.current) return;
//     if (!tagSlug) return;

//     const sessionAtStart = tagSessionRef.current;

//     loadingRef.current = true;
//     setLoading(true);
//     setFeedError(null);

//     try {
//       const excludeIds = Array.from(seenIdsRef.current);

//       const batch = await fetchVideosByTagBatch({
//         slug: tagSlug,
//         limit: 3,
//         excludeIds,
//       });

//       // if tag changed while we were fetching, ignore this result
//       if (tagSessionRef.current !== sessionAtStart) return;

//       if (!batch || batch.length === 0) {
//         hasMoreRef.current = false;
//         setHasMore(false);
//         return;
//       }

//       const bumpedBatch = batch.map((v) => ({ ...v, views: v.views + 1 }));

//       setVideos((prev) => [...prev, ...bumpedBatch]);

//       bumpedBatch.forEach((v) => {
//         seenIdsRef.current.add(v.mediaId);
//       });

//       bumpedBatch.forEach((v) => {
//         registerView(v.mediaId);
//       });
//     } catch (err: any) {
//       console.error("Tag feed loadMore error", err);
//       setFeedError(err?.message ?? "Failed to load videos.");
//     } finally {
//       if (tagSessionRef.current === sessionAtStart) {
//         setLoading(false);
//         setInitialLoaded(true);
//       }
//       loadingRef.current = false;
//     }
//   }, [tagSlug]);

//   // reset ONLY when tag changes (not when hasMore flips)
//   useEffect(() => {
//     tagSessionRef.current += 1;

//     setVideos([]);
//     setHasMore(true);
//     hasMoreRef.current = true;

//     setInitialLoaded(false);
//     setFeedError(null);
//     seenIdsRef.current.clear();
//     loadingRef.current = false;

//     if (tagSlug) {
//       loadMore({ initial: true });
//     }
//   }, [tagSlug, loadMore]);

//   // infinite scroll
//   useEffect(() => {
//     if (!initialLoaded) return;
//     if (!sentinelInView) return;
//     if (!hasMoreRef.current) return;
//     if (fullscreenOpen) return; // avoid loading behind overlay
//     loadMore();
//   }, [sentinelInView, initialLoaded, loadMore, fullscreenOpen]);

//   const noVideos = !loading && initialLoaded && videos.length === 0;

//   return (
//     <>
//       <main
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="relative h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain
//                    lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
//       >
//         {feedError && (
//           <div className="sticky top-0 z-20 bg-red-900/90 text-red-100 text-xs px-4 py-2 text-center">
//             {feedError}
//           </div>
//         )}

//         {noVideos && (
//           <div className="flex h-full items-center justify-center text-white/70">
//             No videos for this niche yet.
//           </div>
//         )}

//         {loading && !initialLoaded && (
//           <div className="flex h-full items-center justify-center text-white/70">
//             Loading…
//           </div>
//         )}

//         {videos.map((video) => (
//           <section
//             key={video.id}
//             className="
//               snap-center snap-always
//               flex items-center justify-center
//               h-screen
//               lg:h-[100dvh]
//               w-full
//             "
//           >
//             <VideoCard
//               video={video}
//               onRequestFullscreen={() => {
//                 setFullscreenStartId(video.id);
//                 setFullscreenOpen(true);
//               }}
//               toggleMute={toggleMute}
//               isMuted={isMuted}
//             />
//           </section>
//         ))}

//         <div ref={sentinelRef} className="h-[1px]" />
//       </main>

//       <FullscreenVideoOverlay
//         open={fullscreenOpen}
//         onClose={() => setFullscreenOpen(false)}
//         videos={videos}
//         initialVideoId={fullscreenStartId}
//       />
//     </>
//   );
// }