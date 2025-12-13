"use client";

import React, { useEffect, useRef, useState } from "react";
import Head from "next/head"; // 👈 NEW
import { useParams } from "next/navigation";
import ExploreTabs from "@/app/components/explore/ExploreTabs";
import ExploreGrid from "@/app/components/explore/ExploreGrid";
import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
import { Video } from "@/app/components/feed/types";

type Props = {
  initialVideos?: Video[];
};

export default function ExploreTabPage({ initialVideos = [] }: Props) {
  const params = useParams<{ tab: string }>();
  const rawTab = (params?.tab || "gifs") as
    | "gifs"
    | "images"
    | "creators"
    | "niches";

  // normalize tab to a known key
  const tab: "gifs" | "images" | "creators" | "niches" =
    ["gifs", "images", "creators", "niches"].includes(rawTab)
      ? rawTab
      : "gifs";

  const [sortBy, setSortBy] = useState<SortKey>("trending");
  const [overlayVideos, setOverlayVideos] = useState<Video[]>(initialVideos);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const toggleMute = () => setIsMuted((prev) => !prev);
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollY = useRef(0);

  // ====== SEO STRINGS ======
  const tabLabelMap: Record<typeof tab, string> = {
    gifs: "GIFs",
    images: "Images",
    creators: "Creators",
    niches: "Niches",
  };

  const tabLabel = tabLabelMap[tab];

  const baseTitle = `Explore ${tabLabel} | UpskirtCandy`;
  const description =
    tab === "gifs"
      ? "Explore trending and newest adult GIFs on UpskirtCandy from verified creators and niches."
      : tab === "images"
      ? "Browse high quality adult images and loops from UpskirtCandy creators, sorted by trending, newest and most viewed."
      : tab === "creators"
      ? "Discover UpskirtCandy creators, follow your favourites and explore their GIFs and images."
      : "Dive into UpskirtCandy niches, from specific kinks to themed collections, and explore GIFs & videos by category.";

  const canonical = `https://upskirtcandy.com/explore/${tab}`;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: baseTitle,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "UpskirtCandy",
      url: "https://upskirtcandy.com",
    },
  };

  // ===== existing logic (unchanged) =====
  const handleVideoClick = (
    video: Video,
    _index: number,
    currentVideos: Video[]
  ) => {
    setOverlayVideos(currentVideos);
    setActiveVideoId(video.id);
    setOverlayOpen(true);
  };

  const fetchMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const res = await fetch(`/api/explore?page=${page + 1}`);
      const data = (await res.json()) as { videos: Video[] };

      setOverlayVideos((prev) => [...prev, ...data.videos]);
      setPage((p) => p + 1);
    } catch (err) {
      console.error("Failed to load more videos", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY || 0;
      const delta = current - lastScrollY.current;

      const threshold = 4;
      if (Math.abs(delta) < threshold) return;

      if (current <= 0) {
        setHideHeader(false);
        lastScrollY.current = current;
        return;
      }

      if (delta > 0) {
        setHideHeader(true);
      } else {
        setHideHeader(false);
      }

      lastScrollY.current = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ====== RENDER ======
  return (
    <>
      <Head>
        <title>{baseTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index,follow" />

        {/* Open Graph */}
        <meta property="og:title" content={baseTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="UpskirtCandy" />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={baseTitle} />
        <meta name="twitter:description" content={description} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(collectionSchema),
          }}
        />
      </Head>

      <div className="pt-14 lg:pt-20 lg:ml-64 lg:mr-80">
        <div className="px-3 sm:px-4">
          {/* Top row: tabs + sort */}
          <div
            className={`
              sticky top-0 z-30 mb-4
              bg-black/95 backdrop-blur
              flex items-center justify-between gap-3
              border-b border-white/10
              transition-transform duration-200
              ${hideHeader ? "-translate-y-full" : "translate-y-0"}
            `}
          >
            <div className="flex w-full justify-center">
              <ExploreTabs active={tab} />
            </div>

            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          <ExploreGrid
            tab={tab}
            sortBy={sortBy}
            onVideoClick={handleVideoClick}
          />

          <FullscreenVideoOverlay
            open={overlayOpen}
            onClose={() => setOverlayOpen(false)}
            videos={overlayVideos}
            initialVideoId={activeVideoId}
            onEndReached={fetchMore}
            isLoadingMore={isLoadingMore}
            toggleMute={toggleMute}
            isMuted={isMuted}
          />
        </div>
      </div>
    </>
  );
}
