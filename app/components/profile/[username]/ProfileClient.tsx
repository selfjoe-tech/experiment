"use client";
import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import LazyImage from "@/app/components/media/LazyImage"; // ← adjust if your path differs

type Tab = "gifs" | "images";

export function ProfileClient({ username }: { username: string }) {
  const [tab, setTab] = React.useState<Tab>("gifs");

  // Demo data — replace with your real fetch
  const tags = ["Amateur", "Ass", "Big Tits"];
  const itemsGIFs = Array.from({ length: 12 }).map((_, i) => ({
    id: `g${i}`,
    // replace with real thumbs from your backend:
    src: `/videos/demo1.mp4`,
  }));
  const itemsImages = Array.from({ length: 12 }).map((_, i) => ({
    id: `i${i}`,
    src: `/images/demo1.png`,
  }));

  const gridItems = tab === "gifs" ? itemsGIFs : itemsImages;

  return (
    <div className="min-h-screen lg:pl-64 lg:pr-80 pb-12">
      {/* page container matches your main content column */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white/10 grid place-items-center text-3xl">
              {/* simple avatar placeholder */}
              <span className="opacity-70">😊</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold">{username}</h1>
              <div className="flex items-center gap-6 text-sm text-white/80">
                <Meta stat={3} label="Posts" />
                <Meta stat={0} label="Followers" />
                <Meta stat={5} label="Views" />
              </div>

              
              <button
                className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black"
                style={{ backgroundColor: "pink" }}
                type="button"
              >
                <span className="inline-block h-4 w-4 rounded-full bg-black" />
                Get Verified
              </button>
            </div>
          </div>

          <button
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="More"
            type="button"
          >
          </button>
        </div>

        {/* Tag filter pills */}
        <div className="mt-6">
          <p className="text-xs sm:text-sm text-white/70 mb-2">
            Filter {username}’s gifs/images by tag
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                className="px-3 py-1.5 rounded-full border text-sm border-pink text-white/90 hover:bg-pink/10"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        </div>
      </div>

  );
}

function Meta({ stat, label }: { stat: number; label: string }) {
  return (
    <span>
      <span className="font-semibold">{stat}</span>{" "}
      <span className="text-white/60">{label}</span>
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-2 text-sm ${
        active ? "font-semibold text-white" : "text-white/60 hover:text-white"
      } border-b-2 ${
        active ? "border-white" : "border-transparent"
      } transition-colors`}
    >
      {children}
    </button>
  );
}
