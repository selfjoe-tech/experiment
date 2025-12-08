// app/components/feed/TagVideoFeed.tsx
"use client";

import React, {
  UIEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import VideoCard from "./VideoCard";
import FullscreenVideoOverlay from "./FullscreenVideoOverlay";
import type { Video } from "./types";
import { useInView } from "@/app/components/media/useInView";
import {
  fetchVideosByTagBatch,
  registerView,
} from "@/lib/actions/mediaFeed";

type Props = {
  tagSlug: string; // e.g. "gaming-fever"
  onScrollDirectionChange?: (direction: "up" | "down") => void;
};

export default function TagVideoFeed({
  tagSlug,
  onScrollDirectionChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  const [videos, setVideos] = useState<Video[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const loadingRef = useRef(false);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenStartId, setFullscreenStartId] = useState<string | null>(
    null
  );

  const toggleMute = () => setIsMuted((prev) => !prev);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const current = e.currentTarget.scrollTop;
    const delta = current - lastScrollTop.current;

    if (Math.abs(delta) > 4 && onScrollDirectionChange) {
      onScrollDirectionChange(delta > 0 ? "down" : "up");
    }

    lastScrollTop.current = current;
  };

  const { ref: sentinelRef, inView: sentinelInView } =
    useInView<HTMLDivElement>({
      threshold: 0.1,
    });

  const loadMore = useCallback(
    async (opts?: { initial?: boolean }) => {
      if (loadingRef.current || !hasMore) return;
      if (!tagSlug) return;

      loadingRef.current = true;
      setLoading(true);
      setFeedError(null);

      try {
        const excludeIds = Array.from(seenIdsRef.current);

        const batch = await fetchVideosByTagBatch({
          slug: tagSlug,
          limit: 3,
          excludeIds,
        });

        if (!batch || batch.length === 0) {
          setHasMore(false);
          return;
        }

        // bump view count in UI
        const bumpedBatch = batch.map((v) => ({
          ...v,
          views: v.views + 1,
        }));

        setVideos((prev) => [...prev, ...bumpedBatch]);

        bumpedBatch.forEach((v) => {
          seenIdsRef.current.add(v.mediaId);
        });

        // fire-and-forget view registration
        bumpedBatch.forEach((v) => {
          registerView(v.mediaId);
        });
      } catch (err: any) {
        console.error("Tag feed loadMore error", err);
        setFeedError(err?.message ?? "Failed to load videos.");
      } finally {
        setLoading(false);
        setInitialLoaded(true);
        loadingRef.current = false;
      }
    },
    [tagSlug, hasMore]
  );

  // reset when tag changes
  useEffect(() => {
    setVideos([]);
    setHasMore(true);
    setInitialLoaded(false);
    setFeedError(null);
    seenIdsRef.current.clear();

    if (tagSlug) {
      loadMore({ initial: true });
    }
  }, [tagSlug, loadMore]);

  // infinite scroll
  useEffect(() => {
    if (!initialLoaded) return;
    if (!sentinelInView) return;
    if (!hasMore) return;
    loadMore();
  }, [sentinelInView, initialLoaded, hasMore, loadMore]);

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
            No videos for this niche yet.
          </div>
        )}

        {loading && !initialLoaded && (
          <div className="flex h-full items-center justify-center text-white/70">
            Loading…
          </div>
        )}

        {videos.map((video) => (
          <section
            key={video.id}
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
        ))}

        

        <div ref={sentinelRef} className="h-[1px]" />
      </main>

      <FullscreenVideoOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        videos={videos}
        initialVideoId={fullscreenStartId}
      />
    </>
  );
}
