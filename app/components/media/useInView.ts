"use client";
import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => setInView(e.isIntersecting)),
      { rootMargin: "100px", threshold: 0.01, ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return { ref, inView } as const;
}
