"use client";

import React, { UIEvent, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import LazyImage from "@/app/components/media/LazyImage";
import ImageCard from "./ImageCard";

export type ImageExploreItem = {
  id: string;      
  src: string;
  alt?: string;
  views?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: ImageExploreItem[];
  initialIndex?: number;
};

export function FullscreenImageOverlay({
  open,
  onClose,
  items,
  initialIndex = 0,
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
    lastScrollTop.current = e.currentTarget.scrollTop;
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
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3">
        <span className="text-sm text-white/70">Fullscreen feed</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10 lg:hidden"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Scrollable vertical feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 snap-y h-screen snap-mandatory overflow-y-scroll scroll-smooth overscroll-y-contain"
      >
        {items.map((item, index) => (
          <section
            key={index}
            data-fullscreen-idx={index}
            className="snap-center snap-always flex items-center justify-center h-[95vh] w-full mb-10"
            >
            <div className="w-full h-full flex items-center justify-center px-4">
                <ImageCard
                mediaId={Number(item.id)}
                initialSrc={item.src}
                initialViews={item.views}
                fullscreen
                />
            </div>
            </section>
        ))}
      </div>

      {/* Up/down controls (desktop) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-[95] flex-col gap-3">
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10 mb-10"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
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