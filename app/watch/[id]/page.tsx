"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import VideoFeed from "@/app/components/feed/VideoFeed";
import type { FeedTab, Video } from "@/app/components/feed/types";
import { fetchVideoById, registerView } from "@/lib/actions/mediaFeed";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const idParam = params?.id;
  const mediaId = Number(idParam);

  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopNavHidden, setDesktopNavHidden] = useState(false);

  const [initialVideo, setInitialVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId || Number.isNaN(mediaId)) {
      setError("Invalid video id.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const v = await fetchVideoById(mediaId);
        if (!v) {
          if (!cancelled) setError("Video not found.");
          return;
        }

        // bump local views once for this watch page
        const bumped: Video = {
          ...v,
          views: (v.views ?? 0) + 1,
        };

        if (!cancelled) {
          setInitialVideo(bumped);
        }

        // fire-and-forget DB view registration
        registerView(mediaId).catch((err) =>
          console.error("registerView (watch) error", err)
        );
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load video.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (error || !initialVideo) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-sm">
        {error || "Video not found."}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Desktop shell */}
      <DesktopShell navHidden={desktopNavHidden} />

      {/* Mobile chrome */}
      <MobileChrome
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSearching={isMobileSearching}
        onSearchOpen={() => setIsMobileSearching(true)}
        onSearchClose={() => {
          setIsMobileSearching(false);
          setSearchQuery("");
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* For you / Trending switch – same as home */}
      <div className="pointer-events-none fixed top-14 lg:top-5 lg:pr-20 left-1/2 z-30 -translate-x-1/2">
        <div className="inline-flex gap-8 text-sm font-medium text-white pointer-events-auto">
          {(["forYou", "trending"] as FeedTab[]).map((tabKey) => {
            const label = tabKey === "forYou" ? "For you" : "Trending";
            const active = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`pb-1 transition-colors ${
                  active ? "text-white" : "text-white/70 hover:text-white"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`block mt-1 rounded-full ${
                    active ? "h-[3px] bg-white" : "h-[3px] bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Main feed, seeded with initialVideo */}
      <VideoFeed
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onScrollDirectionChange={(direction) =>
          setDesktopNavHidden(direction === "down")
        }
        initialVideo={initialVideo}
      />
    </div>
  );
}
