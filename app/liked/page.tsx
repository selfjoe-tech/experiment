// app/saved/page.tsx
"use client";

import React, { useState } from "react";
import ExploreGrid, {
  TabKey,
  ExploreItem,
} from "@/app/components/explore/ExploreGrid";
import type { SortKey } from "@/app/components/explore/SortDropdown";
import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
import type { Video } from "@/app/components/feed/types";
import { getSavedItemsForTab } from "@/lib/actions/saved";

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState<Extract<TabKey, "gifs" | "images">>("gifs");
  const [sortBy] = useState<SortKey>("trending");

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenVideos, setFullscreenVideos] = useState<Video[]>([]);
  const [initialVideoId, setInitialVideoId] = useState<string | null>(null);

  const handleVideoClick = (
    video: any,
    _index: number,
    allItems: ExploreItem[]
  ) => {
    // convert ExploreItems of type gif/video into Video-ish objects
    const videoItems: Video[] = allItems
      .filter((i) => i.type === "gif" || i.type === "video")
      .map((i: any) => ({
        id: String(i.id),
        mediaId: Number(i.id),
        src: i.src,
        type: "video",
        views: i.views ?? 0,
        likes: i.likes ?? 0,
        description: i.description ?? "",
        hashtags: i.hashtags ?? [],
        ownerId: i.ownerId,
        username: i.username ?? "unknown",
        avatar: i.avatar ?? "/avatar-placeholder.png",
        likedByMe: i.likedByMe ?? false,
      }));

    setFullscreenVideos(videoItems);
    setInitialVideoId(String(video.id));
    setFullscreenOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white lg:pl-[17rem] lg:pr-[21rem] pt-16 lg:pt-20">
      <div className="px-4 lg:px-0 flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Saved</h1>

        <div className="inline-flex rounded-full bg-white/5 p-1 text-xs">
          {(["gifs", "images"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1 rounded-full transition-colors ${
                activeTab === key
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {key === "gifs" ? "Videos" : "Images"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 lg:px-0 pb-10">
        <ExploreGrid
          tab={activeTab}
          sortBy={sortBy}
          onVideoClick={handleVideoClick}
          // use our server action instead of the default explore loader
          fetcher={getSavedItemsForTab as any}
        />
      </div>

      <FullscreenVideoOverlay
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        videos={fullscreenVideos}
        initialVideoId={initialVideoId}
      />
    </div>
  );
}
