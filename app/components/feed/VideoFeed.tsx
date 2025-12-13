// app/components/feed/VideoFeed.tsx
// app/components/feed/VideoFeed.tsx
"use client";

import React, {
  UIEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import VideoCard,  { SponsoredVideoCard } from "./VideoCard";
import type { FeedTab, Video } from "./types";
import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
import { useInView } from "@/app/components/media/useInView";

import {
  fetchTrendingVideosBatch,
  registerView,
  fetchForYouVideosBatch,
  fetchRandomAdForFeed,
  registerAdView,
} from "@/lib/actions/mediaFeed";
import { VideoCardSkeleton } from "../skeletons/VideoCardSkeleton ";

type Props = {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  onScrollDirectionChange?: (direction: "up" | "down") => void;
  initialVideo?: Video | null; // 👈 for /watch/[id]
};

export default function VideoFeed({
  activeTab,
  onTabChange,
  onScrollDirectionChange,
  initialVideo,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  const [videos, setVideos] = useState<Video[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  // IDs we’ve already shown this session (media.id)
  const seenIdsRef = useRef<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const seenAdIdsRef = useRef<Set<number>>(new Set());


  // fullscreen overlay state
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(
    null
  );

  const forYouBatchCountRef = useRef(0);


  const toggleMute = () => setIsMuted((prev) => !prev);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const current = e.currentTarget.scrollTop;
    const delta = current - lastScrollTop.current;

    if (Math.abs(delta) > 4 && onScrollDirectionChange) {
      onScrollDirectionChange(delta > 0 ? "down" : "up");
    }

    lastScrollTop.current = current;
  };

  // Sentinel at the bottom to trigger more loads
  const { ref: sentinelRef, inView: sentinelInView } =
    useInView<HTMLDivElement>({
      threshold: 0.1,
    });

  // const loadMore = useCallback(
  //   async (opts?: { initial?: boolean }) => {
  //     if (loadingRef.current || !hasMore) return;
  //     loadingRef.current = true;
  //     setLoading(true);
  //     setFeedError(null);

  //     try {
  //       const excludeIds = Array.from(seenIdsRef.current);
  //       const batch = await fetchTrendingVideosBatch({
  //         limit: 3,
  //         excludeIds,
  //       });

  //       if (batch.length === 0) {
  //         setHasMore(false);
  //         return;
  //       }

  //       // Optimistically bump view count once per fetched video
  //       const bumpedBatch = batch.map((v) => ({
  //         ...v,
  //         views: v.views + 1,
  //       }));

  //       setVideos((prev) => [...prev, ...bumpedBatch]);

  //       // remember these IDs so we don't re-pick them
  //       bumpedBatch.forEach((v) => {
  //         if (typeof v.mediaId === "number") {
  //           seenIdsRef.current.add(v.mediaId);
  //         }
  //       });

  //       // Fire-and-forget: record actual views in DB
  //       bumpedBatch.forEach((v) => {
  //         if (typeof v.mediaId === "number") {
  //           registerView(v.mediaId);
  //         }
  //       });
  //     } catch (err: any) {
  //       console.error("loadMore feed error", err);
  //       setFeedError(err?.message ?? "Failed to load videos.");
  //     } finally {
  //       setLoading(false);
  //       setInitialLoaded(true);
  //       loadingRef.current = false;
  //     }
  //   },
  //   [hasMore]
  // );

  const loadMore = useCallback(
  async (opts?: { initial?: boolean }) => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setFeedError(null);

    try {
      const excludeIds = Array.from(seenIdsRef.current);
      let batch: Video[] = [];

      // 1) pick the base batch (For You vs Trending)
      if (activeTab === "forYou") {
        const count = forYouBatchCountRef.current;

        if (count > 0 && count % 4 === 0) {
          // every 4th batch: fallback to pure trending
          batch = await fetchTrendingVideosBatch({
            limit: 3,
            excludeIds,
          });
        } else {
          // main case: personalised
          batch = await fetchForYouVideosBatch({
            limit: 3,
            excludeIds,
          });
        }

        forYouBatchCountRef.current = count + 1;
      } else {
        // Trending tab
        batch = await fetchTrendingVideosBatch({
          limit: 3,
          excludeIds,
        });
      }

      if (batch.length === 0) {
        setHasMore(false);
        return;
      }

      // 2) try to fetch ONE random ad and splice it into the batch
      let combined: Video[] = batch;

      const ad = await fetchRandomAdForFeed();
      if (ad && (ad as any)._isAd) {
        const adAny = ad as any;
        const adId: number | undefined = adAny._adId;

        const alreadyShown =
          typeof adId === "number" && seenAdIdsRef.current.has(adId);

        if (!alreadyShown) {
          if (typeof adId === "number") {
            seenAdIdsRef.current.add(adId);
          }

          // insert ad at a random position in [0, batch.length]
          const insertAt = Math.floor(Math.random() * (batch.length + 1));
          combined = [
            ...batch.slice(0, insertAt),
            ad,
            ...batch.slice(insertAt),
          ];
        }
      }

      // 3) Optimistically bump view counts for *non-ad* videos
      const bumped = combined.map((v) => ({
        ...v,
        views: v.views + 1,
      }));

      setVideos((prev) => [...prev, ...bumped]);

      // 4) Register views only for real media (not ads)
      bumped.forEach((v) => {
  const anyV = v as any;

  if (anyV._isAd) {
    const adId: string | undefined = anyV._adId;
    if (typeof adId === "string") {
      registerAdView(adId);
      console.log(adId, "adview triggere")
    }
    return;
  }

  if (typeof v.mediaId === "number") {
    seenIdsRef.current.add(v.mediaId);
    registerView(v.mediaId);
  }
});





    } catch (err: any) {
      console.error("loadMore feed error", err);
      setFeedError(err?.message ?? "Failed to load videos.");
    } finally {
      setLoading(false);
      setInitialLoaded(true);
      loadingRef.current = false;
    }
  },
  [hasMore, activeTab]
);


  const isWatchMode = !!initialVideo;

  // ===== HOME MODE: reset when tab changes (no initialVideo) ===============

  useEffect(() => {
  if (isWatchMode) return; // /watch uses its own effect

  setVideos([]);
  setHasMore(true);
  setInitialLoaded(false);
  setFeedError(null);
  seenIdsRef.current.clear();
  forYouBatchCountRef.current = 0;

  loadMore({ initial: true });
}, [activeTab, loadMore, isWatchMode]);

  // ===== WATCH MODE: seed with initialVideo ONCE, then load more ===========

  useEffect(() => {
    if (!isWatchMode || !initialVideo) return;

    setHasMore(true);
    setInitialLoaded(false);
    setFeedError(null);
    seenIdsRef.current.clear();

    // Exclude the seeded video from random fetches
    if (
      typeof initialVideo.mediaId === "number" &&
      !Number.isNaN(initialVideo.mediaId)
    ) {
      seenIdsRef.current.add(initialVideo.mediaId);
    }

    // Make sure the first item is always the requested video
    setVideos([initialVideo]);

    // then append more random videos underneath
    loadMore({ initial: true });
  }, [initialVideo, isWatchMode, loadMore]);

  // ===== Infinite scroll (same for home + watch) ===========================

  useEffect(() => {
  if (!initialLoaded) return;
  if (!sentinelInView) return;
  if (!hasMore) return;
  if (fullscreenOpen) return;      // 👈 don’t double-load behind the overlay
  loadMore();
}, [sentinelInView, initialLoaded, hasMore, loadMore, fullscreenOpen]);

  

  const noVideos = !loading && initialLoaded && videos.length === 0;

  return (
    <>
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain
                   lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
      >
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

        {loading && (
  <section
    className="
      snap-center snap-always
      flex items-center justify-center
      h-[calc(100dvh-7.5rem)]
      h-screen
      lg:h-[100dvh]
      w-full
    "
  >
    <VideoCardSkeleton />
  </section>
)}

       {videos.map((video, index) => {
  const anyVideo = video as any;
  const isAd = !!anyVideo._isAd;
  const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;
  const key = isAd ? `ad-${video.id}` : `media-${video.id}`;

  if (isAd) {
    // Sponsored ad card: no fullscreen button, has "Visit page"
    return (
      <section
        key={index}
        className="
          snap-center snap-always
          flex items-center justify-center
          h-[calc(100dvh-7.5rem)]
          h-screen
          lg:h-[100dvh]
          w-full
        "
      >
        <SponsoredVideoCard
          video={video}
          isMuted={isMuted}
          toggleMute={toggleMute}
          visitUrl={visitUrl || "#"}
          // no onRequestFullscreen → fullscreen button already hidden
        />
      </section>
    );
  }

  // Regular content
  return (
    <section
      key={index}
      className="
        snap-center snap-always
        flex items-center justify-center
        h-[calc(100dvh-7.5rem)]
        h-screen
        lg:h-[100dvh]
        w-full
      "
    >
      <VideoCard
        video={video}
        onRequestFullscreen={() => {
          setFullscreenStartId(video.id);
          setFullscreenOpen(true);
        }}
        toggleMute={toggleMute}
        isMuted={isMuted}
      />
    </section>
  );
})}


        {/* Sentinel at the bottom */}
        <div ref={sentinelRef} className="h-[1px]" />
      </main>

      {/* Fullscreen overlay feed */}
      <FullscreenVideoOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        videos={videos}
        initialVideoId={fullscreenStartId}
        toggleMute={toggleMute}
        isMuted={isMuted}
        onEndReached={loadMore}          // 👈 reuse same loader as main feed
        isLoadingMore={loading}          // 👈 so overlay doesn’t spam
      />
    </>
  );
}



// app/components/feed/VideoFeed.tsx
// "use client";

// import React, {
//   UIEvent,
//   useCallback,
//   useEffect,
//   useRef,
//   useState,
// } from "react";
// import VideoCard from "./VideoCard";
// import type { FeedTab, Video } from "./types";
// import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
// import { useInView } from "@/app/components/media/useInView";
// import { fetchTrendingVideosBatch } from "@/lib/actions/mediaFeed";

// type Props = {
//   activeTab: FeedTab;
//   onTabChange: (tab: FeedTab) => void;
//   onScrollDirectionChange?: (direction: "up" | "down") => void;
// };

// export default function VideoFeed({
//   activeTab,
//   onTabChange,
//   onScrollDirectionChange,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   const [videos, setVideos] = useState<Video[]>([]);
//   const [isMuted, setIsMuted] = useState(true);
//   const [loading, setLoading] = useState(false);
//   const [initialLoaded, setInitialLoaded] = useState(false);
//   const [hasMore, setHasMore] = useState(true);
//   const [feedError, setFeedError] = useState<string | null>(null);

//   // IDs we’ve already shown this session (media.id)
//   const seenIdsRef = useRef<Set<number>>(new Set());
//   const loadingRef = useRef(false);

//   // fullscreen overlay state
//   const [fullscreenOpen, setFullscreenOpen] = useState(false);
//   const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(
//     null
//   );

//   const toggleMute = () => setIsMuted((prev) => !prev);

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     const delta = current - lastScrollTop.current;

//     if (Math.abs(delta) > 4 && onScrollDirectionChange) {
//       onScrollDirectionChange(delta > 0 ? "down" : "up");
//     }

//     lastScrollTop.current = current;
//   };

//   // Sentinel at the bottom to trigger more loads
//   const { ref: sentinelRef, inView: sentinelInView } =
//     useInView<HTMLDivElement>({
//       threshold: 0.1,
//     });

//   const loadMore = useCallback(
//     async (opts?: { initial?: boolean }) => {
//       if (loadingRef.current || !hasMore) return;
//       loadingRef.current = true;
//       setLoading(true);
//       setFeedError(null);

//       try {
//         const excludeIds = Array.from(seenIdsRef.current);
//         const batch = await fetchTrendingVideosBatch({
//           limit: 3,
//           excludeIds,
//         });

//         if (batch.length === 0) {
//           setHasMore(false);
//           return;
//         }

//         setVideos((prev) => [...prev, ...batch]);

//         // remember these IDs so we don't re-pick them
//         batch.forEach((v) => {
//           const asNum = Number(v.id);
//           if (!Number.isNaN(asNum)) {
//             seenIdsRef.current.add(asNum);
//           }
//         });
//       } catch (err: any) {
//         console.error("loadMore feed error", err);
//         setFeedError(err?.message ?? "Failed to load videos.");
//       } finally {
//         setLoading(false);
//         setInitialLoaded(true);
//         loadingRef.current = false;
//       }
//     },
//     [hasMore]
//   );

//   // When tab changes → reset and load first batch
//   useEffect(() => {
//     setVideos([]);
//     setHasMore(true);
//     setInitialLoaded(false);
//     setFeedError(null);
//     seenIdsRef.current.clear();
//     loadMore({ initial: true });
//   }, [activeTab, loadMore]);

//   // Whenever sentinel becomes visible near the bottom, prefetch next batch
//   useEffect(() => {
//     if (!initialLoaded) return;
//     if (!sentinelInView) return;
//     if (!hasMore) return;
//     loadMore();
//   }, [sentinelInView, initialLoaded, hasMore, loadMore]);

//   const noVideos = !loading && initialLoaded && videos.length === 0;

//   return (
//     <>
//       <main
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="relative h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain
//                    lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
//       >
//         {/* You can still render tab UI here using activeTab / onTabChange */}

//         {feedError && (
//           <div className="sticky top-0 z-20 bg-red-900/90 text-red-100 text-xs px-4 py-2 text-center">
//             {feedError}
//           </div>
//         )}

//         {noVideos && (
//           <div className="flex h-full items-center justify-center text-white/70">
//             No videos yet. Try uploading something 👀
//           </div>
//         )}

//         {videos.map((video) => (
//           <section
//             key={video.id}
//             className="
//               snap-center snap-always
//               flex items-center justify-center
//               h-[calc(100dvh-7.5rem)]
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

//         {/* Sentinel at the bottom */}
//         <div ref={sentinelRef} className="h-[1px]" />

//         {/* Small loading indicator at the very bottom */}
//         {loading && (
//           <div className="py-6 text-center text-xs text-white/60">
//             Loading more videos…
//           </div>
//         )}
//       </main>

//       {/* Fullscreen overlay feed */}
//       <FullscreenVideoOverlay
//         open={fullscreenOpen}
//         onClose={() => setFullscreenOpen(false)}
//         videos={videos}
//         initialVideoId={fullscreenStartId}
//       />
//     </>
//   );
// }







// // app/components/feed/VideoFeed.tsx
// "use client";

// import React, {
//   UIEvent,
//   useCallback,
//   useEffect,
//   useRef,
//   useState,
// } from "react";
// import VideoCard from "./VideoCard";
// import type { FeedTab, Video } from "./types";
// import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
// import { useInView } from "@/app/components/media/useInView";
// import { fetchTrendingVideosBatch } from "@/lib/actions/mediaFeed";

// type Props = {
//   activeTab: FeedTab;
//   onTabChange: (tab: FeedTab) => void;
//   onScrollDirectionChange?: (direction: "up" | "down") => void;
// };

// export default function VideoFeed({
//   activeTab,
//   onTabChange,
//   onScrollDirectionChange,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   const [videos, setVideos] = useState<Video[]>([]);
//   const [isMuted, setIsMuted] = useState(true);
//   const [loading, setLoading] = useState(false);
//   const [initialLoaded, setInitialLoaded] = useState(false);
//   const [hasMore, setHasMore] = useState(true);

//   // Track which media IDs we’ve already shown this session
//   const seenIdsRef = useRef<Set<number>>(new Set());

//   // fullscreen overlay state
//   const [fullscreenOpen, setFullscreenOpen] = useState(false);
//   const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(
//     null
//   );

//   const toggleMute = () => setIsMuted((prev) => !prev);

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     const delta = current - lastScrollTop.current;

//     if (Math.abs(delta) > 4 && onScrollDirectionChange) {
//       onScrollDirectionChange(delta > 0 ? "down" : "up");
//     }

//     lastScrollTop.current = current;
//   };

//   // ==============================
//   // Data fetching (trending + lazy)
//   // ==============================

//   const loadMore = useCallback(async () => {
//     if (loading || !hasMore) return;

//     setLoading(true);
//     try {
//       // right now we only distinguish "trending",
//       // you can add other tab logic later
//       if (activeTab === "trending") {
//         const excludeIds = Array.from(seenIdsRef.current);

//         const batch = await fetchTrendingVideosBatch({
//           limit: 3,
//           excludeIds,
//         });

//         if (batch.length === 0) {
//           setHasMore(false);
//           return;
//         }

//         setVideos((prev) => [...prev, ...batch]);

//         // remember IDs we've used so we don't request them again
//         batch.forEach((v) => {
//           const asNum = Number(v.id);
//           if (!Number.isNaN(asNum)) {
//             seenIdsRef.current.add(asNum);
//           }
//         });
//       } else {
//         // For now, other tabs can just reuse trending logic
//         const excludeIds = Array.from(seenIdsRef.current);
//         const batch = await fetchTrendingVideosBatch({
//           limit: 3,
//           excludeIds,
//         });

//         if (batch.length === 0) {
//           setHasMore(false);
//           return;
//         }

//         setVideos((prev) => [...prev, ...batch]);
//         batch.forEach((v) => {
//           const asNum = Number(v.id);
//           if (!Number.isNaN(asNum)) {
//             seenIdsRef.current.add(asNum);
//           }
//         });
//       }
//     } catch (err) {
//       console.error("loadMore feed error", err);
//     } finally {
//       setLoading(false);
//       setInitialLoaded(true);
//     }
//   }, [activeTab, loading, hasMore]);

//   // when tab changes → reset and load first batch
//   useEffect(() => {
//     setVideos([]);
//     setHasMore(true);
//     setInitialLoaded(false);
//     seenIdsRef.current.clear();
//     loadMore();
//   }, [activeTab, loadMore]);

//   // When an item enters view, if it’s the second-last or last video,
//   // trigger the next batch so the user never hits a hard end.
//   const handleItemVisible = useCallback(
//     (index: number) => {
//       if (!initialLoaded) return;
//       if (index >= videos.length - 2) {
//         // user is on 2nd last / last → prefetch
//         loadMore();
//       }
//     },
//     [initialLoaded, videos.length, loadMore]
//   );

//   // ==========================
//   // Empty state / fallback UI
//   // ==========================

//   const noVideos = !loading && initialLoaded && videos.length === 0;

//   return (
//     <>
//       <main
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="relative h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain
//                    lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
//       >
//         {/* You can keep your tabs UI here if needed, using activeTab / onTabChange */}

//         {noVideos && (
//           <div className="flex h-full items-center justify-center text-white/70">
//             No videos yet. Try uploading something 👀
//           </div>
//         )}

//         {videos.map((video, index) => (
//           <FeedSection
//             key={video.id}
//             index={index}
//             onVisible={handleItemVisible}
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
//           </FeedSection>
//         ))}

//         {/* Small loading indicator at the bottom of the feed */}
//         {loading && (
//           <div className="py-6 text-center text-xs text-white/60">
//             Loading more videos…
//           </div>
//         )}
//       </main>

//       {/* Fullscreen overlay feed */}
//       <FullscreenVideoOverlay
//         open={fullscreenOpen}
//         onClose={() => setFullscreenOpen(false)}
//         videos={videos}
//         initialVideoId={fullscreenStartId}
//       />
//     </>
//   );
// }

// /**
//  * Wrap each video section with its own in-view observer.
//  * When the section becomes visible, we notify the parent with its index.
//  * Parent then decides whether it’s time to fetch the next batch.
//  */
// function FeedSection({
//   index,
//   onVisible,
//   children,
// }: {
//   index: number;
//   onVisible: (idx: number) => void;
//   children: React.ReactNode;
// }) {
//   const { ref, inView } = useInView<HTMLDivElement>({
//     threshold: 0.6,
//   });
//   const triggeredRef = useRef(false);

//   useEffect(() => {
//     if (inView && !triggeredRef.current) {
//       triggeredRef.current = true;      // mark as fired
//       onVisible(index);                 // tell parent "I'm visible"
//     }
//   }, [inView, index, onVisible]);

//   return (
//     <section
//       ref={ref}
//       className="
//         snap-center snap-always
//         flex items-center justify-center
//         h-[calc(100dvh-7.5rem)]
//         h-screen
//         lg:h-[100dvh]
//         w-full
//       "
//     >
//       {children}
//     </section>
//   );
// }







// "use client";

// import React, { UIEvent, useRef, useState } from "react";
// import VideoCard from "./VideoCard";
// import { MOCK_VIDEOS } from "./mockVideos";
// import type { FeedTab } from "./types";
// import FullscreenVideoOverlay from "./FullscreenVideoOverlay";

// type Props = {
//   activeTab: FeedTab;
//   onTabChange: (tab: FeedTab) => void;
//   onScrollDirectionChange?: (direction: "up" | "down") => void;
// };

// export default function VideoFeed({
//   activeTab,
//   onTabChange,
//   onScrollDirectionChange,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   const [fullscreenOpen, setFullscreenOpen] = useState(false);
//     const [isMuted, setIsMuted] = useState(true);
  
//   const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(
//     null
//   );

//     const toggleMute = () => setIsMuted((prev) => !prev);


//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     const delta = current - lastScrollTop.current;

//     if (Math.abs(delta) > 4 && onScrollDirectionChange) {
//       onScrollDirectionChange(delta > 0 ? "down" : "up");
//     }

//     lastScrollTop.current = current;
//   };

//   const videos = MOCK_VIDEOS; // later you can split by tab

//   return (
//     <>
//       <main
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="relative h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain
//                    lg:pt-70 lg:pb-70 lg:pl-[17rem] lg:pr-[21rem]"
//       >
//         {/* Desktop tabs above the video area (if you still want them here) */}
        

//         {videos.map((video) => (
//           <section
//             key={video.id}
//             className="
//               snap-center snap-always
//               flex items-center justify-center
//               h-[calc(100dvh-7.5rem)]
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
//       </main>

//       {/* Fullscreen overlay feed */}
//       <FullscreenVideoOverlay
//         open={fullscreenOpen}
//         onClose={() => setFullscreenOpen(false)}
//         videos={videos}
//         initialVideoId={fullscreenStartId}
//       />
//     </>
//   );
// }
