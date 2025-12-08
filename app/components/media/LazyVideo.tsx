"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";
import { Skeleton } from "@/components/ui/skeleton";

export default function LazyVideo({
  src,
  className,
  hoverPlay = false,
}: {
  src: string;
  className?: string;
  hoverPlay?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (inView && !ready) setReady(true);
    if (!inView && vidRef.current) {
      vidRef.current.pause();
      vidRef.current.currentTime = 0;
    }
  }, [inView, ready]);

  const onEnter = () => {
    if (!hoverPlay) return;
    const el = vidRef.current;
    if (!el) return;
    el.muted = true;
    el.play().catch(() => {});
  };

  const onLeave = () => hoverPlay && vidRef.current?.pause();

  return (
    <div
      ref={(n) => {
        ref.current = n;
        wrapRef.current = n;
      }}
      className={`relative overflow-hidden rounded-md ${className || ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {!ready ? (
         
          <Skeleton className="h-full w-full" />
        
      ) : (
        <video
          ref={vidRef}
          src={src}
          preload="metadata"
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
