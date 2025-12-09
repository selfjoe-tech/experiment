"use client";

import React, { UIEvent, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import VideoCard from "./VideoCard";
import type { Video } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  videos?: Video[];             // can still be optional from the parent's POV
  initialVideoId?: string | null;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
};

const SCROLL_END_THRESHOLD = 400; // px from bottom

export default function FullscreenVideoOverlay({
  open,
  onClose,
  videos = [],          // 👈 default to empty array so videos is NEVER undefined
  initialVideoId,
  onEndReached,
  isLoadingMore,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTop = useRef(0);

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // When opened, scroll to the clicked video
  useEffect(() => {
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
    } else {
      container.scrollTop = 0;
    }
  }, [open, initialVideoId, videos]);

  if (!open) return null;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const current = target.scrollTop;
    lastScrollTop.current = current;

    // Infinite-scroll hook like we had before
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
    const amount = window.innerHeight * 0.9; // almost a full page
    container.scrollTo({
      top: container.scrollTop + (direction === "down" ? amount : -amount),
      behavior: "smooth",
    });
  };

  console.log(videos, "<----------- videos")

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-xl flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6">
        <span className="text-sm text-white/70">Fullscreen feed</span>
      </header>

      {/* Scrollable vertical feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
      >
        {videos.map((video, index) => (
          <section
            key={index}
            data-fullscreen-idx={index}
            className="snap-center snap-always flex items-center justify-center h-[95vh] w-full mb-10"
          >
            {/* Re-use VideoCard but hide its own fullscreen button */}
            <VideoCard video={video} showFullscreenButton={false} />
          </section>
        ))}

        {isLoadingMore && (
          <div className="py-6 text-center text-sm text-neutral-400">
            Loading more…
          </div>
        )}
      </div>

      {/* Up/down controls on the right (desktop only) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10 mb-50"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
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
