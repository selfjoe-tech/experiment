"use client";

import React, { useMemo, useState } from "react";

import type { FeedTab, Video } from "@/app/components/feed/types";

import WatchDesktopShell from "@/app/components/feed/layout/WatchDesktopShell";
import WatchMobileChrome from "@/app/components/feed/layout/WatchMobileChrome";

import { JuicyAd308x1044_1108082 } from "@/app/components/feed/layout/MobileChrome";

import WatchVideoCard from "@/app/components/feed/WatchVideoCard";

export default function WatchClient({
  mediaId,
}: {
  mediaId: number;
}) {
  const [activeTab, setActiveTab] =
    useState<FeedTab>("trending");

  const [isMobileSearching, setIsMobileSearching] =
    useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [isMuted, setIsMuted] = useState(true);

  /*
   * ============================================================
   * TEMPORARY VIDEO DATA
   * ============================================================
   *
   * Your watch page currently only receives mediaId.
   *
   * Replace this later with the real Supabase video object.
   */
  const video = useMemo<Video>(
    () =>
      ({
        id: mediaId,
        mediaId,
        src: "/demovid.mp4",
        username: "demo_user",
        ownerId: "",
        avatar: "/avatar-placeholder.png",
        verified: false,
        description:
          "This is a temporary video description.",
        hashtags: [],
        views: 0,
        likes: 0,
        likedByMe: false,
      }) as Video,
    [mediaId]
  );

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-black text-white">
      {/* =========================================================
          DESKTOP NAVIGATION
          ========================================================= */}

      <WatchDesktopShell navHidden={false} />

      {/* =========================================================
          MOBILE NAVIGATION
          ========================================================= */}

      <WatchMobileChrome
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSearching={isMobileSearching}
        onSearchOpen={() =>
          setIsMobileSearching(true)
        }
        onSearchClose={() => {
          setIsMobileSearching(false);
          setSearchQuery("");
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* =========================================================
          DESKTOP WATCH PAGE
          ========================================================= */}

      <main
        className="
          hidden
          min-h-screen
          w-full
          overflow-x-hidden
          lg:block
          pl-64
          pr-80
          pt-16
        "
      >
        <div
          className="
            flex
            min-h-[calc(100vh-4rem)]
            w-full
            items-center
            justify-center
            gap-8
            px-6
            py-8
          "
        >
          {/* =====================================================
              LEFT AD RAIL
              ===================================================== */}

          {/*
          <section
            className="
              hidden
              xl:flex
              w-[300px]
              shrink-0
              items-center
              justify-center
            "
          >
            Left ad
          </section>
          */}

          {/* =====================================================
              CENTER VIDEO CARD
              ===================================================== */}

          <section
            className="
              flex
              w-full
              max-w-[520px]
              shrink-0
              justify-center
            "
          >
            <div
              className="
                relative
                w-full
                aspect-[9/16]
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-black
              "
            >
              <WatchVideoCard
                video={video}
                isMuted={isMuted}
                toggleMute={() =>
                  setIsMuted(
                    (previous) => !previous
                  )
                }
              />
            </div>
          </section>

          {/* =====================================================
              RIGHT SIDE
              ===================================================== */}

          {/*
           * WatchDesktopShell already owns the desktop
           * right-side advertisement column.
           */}

          <div className="hidden xl:block w-0 shrink-0" />
        </div>
      </main>

      {/* =========================================================
          MOBILE WATCH PAGE
          ========================================================= */}

      <main
        className="
          lg:hidden
          min-h-screen
          w-full
          overflow-x-hidden
          bg-black
          px-3
          pt-16
          pb-20
        "
      >
        <div className="flex w-full flex-col items-center gap-4">
          {/* =====================================================
              MOBILE VIDEO CARD
              ===================================================== */}

          <section className="w-full flex justify-center">
            <div
              className="
                relative
                w-full
                max-w-[520px]
                aspect-[9/16]
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-black
              "
            >
              <WatchVideoCard
                video={video}
                isMuted={isMuted}
                toggleMute={() =>
                  setIsMuted(
                    (previous) => !previous
                  )
                }
              />
            </div>
          </section>

          {/* =====================================================
              MOBILE SCROLLABLE AD CONTAINER
              ===================================================== */}

          <section className="w-full max-w-[520px]">
            <div
              className="
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-black/90
              "
            >
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Sponsored
                </h2>
              </div>

              <div
                className="
                  max-h-[400px]
                  overflow-y-auto
                  overscroll-contain
                  px-3
                  py-3
                  scrollbar-thin
                  scrollbar-thumb-white/20
                  scrollbar-track-transparent
                "
              >
                <div className="flex justify-center">
                  <JuicyAd308x1044_1108082 />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}