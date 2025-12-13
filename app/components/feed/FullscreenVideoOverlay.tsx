"use client";

import React, { UIEvent, useEffect, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown, MoveLeft } from "lucide-react";
import VideoCard, { SponsoredVideoCard } from "./VideoCard";
import type { Video } from "./types";
import { registerView, registerAdView } from "@/lib/actions/mediaFeed";

type Props = {
  open: boolean;
  onClose: () => void;
  videos?: Video[];
  initialVideoId?: string | null;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  toggleMute: () => void;
  isMuted: boolean;
};

const SCROLL_END_THRESHOLD = 400;

export default function FullscreenVideoOverlay({
  open,
  onClose,
  videos = [],
  initialVideoId,
  onEndReached,
  isLoadingMore,
  toggleMute,
  isMuted,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  // 🔹 NEW: track which index is currently in view
  const [activeIndex, setActiveIndex] = useState(0);
  // 🔹 NEW: remember which items we’ve already registered a view for
  const viewedKeysRef = useRef<Set<string>>(new Set());

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!videos || videos.length === 0) return;
    const currentVideo = videos[activeIndex];
    if (!currentVideo) return;

    const anyVideo = currentVideo as any;
    const isAd = !!anyVideo._isAd;
    const adId: number | undefined = anyVideo._adId;
    const mediaIdNum = Number(currentVideo.id);

    // unique key so we don't double-count
    const key = isAd
      ? `ad-${adId ?? currentVideo.id}`
      : `media-${currentVideo.id}`;

    if (viewedKeysRef.current.has(key)) return;
    viewedKeysRef.current.add(key);

    if (isAd) {
      if (typeof adId === "string") {
        registerAdView(adId).catch((err) =>
          console.error("registerAdView (fullscreen) error", err)
        );
      }
    } else {
      if (!Number.isNaN(mediaIdNum)) {
        registerView(mediaIdNum).catch((err) =>
          console.error("registerView (fullscreen video) error", err)
        );
      }
    }
  }, [activeIndex, videos]);

  // When opened, scroll to the clicked video
  useEffect(() => {(async () => {
if (!open || !scrollRef.current || videos.length === 0) return;

    const container = scrollRef.current;
    const idx = initialVideoId
      ? videos.findIndex((v) => v.id === initialVideoId)
      : 0;

    const targetIdx = idx >= 0 ? idx : 0;
    const section = container.querySelector<HTMLElement>(
      `[data-fullscreen-idx="${targetIdx}"]`
    );

    if (section) {
      section.scrollIntoView({ block: "center" });
      setActiveIndex(targetIdx); // 🔹 ensure we track the first one
    } else {
      container.scrollTop = 0;
      setActiveIndex(0);
    }

  })()
    
  }, [open, initialVideoId, videos]);

  if (!open) return null;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const current = target.scrollTop;
    lastScrollTop.current = current;

    // 🔹 detect which "page" (index) is active
    const approxIndex = Math.round(
      current / (target.clientHeight || window.innerHeight || 1)
    );
    if (
      approxIndex >= 0 &&
      approxIndex < videos.length &&
      approxIndex !== activeIndex
    ) {
      setActiveIndex(approxIndex);



    }




    // Infinite scroll hook
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

  // 🔹 NEW: register a view whenever activeIndex changes
  

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl  h-full flex flex-col">
      {/* Scrollable vertical feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
      >
        {videos.map((video, index) => {
          const anyVideo = video as any;
          const isAd = !!anyVideo._isAd;
          const visitUrl: string | undefined =
            anyVideo._adLandingUrl ?? undefined;
          const key = isAd ? `ad-${video.id}` : `media-${video.id}`;

          if (isAd) {
            return (
              <section
                data-fullscreen-idx={index}
                key={key}
                className="
                  snap-center snap-always
                  flex items-center justify-center
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
                />
              </section>
            );
          }

          return (
            <section
              key={key}
              data-fullscreen-idx={index}
              className="
                snap-center snap-always
                flex items-center justify-center
                h-screen
                lg:h-[100dvh]
                w-full
              "
            >
              <VideoCard
                video={video}
                showFullscreenButton={false}
                toggleMute={toggleMute}
                isMuted={isMuted}
                onClose={onClose}
                open={open}
              />
            </section>
          );
        })}

        {isLoadingMore && (
          <div className="py-6 text-center text-sm text-neutral-400">
            Loading more…
          </div>
        )}
      </div>

      {/* Up/down controls on the right (desktop only) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        <NavCircleButton
          onClick={() => scrollOneStep("up")}
          ariaLabel="Previous video"
        >
          <ChevronUp className="h-6 w-6" />
        </NavCircleButton>
        <NavCircleButton
          onClick={() => scrollOneStep("down")}
          ariaLabel="Next video"
        >
          <ChevronDown className="h-6 w-6" />
        </NavCircleButton>
      </div>
    </div>
  );
}





// "use client";

// import React, { UIEvent, useEffect, useRef, useState } from "react";
// import { X, ChevronUp, ChevronDown, MoveLeft } from "lucide-react";
// import VideoCard, { SponsoredVideoCard } from "./VideoCard";
// import type { Video } from "./types";

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   videos?: Video[];             // can still be optional from the parent's POV
//   initialVideoId?: string | null;
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
//   toggleMute: () => void;
//   isMuted: boolean;
// };

// const SCROLL_END_THRESHOLD = 400; // px from bottom

// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos = [],          // 👈 default to empty array so videos is NEVER undefined
//   initialVideoId,
//   onEndReached,
//   isLoadingMore,
//   toggleMute,
//   isMuted
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);
//   const [fullScreen, setFullScreen] = useState(true)

//   // Lock body scroll while overlay is open
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // When opened, scroll to the clicked video
//   useEffect(() => {
//     if (!open || !scrollRef.current || videos.length === 0) return;

//     const container = scrollRef.current;
//     const idx = initialVideoId
//       ? videos.findIndex((v) => v.id === initialVideoId)
//       : 0;

//     const targetIdx = idx >= 0 ? idx : 0;
//     const section = container.querySelector<HTMLElement>(
//       `[data-fullscreen-idx="${targetIdx}"]`
//     );

//     if (section) {
//       section.scrollIntoView({ block: "center" });
//     } else {
//       container.scrollTop = 0;
//     }
//   }, [open, initialVideoId, videos]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const target = e.currentTarget;
//     const current = target.scrollTop;
//     lastScrollTop.current = current;

//     // Infinite-scroll hook like we had before
//     if (!onEndReached || isLoadingMore) return;

//     const distanceFromBottom =
//       target.scrollHeight - (target.scrollTop + target.clientHeight);

//     if (distanceFromBottom < SCROLL_END_THRESHOLD) {
//       onEndReached();
//     }
//   };

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = window.innerHeight * 0.9; // almost a full page
//     container.scrollTo({
//       top: container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };


//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl  h-full flex flex-col">
//       {/* Top bar */}
      

//       {/* Scrollable vertical feed */}
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {videos.map((video, index) => {
//   const anyVideo = video as any;
//   const isAd = !!anyVideo._isAd;
//   const visitUrl: string | undefined = anyVideo._adLandingUrl ?? undefined;
//   const key = isAd ? `ad-${video.id}` : `media-${video.id}`;

//   if (isAd) {
//     // Sponsored ad card: no fullscreen button, has "Visit page"
//     return (
//       <section
//         data-fullscreen-idx={index}
//         key={key}
//         className="
//           snap-center snap-always
//           flex items-center justify-center
//           h-[calc(100dvh-7.5rem)]
//           h-screen
//           lg:h-[100dvh]
//           w-full
//         "
//       >
//         <SponsoredVideoCard
//           video={video}
//           isMuted={isMuted}
//           toggleMute={toggleMute}
//           visitUrl={visitUrl || "#"}
//           // no onRequestFullscreen → fullscreen button already hidden
//         />
//       </section>
//     );
//   }

//   // Regular content
//   return (
//     <section
//       key={index}
//       data-fullscreen-idx={index}
//       className="
//         snap-center snap-always
//         flex items-center justify-center
//         h-[calc(100dvh-7.5rem)]
//         h-screen
//         lg:h-[100dvh]
//         w-full
//       "
//     >
//       <VideoCard
//         video={video} 
//         showFullscreenButton={false} 
//         toggleMute={toggleMute}
//         isMuted={isMuted}
//         onClose={onClose}
//         open={open}
//       />
//     </section>
//   );
// })}

//         {isLoadingMore && (
//           <div className="py-6 text-center text-sm text-neutral-400">
//             Loading more…
//           </div>
//         )}
//       </div>

//       {/* Up/down controls on the right (desktop only) */}
//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        
//         <NavCircleButton
//           onClick={() => scrollOneStep("up")}
//           ariaLabel="Previous video"
//         >
//           <ChevronUp className="h-6 w-6" />
//         </NavCircleButton>
//         <NavCircleButton
//           onClick={() => scrollOneStep("down")}
//           ariaLabel="Next video"
//         >
//           <ChevronDown className="h-6 w-6" />
//         </NavCircleButton>
//       </div>
//     </div>
//   );
// }

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
      className="h-10 w-10 rounded-full border border-white/40 bg-black/60
                 flex items-center justify-center text-white hover:bg-black"
    >
      {children}
    </button>
  );
}







// "use client";

// import React, { UIEvent, useEffect, useRef } from "react";
// import { X, ChevronUp, ChevronDown } from "lucide-react";
// import VideoCard from "./VideoCard";
// import type { Video } from "./types";

// type Props = {
//   open: boolean;
//   onClose: () => void;
//   videos?: Video[];             // <-- make optional
//   initialVideoId?: string | null;
//   onEndReached?: () => void;
//   isLoadingMore?: boolean;
// };


// export default function FullscreenVideoOverlay({
//   open,
//   onClose,
//   videos,
//   initialVideoId,
// }: Props) {
//   const scrollRef = useRef<HTMLDivElement | null>(null);
//   const lastScrollTop = useRef(0);

//   // Lock body scroll while overlay is open
//   useEffect(() => {
//     if (!open) return;
//     const prev = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = prev;
//     };
//   }, [open]);

//   // When opened, scroll to the clicked video
//   useEffect(() => {
//     if (!open) return;
//     const container = scrollRef.current;
//     if (!container) return;

//     const idx = initialVideoId
//       ? videos.findIndex((v) => v.id === initialVideoId)
//       : 0;

//     const targetIdx = idx >= 0 ? idx : 0;
//     const section = container.querySelector<HTMLElement>(
//       `[data-fullscreen-idx="${targetIdx}"]`
//     );

//     if (section) {
//       section.scrollIntoView({ block: "center" });
//     } else {
//       container.scrollTop = 0;
//     }
//   }, [open, initialVideoId, videos]);

//   if (!open) return null;

//   const handleScroll = (e: UIEvent<HTMLDivElement>) => {
//     const current = e.currentTarget.scrollTop;
//     lastScrollTop.current = current;
//   };

//   const scrollOneStep = (direction: "up" | "down") => {
//     const container = scrollRef.current;
//     if (!container) return;
//     const amount = window.innerHeight * 0.9; // almost a full page
//     container.scrollTo({
//       top:
//         container.scrollTop + (direction === "down" ? amount : -amount),
//       behavior: "smooth",
//     });
//   };

//   return (
//     <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl flex flex-col">
//       {/* Top bar */}
//       <header className="flex items-center justify-between px-6">
//         <span className="text-sm text-white/70">Fullscreen feed</span>
        
//       </header>

//       {/* Scrollable vertical feed */}
//       <div
//         ref={scrollRef}
//         onScroll={handleScroll}
//         className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
//       >
//         {videos.map((video, index) => (
//           <section
//             key={video.id}
//             data-fullscreen-idx={index}
//             className="snap-center snap-always flex items-center justify-center h-[95vh] w-full mb-10"
//           >
//             {/* Re-use VideoCard but hide its own fullscreen button */}
//             <VideoCard
//               video={video}
//               showFullscreenButton={false}
//             />
//           </section>
//         ))}
//       </div>

//       {/* Up/down controls on the right (desktop only) */}
//       <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
//       <button
//           onClick={onClose}
//           className="rounded-full p-2 hover:bg-white/10 mb-50"
//           aria-label="Close fullscreen"
//         >
//           <X className="h-5 w-5" />
//         </button>
//         <NavCircleButton
//           onClick={() => scrollOneStep("up")}
//           ariaLabel="Previous video"
//         >
//           <ChevronUp className="h-6 w-6" />
//         </NavCircleButton>
//         <NavCircleButton
//           onClick={() => scrollOneStep("down")}
//           ariaLabel="Next video"
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
//       className="h-10 w-10 rounded-full border border-white/40 bg-black/60
//                  flex items-center justify-center text-white hover:bg-black"
//     >
//       {children}
//     </button>
//   );
// }
