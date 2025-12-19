// app/components/feed/TagVideoFeed.tsx
"use client";

import React, {
  UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import VideoCard from "./VideoCard";
import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
import type { Video } from "./types";
import { fetchVideosByTagBatch, registerView } from "@/lib/actions/mediaFeed";

const BATCH_SIZE = 3;
const PREFETCH_AHEAD = 2;

// windowing (same idea as VideoFeed)
const MAX_WINDOW = 9;
const KEEP_BEHIND = 1;

type FeedState = { items: Video[]; dropped: number };
type Action =
  | { type: "reset"; seed?: Video[] }
  | { type: "append"; items: Video[]; currentIndex: number };

function reducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case "reset":
      return { items: action.seed ?? [], dropped: 0 };

    case "append": {
      const merged = [...state.items, ...action.items];

      const excess = Math.max(0, merged.length - MAX_WINDOW);
      const maxPrunable = Math.max(0, action.currentIndex - KEEP_BEHIND);
      const prune = Math.min(excess, maxPrunable);

      if (prune <= 0) return { ...state, items: merged };
      return { items: merged.slice(prune), dropped: state.dropped + prune };
    }

    default:
      return state;
  }
}

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

  const [state, dispatch] = useReducer(reducer, { items: [], dropped: 0 });
  const { items: videos, dropped } = state;

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

  const seenIdsRef = useRef<Set<number>>(new Set());

  // ignore stale async results when tag changes
  const tagSessionRef = useRef(0);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(null);

  const toggleMute = () => setIsMuted((p) => !p);

  // card height for spacer math
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

  // current index in window (used for pruning + loadLevel)
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const videosLenRef = useRef(0);
  useEffect(() => {
    videosLenRef.current = videos.length;
  }, [videos.length]);

  const rafTickingRef = useRef(false);

  // gate prefetch by GLOBAL last index, not window length
  const lastPrefetchGlobalLastRef = useRef<number>(-1);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;
    if (!tagSlug) return;
    if (fullscreenOpen) return; // don’t load behind overlay

    const sessionAtStart = tagSessionRef.current;

    loadingRef.current = true;
    setLoading(true);
    setFeedError(null);

    try {
      // optional safety cap:
      // const excludeIds = Array.from(seenIdsRef.current).slice(-600);
      const excludeIds = Array.from(seenIdsRef.current);

      const batch = await fetchVideosByTagBatch({
        slug: tagSlug,
        limit: BATCH_SIZE,
        excludeIds,
      });

      // tag changed while fetching → ignore
      if (tagSessionRef.current !== sessionAtStart) return;

      if (!batch || batch.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }

      const bumped = batch.map((v) => ({
        ...v,
        views: (v.views ?? 0) + 1,
      }));

      dispatch({
        type: "append",
        items: bumped,
        currentIndex: currentIndexRef.current,
      });

      // register views + mark seen
      bumped.forEach((v) => {
        if (typeof v.mediaId === "number") {
          seenIdsRef.current.add(v.mediaId);
          registerView(v.mediaId);
        }
      });
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
  }, [tagSlug, fullscreenOpen]);

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

      // absolute index in the full feed
      const absoluteIndex = Math.round(el.scrollTop / h);

      // index within current window (after dropped)
      const idxInWindow = clamp(
        absoluteIndex - dropped,
        0,
        Math.max(0, videosLenRef.current - 1)
      );

      if (idxInWindow !== currentIndexRef.current) {
        currentIndexRef.current = idxInWindow;
        setCurrentIndex(idxInWindow);
      }

      // Prefetch based on GLOBAL last index
      const len = videosLenRef.current;
      if (!loadingRef.current && hasMoreRef.current && len > 0) {
        const globalLastIndex = dropped + len - 1;
        const shouldPrefetch = absoluteIndex >= globalLastIndex - PREFETCH_AHEAD;

        if (shouldPrefetch && lastPrefetchGlobalLastRef.current !== globalLastIndex) {
          lastPrefetchGlobalLastRef.current = globalLastIndex;
          loadMore();
        }
      }
    });
  };

  // keep currentIndex correct after pruning/appending
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const h = cardH || el.clientHeight || window.innerHeight || 1;
    const absoluteIndex = Math.round(el.scrollTop / h);

    const idxInWindow = clamp(
      absoluteIndex - dropped,
      0,
      Math.max(0, videos.length - 1)
    );

    currentIndexRef.current = idxInWindow;
    setCurrentIndex(idxInWindow);
  }, [dropped, videos.length, cardH]);

  // reset when tag changes
  useEffect(() => {
    tagSessionRef.current += 1;

    dispatch({ type: "reset", seed: [] });

    setHasMore(true);
    hasMoreRef.current = true;
    setInitialLoaded(false);
    setFeedError(null);

    seenIdsRef.current.clear();

    lastScrollTop.current = 0;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    lastPrefetchGlobalLastRef.current = -1;

    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    if (tagSlug) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagSlug]);

  const noVideos = !loading && initialLoaded && videos.length === 0;

  return (
    <>
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative h-screen snap-y snap-mandatory overflow-y-scroll overscroll-y-contain
                   lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
      >
        {feedError && (
          <div className="sticky top-0 z-20 bg-red-900/90 text-red-100 text-xs px-4 py-2 text-center">
            {feedError}
          </div>
        )}

        {noVideos && (
          <div className="flex h-full items-center justify-center text-white/70">
            No videos for this niche yet.
          </div>
        )}

        {/* Spacer keeps scroll stable when we prune */}
        {dropped > 0 && cardH > 0 && (
          <div aria-hidden style={{ height: dropped * cardH }} className="snap-none" />
        )}

        {videos.map((video, index) => {
          // Only keep src attached for current + 1 neighbor (VideoFeed style)
          const dist = Math.abs(index - currentIndex);
          const loadLevel: "active" | "near" | "off" =
            dist === 0 ? "active" : dist === 1 ? "near" : "off";

          const key = `media-${video.mediaId ?? video.id}`;

          return (
            <section
              key={key}
              className="snap-center snap-always flex items-center justify-center h-screen w-full lg:h-[100dvh]"
            >
              <VideoCard
                video={video}
                onRequestFullscreen={() => {
                  setFullscreenStartId(video.id);
                  setFullscreenOpen(true);
                }}
                toggleMute={toggleMute}
                isMuted={isMuted}
                loadLevel={loadLevel}
              />
            </section>
          );
        })}
      </main>

      {/* Loader OUTSIDE snap list so it doesn’t create snap points */}
      {loading && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-full bg-black/70 border border-white/15 px-4 py-2 text-xs text-white/80 backdrop-blur">
            Loading…
          </div>
        </div>
      )}

      <FullscreenVideoOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        videos={videos}
        initialVideoId={fullscreenStartId}
        toggleMute={toggleMute}
        isMuted={isMuted}
        onEndReached={loadMore}
        isLoadingMore={loading}
      />
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