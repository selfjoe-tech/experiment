"use client";

import * as React from "react";
// If you're not in a Next.js route, you can swap this for <img>.
import Image from "next/image";

type MovingWatermarkVideoProps = {
  /** Video source URL (e.g. from Supabase storage public URL) */
  src: string;
  /** Optional poster frame */
  poster?: string;
  /** Logo image URL (transparent PNG/SVG works best) */
  logoSrc: string;
  /** Username to show under the logo */
  username: string;
  /** Extra classes for the outer wrapper */
  className?: string;
  /** How often to move the watermark (ms) */
  moveIntervalMs?: number;
  /** Whether video autoplays (defaults true) */
  autoPlay?: boolean;
  /** Initial mute state (defaults true) */
  muted?: boolean;
  /** Loop video (defaults true) */
  loop?: boolean;
  /** Optional: controls on/off (defaults true) */
  controls?: boolean;
};

/**
 * A simple video player with a TikTok-style moving watermark overlay.
 */
export default function MovingWatermarkVideo({
  src,
  poster,
  logoSrc,
  username,
  className = "",
  moveIntervalMs = 7000,
  autoPlay = true,
  muted = true,
  loop = true,
  controls = true,
}: MovingWatermarkVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // positions the watermark will cycle through
  const POSITIONS = React.useMemo(
    () =>
      [
        { top: "8%", left: "6%" },
        { top: "8%", right: "6%" },
        { bottom: "12%", left: "6%" },
        { bottom: "12%", right: "6%" },
        { top: "40%", left: "8%" },
        { top: "40%", right: "8%" },
      ] as React.CSSProperties[],
    []
  );

  const [posIndex, setPosIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  // Move watermark periodically
  React.useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      // fade out
      setVisible(false);

      // after fade-out, move + fade in
      fadeTimeout = setTimeout(() => {
        setPosIndex((prev) => (prev + 1) % POSITIONS.length);
        setVisible(true);
      }, 350); // match CSS duration
    }, moveIntervalMs);

    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [moveIntervalMs, POSITIONS.length]);

  return (
    <div
      className={
        "relative w-full max-w-[min(100vw,480px)] md:max-w-[min(100vw,600px)] lg:max-w-[min(100vw,420px)] aspect-[9/16] overflow-hidden bg-black " +
        className
      }
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full object-cover"
        playsInline
        loop={loop}
        muted={muted}
        autoPlay={autoPlay}
        controls={controls}
      />

      {/* Moving watermark overlay */}
      <div
        className={`
          pointer-events-none
          absolute z-20
          flex flex-col items-center
          transition-all duration-300 ease-in-out
          ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
        `}
        style={POSITIONS[posIndex]}
      >
        {/* Logo circle */}
        <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/40 border border-white/40 overflow-hidden flex items-center justify-center backdrop-blur-sm">
          {/* Swap to <img> if you don't want next/image here */}
          <Image
            src={logoSrc}
            alt="watermark-logo"
            width={48}
            height={48}
            className="h-full w-full object-contain"
          />
        </div>
        {/* Username text */}
        <span className="mt-1 text-[10px] md:text-xs font-semibold text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]">
          @{username}
        </span>
      </div>

      {/* Optional: subtle gradient overlays like your feed */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
    </div>
  );
}
