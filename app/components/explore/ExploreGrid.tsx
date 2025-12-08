// app/components/explore/ExploreGrid.tsx
"use client";

import React, { useCallback, useEffect, useState, forwardRef } from "react";
import LazyImage from "@/app/components/media/LazyImage";
import LazyVideo from "@/app/components/media/LazyVideo";
import { useInView } from "@/app/components/media/useInView";
import type { SortKey } from "@/app/components/explore/SortDropdown";
import { getItemsForTab } from "@/app/components/explore/data";
import { LoaderIcon } from "lucide-react";
import Link from "next/link";
import { FullscreenImageOverlay, ImageExploreItem } from "../feed/FullscreenImageOverlay";
import type { Video } from "@/app/components/feed/types";



// 🔧 UPDATED: add slug + simplify niche variant
export type ExploreItem =
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
      poster?: string;
      views?: number;
      score?: number;
      date?: number;
    }
  | {
      id: string;
      type: "creator";
      name: string;
      avatar: string;
      followers?: number;
      score?: number;
      date?: number;
    }
  | {
      id: string;
      type: "niche";
      slug: string;     
      name: string;     
      src: string;      
      count?: number;
      score?: number;
      date?: number;
    };

type TabKey = "gifs" | "images" | "creators" | "niches";

type Props = {
  tab: TabKey;
  sortBy: SortKey;
  onVideoClick?: (video: Video, index: string) => void;
};

export default function ExploreGrid({ onVideoClick, tab, sortBy }: Props) {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageOverlayOpen, setImageOverlayOpen] = useState(false);
  const [overlayIndex, setOverlayIndex] = useState(0);

  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>({
    threshold: 0.1,
  });
    const media: Video[] = [];


    const imageItems: ImageExploreItem[] = items.filter(
    (i): i is ImageExploreItem => i.type === "image"
  );

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const batch = await getItemsForTab({ tab, sortBy, limit: 9, page });

      if (!batch || batch.length === 0) {
        setHasMore(false);
        return;
      }

      setItems((prev) => [...prev, ...batch]);
      setPage((prev) => prev + 1);
    } catch (err: any) {
      console.error("Explore loadMore error", err);
      setError(err?.message ?? "Failed to load items.");
    } finally {
      setLoading(false);
    }
  }, [tab, sortBy, page, loading, hasMore]);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, [tab, sortBy]);

  useEffect(() => {
    if (!loading && items.length === 0 && hasMore) {
      loadMore();
    }
  }, [items.length, loading, hasMore, loadMore]);

  useEffect(() => {
    if (inView && !loading && hasMore) {
      loadMore();
    }
  }, [inView, loading, hasMore, loadMore]);

  const isEmpty = !loading && items.length === 0;
  const gridCls = "grid grid-cols-3 lg:grid-cols-4 gap-2";

  if (isEmpty) {
    return (
      <div className="py-12 text-center text-sm text-white/60">
        No items yet.
      </div>
    );
  }

  // --- creators tab stays same ---
  if (tab === "creators") {
    return (
      <>
        <div className={gridCls}>
          {items.map((c) => {
            if (c.type !== "creator") return null;
            return (
              <div
                key={c.id}
                className="relative overflow-hidden border-white/10 bg-white/5"
              >
                <LazyImage
                  src={c.avatar}
                  alt={c.name}
                  className="aspect-square"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  {c.followers ? (
                    <div className="text-[11px] text-white/70">
                      {c.followers.toLocaleString()} followers
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />
        {error && (
          <div className="mt-2 text-center text-xs text-red-400">{error}</div>
        )}
      </>
    );
  }

  // --- NICHES: wrap each tile in a Link ---
  if (tab === "niches") {
    return (
      <>
        <div className={gridCls}>
          {items.map((n, index) => {
            if (n.type !== "niche") return null;

            return (
              <Link
                key={index}
                href={`/explore/niches/${encodeURIComponent(n.slug)}`}
                className="relative overflow-hidden block"
              >
                <LazyVideo
                  src={n.src}
                  className="w-full aspect-square"
                  hoverPlay
                />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
                  <div className="text-white/70 text-sm font-semibold truncate">
                    {n.name}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />
        {error && (
          <div className="mt-2 text-center text-xs text-red-400">{error}</div>
        )}
      </>
    );
  }

  // --- GIFs / Images / videos ---
  return (
    <>
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
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
                key={index}
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
              key={index}
              type="button"
              className="w-full aspect-square"
              onClick={() => onVideoClick?.(m, index, items)}
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

      <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />
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




// // app/components/explore/ExploreGrid.tsx
// "use client";

// import React, { useCallback, useEffect, useState, forwardRef } from "react";
// import LazyImage from "@/app/components/media/LazyImage";
// import LazyVideo from "@/app/components/media/LazyVideo";
// import { useInView } from "@/app/components/media/useInView";
// import type { SortKey } from "@/app/components/explore/SortDropdown";
// import { getItemsForTab } from "@/app/components/explore/data";
// import { LoaderIcon } from "lucide-react";
// import Link from "next/link";


// // Match your previous union type
// export type ExploreItem =
//   | {
//       id: string;
//       type: "image";
//       src: string;
//       alt?: string;
//       views?: number;
//       score?: number;
//       date?: number;
//     }
//   | {
//       id: string;
//       type: "gif" | "video";
//       src: string;
//       poster?: string;
//       views?: number;
//       score?: number;
//       date?: number;
//     }
//   | {
//       id: string;
//       type: "creator";
//       name: string;
//       avatar: string;
//       followers?: number;
//       score?: number;
//       date?: number;
//     }
//   | {
//       id: string;
//       type: "niche";
//       src: string;
//       name: string;
//       cover: string;
//       count?: number;
//       score?: number;
//       date?: number;
//     };

// type TabKey = "gifs" | "images" | "creators" | "niches";

// type Props = {
//   tab: TabKey;
//   sortBy: SortKey;
// };

// export default function ExploreGrid({ tab, sortBy }: Props) {
//   const [items, setItems] = useState<ExploreItem[]>([]);
//   const [page, setPage] = useState(0); // 0-based page index
//   const [loading, setLoading] = useState(false);
//   const [hasMore, setHasMore] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const { ref: sentinelRef, inView } = useInView<HTMLDivElement>({
//     threshold: 0.1,
//   });

//   // ---- FETCH NEXT 9 ITEMS ---------------------------------------------------

//   const loadMore = useCallback(async () => {
//     if (loading || !hasMore) return;

//     setLoading(true);
//     setError(null);

//     try {
//       // You can adapt getItemsForTab signature as needed:
//       // e.g. ({ tab, sortBy, limit, offset }) or ({ tab, sortBy, page, limit })
//       const batch = await getItemsForTab({ tab, sortBy, limit: 9, page })


//       if (!batch || batch.length === 0) {
//         setHasMore(false);
//         return;
//       }

//       // 👇 IMPORTANT: append, do NOT clear existing items
//       setItems((prev) => [...prev, ...batch]);
//       setPage((prev) => prev + 1);
//     } catch (err: any) {
//       console.error("Explore loadMore error", err);
//       setError(err?.message ?? "Failed to load items.");
//     } finally {
//       setLoading(false);
//     }
//   }, [tab, sortBy, page, loading, hasMore]);

//   // ---- RESET WHEN TAB / SORT CHANGE ----------------------------------------

//   useEffect(() => {
//     // When user switches tab or sort, reset state,
//     // but this only runs on those changes – not on each loadMore
//     setItems([]);
//     setPage(0);
//     setHasMore(true);
//     setError(null);
//   }, [tab, sortBy]);

//   // ---- INITIAL LOAD (first page) -------------------------------------------

//   useEffect(() => {
//     if (!loading && items.length === 0 && hasMore) {
//       loadMore();
//     }
//   }, [items.length, loading, hasMore, loadMore]);

//   // ---- INFINITE SCROLL (sentinel at bottom) --------------------------------

//   useEffect(() => {
//     if (inView && !loading && hasMore) {
//       loadMore();
//     }
//   }, [inView, loading, hasMore, loadMore]);

//   // ---- RENDER ---------------------------------------------------------------

//   const isEmpty = !loading && items.length === 0;

//   const gridCls = "grid grid-cols-3 lg:grid-cols-4 gap-2";

//   if (isEmpty) {
//     return (
//       <div className="py-12 text-center text-sm text-white/60">
//         No items yet.
//       </div>
//     );
//   }

//   if (tab === "creators") {
//     return (
//       <>
//         <div className={gridCls}>
//           {items.map((c) => {
//             if (c.type !== "creator") return null;
//             return (
//               <div
//                 key={c.id}
//                 className="relative overflow-hidden border-white/10 bg-white/5"
//               >
//                 <LazyImage src={c.avatar} alt={c.name} className="aspect-square" />
//                 <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
//                   <div className="text-sm font-semibold truncate">{c.name}</div>
//                   {c.followers ? (
//                     <div className="text-[11px] text-white/70">
//                       {c.followers.toLocaleString()} followers
//                     </div>
//                   ) : null}
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />

//         {error && (
//           <div className="mt-2 text-center text-xs text-red-400">{error}</div>
//         )}
//       </>
//     );
//   }

//   if (tab === "niches") {
//     return (
//       <>
//         <div className={gridCls}>
//           {items.map((n) => {
            
//             return (
//               <div key={n.id} className="relative overflow-hidden object-cover">
//                 <LazyVideo
//                 key={n.id}
//                 src={n.src}
//                 className="w-full aspect-square"
//                 hoverPlay
//               />
//                 <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
//                   <div className="text-white/70 text-sm font-semibold truncate">
//                     {n.name}
//                   </div>
                 
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />

//         {error && (
//           <div className="mt-2 text-center text-xs text-red-400">{error}</div>
//         )}
//       </>
//     );
//   }

//   // GIFs / Images / videos
//   return (
//     <>
//       <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
//         {items.map((m, index) => {
//           if (m.type === "image") {
//             return (
//               <LazyImage
//                 key={index}
//                 src={m.src}
//                 alt={m.alt}
//                 className="w-full aspect-square"
//               />
//             );
//           }
//           if (m.type === "gif" || m.type === "video") {
//             return (
//               <LazyVideo
//                 key={index}
//                 src={m.src}
//                 className="w-full aspect-square"
//                 hoverPlay
//               />
//             );
//           }
//           // ignore creators/niches in GIFs/images tab
//           return null;
//         })}
//       </div>

//       {/* Sentinel + status row */}
//       <BottomSentinel ref={sentinelRef} loading={loading} hasMore={hasMore} />

//       {error && (
//         <div className="mt-2 text-center text-xs text-red-400">{error}</div>
//       )}
//     </>
//   );
// }

// // Small component at the bottom to show "loading more / end".
// // Uses forwardRef so we can attach the IntersectionObserver ref from useInView.

// type BottomSentinelProps = {
//   loading: boolean;
//   hasMore: boolean;
// };

// const BottomSentinel = forwardRef<HTMLDivElement, BottomSentinelProps>(
//   function BottomSentinelInner({ loading, hasMore }, ref) {
//     return (
//       <div ref={ref} className="flex flex-col items-center py-4">
//         {loading && (
//           <LoaderIcon />
//         )}
//         {!loading && !hasMore && (
//           <div className="text-[15px] text-white/40">
//             The End! Contribute to the community by <span className="pink-500 underline"><Link href={"/upload"}>uploading</Link></span> stuff:P
//           </div>
//         )}
//       </div>
//     );
//   }
// );



// "use client";

// import LazyImage from "@/app/components/media/LazyImage";
// import LazyVideo from "@/app/components/media/LazyVideo";

// type Item =
//   | { id: string; type: "image"; src: string; alt?: string; views?: number; score?: number; date?: number }
//   | { id: string; type: "gif" | "video"; src: string; poster?: string; views?: number; score?: number; date?: number }
//   | { id: string; type: "creator"; name: string; avatar: string; followers?: number; score?: number; date?: number }
//   | { id: string; type: "niche"; name: string; cover: string; count?: number; score?: number; date?: number };

// export default function ExploreGrid({
//   tab,
//   items,
// }: {
//   tab: "gifs" | "images" | "creators" | "niches";
//   items: Item[];
// }) {
//   // 3 columns on mobile, max 4 on desktop
//   const gridCls = "grid grid-cols-3 lg:grid-cols-4 gap-2";

//   if (tab === "creators") {
//     return (
//       <div className={gridCls}>
//         {items.map((c: any) => (
//           <div key={c.id} className="relative overflow-hidden border-white/10 bg-white/5">
//             <LazyImage src={c.avatar} alt={c.name} className="aspect-square" />
//             {/* bottom label strip */}
//             <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
//               <div className="text-sm font-semibold truncate">{c.name}</div>
//               {c.followers ? (
//                 <div className="text-[11px] text-white/70">{c.followers.toLocaleString()} followers</div>
//               ) : null}
//             </div>
//           </div>
//         ))}
//       </div>
//     );
//   }

//   if (tab === "niches") {
//     return (
//       <div className={gridCls}>
//         {items.map((n: any) => (
//           <div key={n.id} className="relative overflow-hidden object-cover">
//             <LazyImage src={n.cover} alt={n.name} className="aspect-square" />
//             <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
//               <div className="text-white/70 text-sm font-semibold truncate">{n.name}</div>
//               {n.count ? <div className="text-[11px] text-white/70">{n.count.toLocaleString()} posts</div> : null}
//             </div>
//           </div>
//         ))}
//       </div>
//     );
//   }

//   // GIFs / Images
//   return (
//     <div className="grid grid-cols-3 lg:grid-cols-4 gap-1">
//       {items.map((m: any) =>
//         m.type === "image" ? (
//           <LazyImage key={m.id} src={m.src} alt={m.alt} className="w-full aspect-square" />
//         ) : (
//           <LazyVideo key={m.id} src={m.src} className="w-full aspect-square" hoverPlay />
//         )
//       )}
//     </div>
//   );
// }
