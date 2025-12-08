// app/components/profile/UserGrid.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useState,
  forwardRef,
} from "react";
import Link from "next/link";
import { LoaderIcon } from "lucide-react";

import LazyImage from "@/app/components/media/LazyImage";
import LazyVideo from "@/app/components/media/LazyVideo";
import { useInView } from "@/app/components/media/useInView";
import type { SortKey } from "@/app/components/explore/SortDropdown";
import { getUserMedia } from "@/app/components/explore/data";
import {
  FullscreenImageOverlay,
  type ImageExploreItem,
} from "@/app/components/feed/FullscreenImageOverlay";
import type { Video } from "@/app/components/feed/types";

type UserTabKey = "gifs" | "images";

// Match the shape we get back from getUserMedia
type UserExploreItem =
  | {
      id: string;
      type: "image";
      src: string;
      alt?: string;
      views?: number;
      score?: number;
      date?: number;
    }
  | {
      id: string;
      type: "gif" | "video";
      src: string;
      views?: number;
      score?: number;
      date?: number;
    };

type Props = {
  username: string;
  tab: UserTabKey;
  sortBy: SortKey;
  // optional: re-use the same signature pattern as ExploreGrid
  onVideoClick?: (
    video: Video | any,
    index: number,
    currentItems: UserExploreItem[]
  ) => void;
};

export default function UserGrid({
  username,
  tab,
  sortBy,
  onVideoClick,
}: Props) {
  const [items, setItems] = useState<UserExploreItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageOverlayOpen, setImageOverlayOpen] = useState(false);
  const [overlayIndex, setOverlayIndex] = useState(0);

  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>({
    threshold: 0.1,
  });

  const imageItems: ImageExploreItem[] = items.filter(
    (i): i is ImageExploreItem => i.type === "image"
  );

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const batch = await getUserMedia({
        username,
        tab,
        sortBy,
        limit: 9,
        page,
      });

      if (!batch || batch.length === 0) {
        setHasMore(false);
        return;
      }

      setItems((prev) => [...prev, ...batch]);
      setPage((prev) => prev + 1);
    } catch (err: any) {
      console.error("UserGrid loadMore error", err);
      setError(err?.message ?? "Failed to load items.");
    } finally {
      setLoading(false);
    }
  }, [username, tab, sortBy, page, loading, hasMore]);

  // Reset when username / tab / sort change
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, [username, tab, sortBy]);

  // Initial load
  useEffect(() => {
    if (!loading && items.length === 0 && hasMore) {
      loadMore();
    }
  }, [items.length, loading, hasMore, loadMore]);

  // Infinite scroll
  useEffect(() => {
    if (inView && !loading && hasMore) {
      loadMore();
    }
  }, [inView, loading, hasMore, loadMore]);

  const isEmpty = !loading && items.length === 0;
  const gridCls = "grid grid-cols-3 lg:grid-cols-4 gap-1";

  if (isEmpty) {
    return (
      <div className="py-12 text-center text-sm text-white/60">
        No uploads yet.
      </div>
    );
  }

  return (
    <>
      <div className={gridCls}>
        {items.map((m, index) => {
          if (m.type === "image") {
            const handleClick = () => {
              const idx = imageItems.findIndex((img) => img.id === m.id);
              if (idx !== -1) {
                setOverlayIndex(idx);
                setImageOverlayOpen(true);
              }
            };

            return (
              <button
                key={m.id}
                type="button"
                onClick={handleClick}
                className="w-full aspect-square relative"
              >
                <LazyImage
                  src={m.src}
                  alt={m.alt}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          }

          if (m.type === "gif" || m.type === "video") {
            return (
              <button
                key={m.id}
                type="button"
                className="w-full aspect-square"
                onClick={() => onVideoClick?.(m as any, index, items)}
              >
                <LazyVideo
                  src={m.src}
                  className="w-full h-full object-cover"
                  hoverPlay
                />
              </button>
            );
          }

          return null;
        })}
      </div>

      <BottomSentinel
        ref={sentinelRef}
        loading={loading}
        hasMore={hasMore}
      />
      {error && (
        <div className="mt-2 text-center text-xs text-red-400">{error}</div>
      )}

      {/* Fullscreen image overlay */}
      <FullscreenImageOverlay
        open={imageOverlayOpen}
        onClose={() => setImageOverlayOpen(false)}
        items={imageItems}
        initialIndex={overlayIndex}
      />
    </>
  );
}

type BottomSentinelProps = {
  loading: boolean;
  hasMore: boolean;
};

const BottomSentinel = forwardRef<HTMLDivElement, BottomSentinelProps>(
  function BottomSentinelInner({ loading, hasMore }, ref) {
    return (
      <div ref={ref} className="flex flex-col items-center py-4">
        {loading && <LoaderIcon />}
        {!loading && !hasMore && (
          <div className="text-[15px] text-white/40">
            The End! Contribute to the community by{" "}
            <span className="pink-500 underline">
              <Link href={"/upload"}>uploading</Link>
            </span>{" "}
            stuff :P
          </div>
        )}
      </div>
    );
  }
);
