// app/explore/[tab]/page.tsx
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import ExploreTabs from "@/app/components/explore/ExploreTabs";
import ExploreGrid from "@/app/components/explore/ExploreGrid";
import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
import { Video } from "@/app/components/feed/types";

type Props = {
  initialVideos?: Video[]; // optional
};

export default function ExploreTabPage({ initialVideos = [] }: Props) {
  const params = useParams<{ tab: string }>();
  const tab = (params?.tab || "gifs") as
    | "gifs"
    | "images"
    | "creators"
    | "niches";

  const [sortBy, setSortBy] = useState<SortKey>("trending");

  // Only used for the fullscreen overlay
  const [overlayVideos, setOverlayVideos] = useState<Video[]>(initialVideos);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  // Called with: clicked video, its index, and the grid's current list
  const handleVideoClick = (
  video: Video,
  _index: number,
  currentVideos: Video[]
) => {
  setOverlayVideos(currentVideos);  // 👈 pass the grid’s list
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

  return (
    <div className="pt-14 lg:pt-20 lg:ml-64 lg:mr-80">
      <div className="px-3 sm:px-4">
        {/* Top row: tabs + sort */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <ExploreTabs active={tab} />
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>

        {/* Grid does its own fetch + append but tells us what it has when you click */}
        <ExploreGrid tab={tab} sortBy={sortBy} onVideoClick={handleVideoClick} />

        {/* Fullscreen overlay uses the list we captured on click */}
        <FullscreenVideoOverlay
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          videos={overlayVideos}
          initialVideoId={activeVideoId}
          onEndReached={fetchMore}
          isLoadingMore={isLoadingMore}
        />
      </div>
    </div>
  );
}









// // app/explore/[tab]/page.tsx
// "use client";

// import React, { useState } from "react";
// import { useParams } from "next/navigation";
// import ExploreTabs from "@/app/components/explore/ExploreTabs";
// import ExploreGrid from "@/app/components/explore/ExploreGrid";
// import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
// import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
// import { Video } from "@/app/components/feed/types";

// type Props = {
//   initialVideos: Video[];
// };

// export default function ExploreTabPage({ initialVideos }: Props) {
//   const params = useParams<{ tab: string }>();
//   const tab = (params?.tab || "gifs") as "gifs" | "images" | "creators" | "niches";
//   const [sortBy, setSortBy] = useState<SortKey>("trending");
//   const [videos, setVideos] = useState<Video[]>(initialVideos);
//   const [overlayOpen, setOverlayOpen] = useState(false);
//   const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
//   const [isLoadingMore, setIsLoadingMore] = useState(false);
//   const [page, setPage] = useState(1);
  

//   const handleVideoClick = async (video: Video) => {
//     setVideos(video);  
//     setActiveVideoId(video.id);
//     setOverlayOpen(true);
//   };

//   const fetchMore = async () => {
//     if (isLoadingMore) return;
//     setIsLoadingMore(true);

//     try {
//       const res = await fetch(`/api/explore?page=${page + 1}`);
//       const data = (await res.json()) as { videos: Video[] };

//       setVideos((prev) => [...prev, ...data.videos]);
//       setPage((p) => p + 1);
//     } catch (err) {
//       console.error("Failed to load more videos", err);
//     } finally {
//       setIsLoadingMore(false);
//     }
//   };


//   return (
//     <div className="pt-14 lg:pt-20 lg:ml-64 lg:mr-80">
//     <div className="px-3 sm:px-4">
//       {/* Top row: tabs + sort */}
//       <div className="flex items-center justify-between gap-3 mb-4">
//         <ExploreTabs active={tab} />
//         <SortDropdown value={sortBy} onChange={setSortBy} />
//       </div>

//       {/* Infinite Explore grid (does its own fetch + append) */}
//       <ExploreGrid tab={tab} sortBy={sortBy} onVideoClick={handleVideoClick}/>
//       <FullscreenVideoOverlay
//         open={overlayOpen}
//         onClose={() => setOverlayOpen(false)}
//         videos={videos}
//         initialVideoId={activeVideoId}
//         onEndReached={fetchMore}
//         isLoadingMore={isLoadingMore}
//       />
//     </div>
//     </div>
//   );
// }




// "use client";

// import React, { useMemo, useState } from "react";
// import { useParams } from "next/navigation";
// import ExploreTabs from "@/app/components/explore/ExploreTabs";
// import ExploreGrid from "@/app/components/explore/ExploreGrid";
// import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
// import { getItemsForTab } from "@/app/components/explore/data";

// export default function ExploreTabPage() {
//   const params = useParams<{ tab: string }>();
//   const tab = (params?.tab || "gifs") as "gifs" | "images" | "creators" | "niches";
//   const [sortBy, setSortBy] = useState<SortKey>("trending");

//   const items = useMemo(() => {
//     const base = getItemsForTab(tab);
//     // const copy = [...base];
//     switch (sortBy) {
//       case "newest":
//         copy.sort((a, b) => (b.date || 0) - (a.date || 0));
//         break;
//       case "views":
//         copy.sort((a, b) => (b.views || 0) - (a.views || 0));
//         break;
//       default:
//         // "trending" – pretend score
//         copy.sort((a, b) => (b.score || 0) - (a.score || 0));
//     }
//     return copy;
//   }, [tab, sortBy]);

//   return (
//     <div className="px-3 sm:px-4">
//       {/* Top row: tabs + sort */}
//       <div className="flex items-center justify-between gap-3 mb-4">
//         <ExploreTabs active={tab} />
//         <SortDropdown value={sortBy} onChange={setSortBy} />
//       </div>

//       {/* Grid: 3 cols on mobile, max 4 on desktop */}
//       <ExploreGrid tab={tab} items={items} />
//     </div>
//   );
// }
