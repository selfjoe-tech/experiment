"use client";

import React, {
  UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import VideoCard, { SponsoredVideoCard } from "./VideoCard";
import type { FeedTab, Video } from "./types";
import {
  fetchTrendingVideosBatch,
  registerView,
  fetchForYouVideosBatch,
  fetchRandomAdForFeed,
  registerAdView,
} from "@/lib/actions/mediaFeed";
import { Loader2, LucideLoader } from "lucide-react";
import { ReelsPauseAd } from "@/app/components/ads/AdPlacements";

const BATCH_SIZE = 3;
const PREFETCH_AHEAD = 2;

type Props = {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  onScrollDirectionChange?: (direction: "up" | "down") => void;
  initialVideo?: Video | null;
  withAds?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function VideoFeed({
  activeTab,
  onTabChange,
  onScrollDirectionChange,
  initialVideo,
  withAds = false,
}: Props) {
  // ads
  const AD_EVERY = 3;
  const MAX_AD_TRIES = 4;
  const sinceLastAdRef = useRef(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  const [maximize, setMaximize] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);

  const [isMuted, setIsMuted] = useState(true);
  const [pausedReelVisible, setPausedReelVisible] = useState(false);
  const [pauseAdMounted, setPauseAdMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const handleReelPlayback = useCallback((playing: boolean, hasPlayed: boolean, previewEnded: boolean) => {
    const show = hasPlayed && !playing && !previewEnded;
    setPausedReelVisible(show);
    if (show) setPauseAdMounted(true);
  }, []);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // exclude + ad de-dupe
  const seenIdsRef = useRef<Set<number>>(new Set());
  const seenAdIdsRef = useRef<Set<string>>(new Set());
  const forYouBatchCountRef = useRef(0);

  // view tracking (so scrolling back doesn’t spam views)
  const viewedMediaIdsRef = useRef<Set<number>>(new Set());
  const viewedAdIdsRef = useRef<Set<string>>(new Set());

  // card height
  const [cardH, setCardH] = useState(0);

  // overlay
  const [overlayOpen, setOverlayOpen] = useState(false);

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

  const toggleMute = () => setIsMuted((p) => !p);

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

  // current snapped index
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const videosLenRef = useRef(0);
  useEffect(() => {
    videosLenRef.current = videos.length;
  }, [videos.length]);

  const rafTickingRef = useRef(false);
  const lastPrefetchLenRef = useRef<number>(0);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setFeedError(null);

    try {
      const excludeIds = Array.from(seenIdsRef.current);

      let batch: Video[] = [];

      if (activeTab === "forYou") {
        const count = forYouBatchCountRef.current;
        batch =
          count > 0 && count % 4 === 0
            ? await fetchTrendingVideosBatch({ limit: BATCH_SIZE, excludeIds })
            : await fetchForYouVideosBatch({ limit: BATCH_SIZE, excludeIds });

        forYouBatchCountRef.current = count + 1;
      } else {
        batch = await fetchTrendingVideosBatch({ limit: BATCH_SIZE, excludeIds });
      }

      if (!batch || batch.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }

      // inject ads (with de-dupe)
      const combined: Video[] = [];

      for (const v of batch) {
        combined.push(v);

        const isAd = !!(v as any)?._isAd;
        if (isAd) continue;

        sinceLastAdRef.current += 1;

        if (sinceLastAdRef.current >= AD_EVERY) {
          let pickedAd: Video | null = null;

          for (let tries = 0; tries < MAX_AD_TRIES; tries++) {
            const candidate = await fetchRandomAdForFeed();
            const anyC = candidate as any;
            if (!candidate || !anyC?._isAd) continue;

            const adId = anyC?._adId != null ? String(anyC._adId) : null;
            if (!adId) continue;
            if (seenAdIdsRef.current.has(adId)) continue;

            seenAdIdsRef.current.add(adId);
            pickedAd = candidate;
            break;
          }

          if (pickedAd) {
            combined.push(pickedAd);
            sinceLastAdRef.current = 0;
          } else {
            sinceLastAdRef.current = AD_EVERY - 1;
          }
        }
      }

      // update exclude set (so we don’t refetch session duplicates)
      for (const v of combined) {
        const anyV = v as any;
        if (anyV?._isAd) continue;
        if (typeof v.mediaId === "number") seenIdsRef.current.add(v.mediaId);
      }

      setVideos((prev) => [...prev, ...combined]);
    } catch (err: any) {
      console.error("loadMore feed error", err);
      setFeedError(err?.message ?? "Failed to load videos.");
    } finally {
      setLoading(false);
      setInitialLoaded(true);
      loadingRef.current = false;
    }
  }, [activeTab]);

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
      const idx = clamp(
        absoluteIndex,
        0,
        Math.max(0, videosLenRef.current - 1)
      );

      if (idx !== currentIndexRef.current) {
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
      }

      // Prefetch when close to end
      const len = videosLenRef.current;
      if (!loadingRef.current && hasMoreRef.current && len > 0) {
        const shouldPrefetch = absoluteIndex >= len - 1 - PREFETCH_AHEAD;

        // prevent spamming loadMore while snapping near the end
        if (shouldPrefetch && lastPrefetchLenRef.current !== len) {
          lastPrefetchLenRef.current = len;
          loadMore();
        }
      }
    });
  };

  // Register view when something becomes ACTIVE (not when fetched)
  useEffect(() => {
    const v = videos[currentIndex];
    if (!v) return;

    const anyV = v as any;

    if (anyV?._isAd) {
      const adId = anyV?._adId != null ? String(anyV._adId) : null;
      if (!adId) return;
      if (viewedAdIdsRef.current.has(adId)) return;

      viewedAdIdsRef.current.add(adId);
      registerAdView(adId);
      return;
    }

    const mediaId = v.mediaId;
    if (typeof mediaId !== "number") return;
    if (viewedMediaIdsRef.current.has(mediaId)) return;

    viewedMediaIdsRef.current.add(mediaId);
    registerView(mediaId);
  }, [currentIndex, videos]);

  const isWatchMode = !!initialVideo;

  // reset on tab change (home feed)
  useEffect(() => {
    if (isWatchMode) return;

    setVideos([]);
    setHasMore(true);
    hasMoreRef.current = true;
    setInitialLoaded(false);
    setFeedError(null);

    seenIdsRef.current.clear();
    seenAdIdsRef.current.clear();
    viewedMediaIdsRef.current.clear();
    viewedAdIdsRef.current.clear();

    forYouBatchCountRef.current = 0;
    sinceLastAdRef.current = 0;

    lastScrollTop.current = 0;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    lastPrefetchLenRef.current = 0;

    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    loadMore();
  }, [activeTab, isWatchMode, loadMore]);

  // seed watch mode
  useEffect(() => {
    if (!isWatchMode || !initialVideo) return;

    setVideos([initialVideo]);
    setHasMore(true);
    hasMoreRef.current = true;
    setInitialLoaded(false);
    setFeedError(null);

    seenIdsRef.current.clear();
    seenAdIdsRef.current.clear();
    viewedMediaIdsRef.current.clear();
    viewedAdIdsRef.current.clear();

    if (typeof initialVideo.mediaId === "number" && !Number.isNaN(initialVideo.mediaId)) {
      seenIdsRef.current.add(initialVideo.mediaId);
    }

    lastScrollTop.current = 0;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    lastPrefetchLenRef.current = 0;

    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    loadMore();
  }, [initialVideo, isWatchMode, loadMore]);

  const noVideos = !loading && initialLoaded && videos.length === 0;

  const mainClass = overlayOpen
    ? "relative z-[80] h-[100dvh] w-full overflow-y-scroll overscroll-y-contain snap-y snap-mandatory shadow-2xl backdrop-blur"
    : `relative h-screen snap-y snap-mandatory overflow-y-scroll overscroll-y-contain lg:pt-0 lg:pb-0 lg:pl-[76px] min-[1360px]:pl-[244px] lg:pr-0 ${withAds ? "lg:pr-[340px]" : ""}`;

  const sectionHeightClass = overlayOpen ? "h-full" : "h-screen w-full lg:h-[100dvh]";

  useEffect(() => { setPausedReelVisible(false); }, [currentIndex, activeTab, overlayOpen]);

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
              {"No videos available right now."}
            </div>
          )}

          {videos.map((video, index) => {
            const anyVideo = video as any;
            const isAd = !!anyVideo._isAd;
            const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;

            // ✅ Only one active => only one video mounts (your VideoCard uses this)
            const loadLevel: "active" | "near" | "off" =
              index === currentIndex ? "active" : "off";

            const key = isAd
              ? `ad-${anyVideo._adId ?? video.id}`
              : `media-${video.mediaId ?? video.id}`;

            const absIndex = index;

            return (
              <section
                key={key}
                className={`snap-center snap-always flex items-center justify-center w-full ${sectionHeightClass}`}
              >
                {isAd ? (
                  <SponsoredVideoCard
                    video={video}
                    isMuted={isMuted}
                    toggleMute={toggleMute}
                    visitUrl={visitUrl || "/ads"}
                    loadLevel={loadLevel}
                    maximize={maximize}
                    changeMaxButton={() => setMaximize((prev) => !prev)}
                  />
                ) : (
                  <VideoCard
                    video={video}
                    onPlaybackChange={handleReelPlayback}
                    onRequestFullscreen={() => openOverlayAtIndex(absIndex)}
                    toggleMute={toggleMute}
                    isMuted={isMuted}
                    loadLevel={loadLevel}
                    maximize={!maximize}
                    changeMaxButton={() => setMaximize((prev) => !prev)}
                  />
                )}
              </section>
            );
          })}
        </main>
      </div>
      {/* Mount the vendor slot only once, on first pause; subsequent pauses use CSS visibility. */}
      {pauseAdMounted && <div
        aria-hidden={!pausedReelVisible}
        className={`fixed left-1/2 top-[calc(50%+56px)] z-[100] -translate-x-1/2 transition-opacity duration-150 lg:left-[calc(50%-170px)] ${pausedReelVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <ReelsPauseAd/>
      </div>}
    </>
  );
}

