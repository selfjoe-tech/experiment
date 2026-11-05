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
import { useAutoHideHeader } from "@/app/hooks/useAutoHideHeader";

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

  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [overlayVideos, setOverlayVideos] = useState<Video[]>(initialVideos);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const toggleMute = () => setIsMuted((prev) => !prev);
  const hideHeader = useAutoHideHeader();
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

  const baseTitle = `Explore ${tabLabel} | goongram`;
  const description =
    tab === "gifs"
      ? "Explore trending and newest adult GIFs on goongram from verified creators and niches."
      : tab === "images"
      ? "Browse high quality adult images and loops from goongram creators, sorted by trending, newest and most viewed."
      : tab === "creators"
      ? "Discover goongram creators, follow your favourites and explore their GIFs and images."
      : "Dive into goongram niches, from specific kinks to themed collections, and explore GIFs & videos by category.";

  const canonical = `https://goongram.com/explore/${tab}`;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: baseTitle,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "goongram",
      url: "https://goongram.com",
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
        <meta property="og:site_name" content="goongram" />
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

      <main className="min-h-[100dvh] bg-[#090a0d] pt-[58px] text-white lg:ml-[76px] lg:mr-[340px] lg:pt-0 min-[1360px]:ml-[244px]">
        <div className="mx-auto w-full max-w-[1160px]">
          <header className="px-3 pb-4 pt-7 sm:px-6 sm:pt-10">
            <div className="flex items-center justify-between">
              <h1 className="text-[25px] font-bold tracking-[-0.04em] sm:text-[32px]">Explore</h1>
              <a href="/upload" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10">Create</a>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/45">Discover new videos, creators and communities.</p>
          </header>

          <div className={`sticky top-[58px] z-30 border-b border-white/10 bg-[#090a0d]/95 px-3 backdrop-blur-xl transition-all duration-200 sm:px-6 lg:top-0 ${hideHeader ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <ExploreTabs active={tab}/>
              <SortDropdown value={sortBy} onChange={setSortBy}/>
            </div>
          </div>

          <div className="px-[2px] pt-2 sm:px-6 sm:pt-4">
            <ExploreGrid tab={tab} sortBy={sortBy} onVideoClick={handleVideoClick}/>
          </div>
        </div>

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
      </main>
    </>
  );
}
