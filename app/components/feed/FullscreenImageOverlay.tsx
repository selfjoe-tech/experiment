"use client";

import React, { UIEvent, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import ImageCard from "./ImageCard";

export type ImageExploreItem = {
  id: string;
  src: string;
  alt?: string;
  views?: number;

  // optional ad metadata
  _isAd?: boolean;
  _adId?: number;
  _adLandingUrl?: string | null;
  _adOwnerUsername?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: ImageExploreItem[];
  initialIndex?: number;

  // NEW for infinite scroll
  onEndReached?: () => void;
  isLoadingMore?: boolean;
};

const SCROLL_END_THRESHOLD = 400; // px from bottom

export function FullscreenImageOverlay({
  open,
  onClose,
  items,
  initialIndex = 0,
  onEndReached,
  isLoadingMore,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const container = scrollRef.current;
    if (!container) return;

    const idx =
      initialIndex >= 0 && initialIndex < items.length ? initialIndex : 0;

    const section = container.querySelector<HTMLElement>(
      `[data-fullscreen-idx="${idx}"]`
    );

    if (section) {
      section.scrollIntoView({ block: "center" });
    } else {
      container.scrollTop = 0;
    }
  }, [open, initialIndex, items]);

  if (!open) return null;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    lastScrollTop.current = target.scrollTop;

    if (!onEndReached || isLoadingMore) return;

    const distanceFromBottom =
      target.scrollHeight - (target.scrollTop + target.clientHeight);

    if (distanceFromBottom < SCROLL_END_THRESHOLD) {
      onEndReached();
    }
  };

  const scrollOneStep = (direction: "up" | "down") => {
    const container = scrollRef.current;
    if (!container) return;

    const amount = window.innerHeight * 0.9;
    container.scrollTo({
      top: container.scrollTop + (direction === "down" ? amount : -amount),
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl flex flex-col">
      {/* Scrollable vertical feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
      >
        {items.map((item, index) => {
          const isAd = !!item._isAd;
          const key = `${isAd ? "ad" : "img"}-${item.id}-${index}`;

          return (
            <section
              key={key}
              data-fullscreen-idx={index}
              className="snap-center snap-always flex items-center justify-center h-[100vh] w-full"
            >
              <div className="w-full h-[100vh] flex items-center justify-center px-4">
                <ImageCard
                  mediaId={isAd ? undefined : Number(item.id)}
                  initialSrc={item.src}
                  initialViews={item.views}
                  fullscreen
                  onClose={onClose}
                  {...(isAd
                    ? {
                        variant: "sponsored" as const,
                        visitUrl: item._adLandingUrl ?? undefined,
                        sponsorName: item._adOwnerUsername ?? null,
                      }
                    : {})}
                />
              </div>
            </section>
          );
        })}

        {isLoadingMore && (
          <div className="py-6 text-center text-xs text-white/60">
            Loading more…
          </div>
        )}
      </div>

      {/* Up/down controls (desktop) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        <NavCircleButton
          onClick={() => scrollOneStep("up")}
          ariaLabel="Previous image"
        >
          <ChevronUp className="h-6 w-6" />
        </NavCircleButton>
        <NavCircleButton
          onClick={() => scrollOneStep("down")}
          ariaLabel="Next image"
        >
          <ChevronDown className="h-6 w-6" />
        </NavCircleButton>
      </div>
    </div>
  );
}

function NavCircleButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-10 w-10 rounded-full border border-white/40 bg-black/60 flex items-center justify-center text-white hover:bg-black"
    >
      {children}
    </button>
  );
}




// "use client";

// import React, { UIEvent, useEffect, useRef } from "react";
// import { X, ChevronUp, ChevronDown } from "lucide-react";
// import LazyImage from "@/app/components/media/LazyImage";
// import ImageCard from "./ImageCard";


// export type ImageExploreItem = {
//   id: string;
//   src: string;
//   alt?: string;
//   views?: number;

//   // NEW: optional ad metadata
//   _isAd?: boolean;
//   _adId?: number;
//   _adLandingUrl?: string | null;
//   _adOwnerUsername?: string | null;
// };

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   items: ImageExploreItem[];
//   initialIndex?: number;

//   // NEW for infinite scroll
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
// };

// export function FullscreenImageOverlay({
//   open,
//   onClose,
//   items,
//   initialIndex = 0,
//   onEndReached,
//   isLoadingMore,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);
//   const SCROLL_END_THRESHOLD = 400; // px


//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   useEffect(() => {
//     if (!open) return;
//     const container = scrollRef.current;
//     if (!container) return;

//     const idx =
//       initialIndex >= 0 && initialIndex < items.length ? initialIndex : 0;

//     const section = container.querySelector<HTMLElement>(
//       `[data-fullscreen-idx="${idx}"]`
//     );

//     if (section) {
//       section.scrollIntoView({ block: "center" });
//     } else {
//       container.scrollTop = 0;
//     }
//   }, [open, initialIndex, items]);

//   if (!open) return null;

  

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;

//     const amount = window.innerHeight * 0.9;
//     container.scrollTo({
//       top: container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };

//     if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const target = e.currentTarget;
//     lastScrollTop.current = target.scrollTop;

//     if (!onEndReached || isLoadingMore) return;

//     const distanceFromBottom =
//       target.scrollHeight - (target.scrollTop + target.clientHeight);

//     if (distanceFromBottom < SCROLL_END_THRESHOLD) {
//       onEndReached();
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl flex flex-col">
//       {/* Top bar */}

//       {/* Scrollable vertical feed */}
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {items.map((item, index) => {
//           const anyItem = item as any;
//           const isAd = !!anyItem._isAd;
//           const keyPrefix = isAd ? "ad" : "img";
//           const key = `${keyPrefix}-${item.id}-${index}`;

//           if (isAd) {
//             const sponsorName: string | undefined = anyItem._adOwnerUsername ?? undefined;
//             const visitUrl: string | undefined = anyItem._adLandingUrl ?? undefined;

//             return (
//             <section
//               key={index}
//               data-fullscreen-idx={index}
//               className="snap-center snap-always flex items-center justify-center h-[100vh] w-full"
//             >
//               <div className="w-full h-[100vh] flex items-center justify-center px-4">
//                 <ImageCard
//                   mediaId={undefined}              // 🔸 not from media table
//                   initialSrc={item.src}
//                   initialViews={item.views}
//                   fullscreen
//                   onClose={onClose}
//                   variant="sponsored"              // 🔸 NEW
//                   visitUrl={visitUrl || "#"}       // 🔸 Visit Page CTA
//                   sponsorName={sponsorName}
//                 />
//               </div>
//             </section>
//           );
//         }

//     // Normal media image
//     return (
//             <section
//               key={index}
//               data-fullscreen-idx={index}
//               className="snap-center snap-always flex items-center justify-center h-[100vh] w-full"
//             >
//               <div className="w-full h-[100vh] flex items-center justify-center px-4">
//                 <ImageCard
//                   mediaId={Number(item.id)}
//                   initialSrc={item.src}
//                   initialViews={item.views}
//                   fullscreen
//                   onClose={onClose}
//                 />
//               </div>
//             </section>
//           );
//         })}

//         {isLoadingMore && (
//           <div className="py-6 text-center text-sm text-neutral-400">
//             Loading more…
//           </div>
//         )}
//       </div>


//       {/* Up/down controls (desktop) */}
//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        
//         <NavCircleButton
//           onClick={() => scrollOneStep("up")}
//           ariaLabel="Previous image"
//         >
//           <ChevronUp className="h-6 w-6" />
//         </NavCircleButton>
//         <NavCircleButton
//           onClick={() => scrollOneStep("down")}
//           ariaLabel="Next image"
//         >
//           <ChevronDown className="h-6 w-6" />
//         </NavCircleButton>
//       </div>
//     </div>
//   );
// }

// function NavCircleButton({
//   children,
//   onClick,
//   ariaLabel,
// }: {
//   children: React.ReactNode;
//   onClick: () => void;
//   ariaLabel: string;
// }) {
//   return (
//     <button
//       type="button"
//       aria-label={ariaLabel}
//       onClick={onClick}
//       className="h-10 w-10 rounded-full border border-white/40 bg-black/60 flex items-center justify-center text-white hover:bg-black"
//     >
//       {children}
//     </button>
//   );
// }