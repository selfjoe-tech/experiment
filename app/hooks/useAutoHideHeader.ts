"use client";
import { useEffect, useState } from "react";

/** Hide controls while reading down; show them immediately on upward scroll. */
export function useAutoHideHeader(threshold = 96) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let previous = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = window.scrollY;
        const delta = next - previous;
        if (next <= threshold) setHidden(false);
        else if (Math.abs(delta) >= 5) setHidden(delta > 0);
        previous = next;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.cancelAnimationFrame(frame); };
  }, [threshold]);
  return hidden;
}
