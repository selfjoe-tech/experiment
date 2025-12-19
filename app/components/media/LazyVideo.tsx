"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";
import { Skeleton } from "@/components/ui/skeleton";

export default function LazyVideo({
  src,
  className,
  hoverPlay = false,
  poster,
}: {
  src: string;
  className?: string;
  hoverPlay?: boolean;
  poster?: string;
}) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });

  // Attach src only while visible (prevents memory buildup)
  const [attached, setAttached] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (inView) {
      setAttached(true);
      return;
    }

    // leaving viewport: hard unload
    setHovering(false);
    setAttached(false);

    const el = vidRef.current;
    if (!el) return;

    try {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load(); // releases buffers in most browsers
    } catch {
      // ignore
    }
  }, [inView]);

  // hover play (only if attached)
  useEffect(() => {
    const el = vidRef.current;
    if (!el) return;
    if (!hoverPlay) return;

    if (hovering) {
      el.muted = true;
      el.loop = true;
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [hovering, hoverPlay, attached]);

  const onEnter = () => {
    if (!hoverPlay) return;
    setHovering(true);
  };

  const onLeave = () => {
    if (!hoverPlay) return;
    setHovering(false);
  };

  // For 30MB files: do NOT preload aggressively in grids
  const preload = hoverPlay ? "metadata" : "none";

  return (
    <div
      ref={(n) => {
        // @ts-expect-error your hook uses ref.current assignment pattern
        ref.current = n;
      }}
      className={`relative overflow-hidden ${className || ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {!attached ? (
        poster ? (
          // If you later add thumbnails, you’ll instantly get a better UX here.
          // For now: Skeleton is safe.
          <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Skeleton className="h-full w-full" />
        )
      ) : (
        <video
          ref={vidRef}
          src={src}
          preload={preload}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}


// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { useInView } from "./useInView";
// import { Skeleton } from "@/components/ui/skeleton";

// export default function LazyVideo({
//   src,
//   className,
//   hoverPlay = false,
// }: {
//   src: string;
//   className?: string;
//   hoverPlay?: boolean;
// }) {
//   const wrapRef = useRef<HTMLDivElement | null>(null);
//   const vidRef = useRef<HTMLVideoElement | null>(null);
//   const { ref, inView } = useInView<HTMLDivElement>();
//   const [ready, setReady] = useState(false);

//   useEffect(() => {
//     if (inView && !ready) setReady(true);
//     if (!inView && vidRef.current) {
//       vidRef.current.pause();
//       vidRef.current.currentTime = 0;
//     }
//   }, [inView, ready]);

//   const onEnter = () => {
//     if (!hoverPlay) return;
//     const el = vidRef.current;
//     if (!el) return;
//     el.muted = true;
//     el.play().catch(() => {});
//   };

//   const onLeave = () => hoverPlay && vidRef.current?.pause();

//   return (
//     <div
//       ref={(n) => {
//         ref.current = n;
//         wrapRef.current = n;
//       }}
//       className={`relative overflow-hidden ${className || ""}`}
//       onMouseEnter={onEnter}
//       onMouseLeave={onLeave}
//     >
//       {!ready ? (
         
//           <Skeleton className="h-full w-full" />
        
//       ) : (
//         <video
//           ref={vidRef}
//           src={src}
//           preload="metadata"
//           playsInline
//           muted
//           className="h-full w-full object-cover"
//         />
//       )}
//     </div>
//   );
// }
