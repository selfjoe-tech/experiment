"use client";

import React, { useEffect, useRef, useState } from "react";
import Head from "next/head"; // 👈 NEW
import { useParams } from "next/navigation";
import ExploreTabs from "@/app/components/explore/ExploreTabs";
import ExploreGrid from "@/app/components/explore/ExploreGrid";
import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
import { Video } from "@/app/components/feed/types";
import { getItemsForTab } from "@/app/components/explore/data";

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
  const OVERLAY_LIMIT = 12;
const overlayPageRef = useRef(0);
const overlaySeenRef = useRef(new Set<string>());
const overlaySessionRef = useRef(0);
const isLoadingMoreRef = useRef(false);

useEffect(() => {
  overlaySessionRef.current += 1;
  overlayPageRef.current = 0;
  overlaySeenRef.current.clear();
  setOverlayOpen(false);
  setActiveVideoId(null);
  setOverlayVideos([]);
}, [tab, sortBy]);

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

  function exploreItemToVideo(i: any): Video {
  return {
    id: String(i.id),
    mediaId: Number(i.id),
    src: i.src,
    type: "video",
    views: i.views ?? 0,
    likes: i.likes ?? 0,
    description: i.description ?? "",
    hashtags: i.hashtags ?? [],
    ownerId: i.ownerId,
    username: i.username ?? "unknown",
    avatar: i.avatar ?? "/avatar-placeholder.png",
    likedByMe: i.likedByMe ?? false,
    verified: i.verified
  };
}
const [initialOverlayIndex, setInitialOverlayIndex] = useState<number | null>(null);


  // ===== existing logic (unchanged) =====
  const handleVideoClick = (video: any, _index?: number, currentItems?: any[]) => {
  const items = currentItems ?? [video];

  const batch: Video[] = items
    .filter((x) => x.type === "gif" || x.type === "video")
    .map(exploreItemToVideo);

  overlaySessionRef.current += 1;

  overlaySeenRef.current.clear();
  for (const v of batch) overlaySeenRef.current.add(String(v.id));

  overlayPageRef.current = Math.ceil(batch.length / OVERLAY_LIMIT);
  setInitialOverlayIndex(typeof _index === "number" ? _index : null); 


  isLoadingMoreRef.current = false;
  setIsLoadingMore(false);

  setOverlayVideos(batch);
  setActiveVideoId(String(video.id));
  setOverlayOpen(true);
};


  const fetchMore = async () => {
  if (tab !== "gifs") return;
  if (isLoadingMoreRef.current) return;

  const session = overlaySessionRef.current;
  isLoadingMoreRef.current = true;
  setIsLoadingMore(true);

  try {
    const MAX_DUP_PAGES = 6;

    for (let tries = 0; tries < MAX_DUP_PAGES; tries++) {
      const pageToFetch = overlayPageRef.current;

      const batch = await getItemsForTab({
        tab,
        sortBy,
        limit: OVERLAY_LIMIT,
        page: pageToFetch,
      });

      if (overlaySessionRef.current !== session) return;

      const media = batch.filter((x: any) => x.type === "gif" || x.type === "video") as any[];
      if (media.length === 0) return; // no more

      const toAdd: Video[] = [];
      for (const m of media) {
        const v = exploreItemToVideo(m);
        const key = String(v.id);
        if (!overlaySeenRef.current.has(key)) {
          overlaySeenRef.current.add(key);
          toAdd.push(v);
        }
      }

      // we consumed this page either way
      overlayPageRef.current += 1;

      // if we found new items, append and stop
      if (toAdd.length > 0) {
        setOverlayVideos((prev) => [...prev, ...toAdd]);
        return;
      }

      // otherwise: duplicates only, loop and try next page
    }
  } catch (err) {
    console.error("Profile overlay fetchMore error", err);
  } finally {
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
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
            isLoadingMore={isLoadingMore}
            toggleMute={toggleMute}
            isMuted={isMuted}
            onEndReached={fetchMore}  
            initialIndex={initialOverlayIndex}
          />

          
        </div>
      </div>
    </>
  );
}
