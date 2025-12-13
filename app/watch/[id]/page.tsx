"use client";

import React, { useEffect, useState } from "react";
import Head from "next/head"; // 👈 NEW
import { useParams } from "next/navigation";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import VideoFeed from "@/app/components/feed/VideoFeed";
import type { FeedTab, Video } from "@/app/components/feed/types";
import { fetchVideoById, registerView } from "@/lib/actions/mediaFeed";
import Link from "next/link";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";

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
    const [isLoggedIn, setIsLoggedIn] = useState(false);
      const [authLoaded, setAuthLoaded] = useState(false);
       useEffect(() => {
  
      (async () => {
        const LoggedInState = await getIsLoggedInFromCookies();
        setIsLoggedIn(LoggedInState)
        setAuthLoaded(true);
      })();
  
      
    }, [isLoggedIn]);


      const showForYouGate =
    activeTab === "forYou" && authLoaded && !isLoggedIn;

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

  // ===== SEO FOR THIS VIDEO =====
  const anyVideo = initialVideo as any;

  const baseTitle: string =
    anyVideo.title ||
    anyVideo.description?.slice(0, 80) ||
    "Watch video on UpskirtCandy";

  const pageTitle = `${baseTitle} | UpskirtCandy`;
  const description: string =
    anyVideo.description ||
    "Watch adult video from creators on UpskirtCandy.";

  const canonical = `https://upskirtcandy.com/watch/${encodeURIComponent(
    String(mediaId)
  )}`;

  const thumbnail: string | undefined =
    anyVideo.poster || anyVideo.thumbnailUrl || undefined;

  const uploadDateRaw: string | undefined =
    anyVideo.createdAt || anyVideo.uploadDate || undefined;

  const uploadDateIso = uploadDateRaw
    ? new Date(uploadDateRaw).toISOString()
    : undefined;

  const contentUrl: string | undefined =
    anyVideo.src || undefined; // URL of the actual video file/stream

  const creatorUsername: string | undefined = anyVideo.username || undefined;
  const creatorUrl = creatorUsername
    ? `https://upskirtcandy.com/${encodeURIComponent(creatorUsername)}`
    : undefined;

  const viewCount = Number(anyVideo.views ?? 0);
  const likeCount = Number(anyVideo.likes ?? 0);

  const videoSchema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: baseTitle,
    description,
    url: canonical,
    embedUrl: canonical,
    ...(thumbnail && { thumbnailUrl: [thumbnail] }),
    ...(uploadDateIso && { uploadDate: uploadDateIso }),
    ...(contentUrl && { contentUrl }),
    publisher: {
      "@type": "Organization",
      name: "UpskirtCandy",
      url: "https://upskirtcandy.com",
    },
    ...(creatorUsername && {
      creator: {
        "@type": "Person",
        name: creatorUsername,
        ...(creatorUrl && { url: creatorUrl }),
      },
    }),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: { "@type": "WatchAction" },
        userInteractionCount: viewCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: { "@type": "LikeAction" },
        userInteractionCount: likeCount,
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index,follow" />

        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="UpskirtCandy" />
        <meta property="og:type" content="video.other" />
        {thumbnail && <meta property="og:image" content={thumbnail} />}
        {contentUrl && <meta property="og:video" content={contentUrl} />}

        {/* Twitter */}
        <meta name="twitter:card" content="player" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={description} />
        {thumbnail && <meta name="twitter:image" content={thumbnail} />}

        {/* JSON-LD VideoObject */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoSchema),
          }}
        />
      </Head>

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
                    active
                      ? "text-white"
                      : "text-white/70 hover:text-white"
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
        {showForYouGate ? (
                      <ForYouLoginGate />
                    ) : authLoaded ? (
                      <VideoFeed
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onScrollDirectionChange={(direction) =>
                          setDesktopNavHidden(direction === "down")
                        }
                      />
                    ) : (
                      // tiny fallback while auth status loads
                      <div className="flex h-screen items-center justify-center lg:pl-[17rem] lg:pr-[21rem]">
                        <span className="text-sm text-white/60">Loading…</span>
                      </div>
                    )}
      </div>
    </>
  );
}

function ForYouLoginGate() {
  return (
    <main className="relative h-screen lg:pl-[17rem] lg:pr-[21rem] lg:pt-16">
      <div className="relative h-full flex items-center justify-center px-3 sm:px-4">
        {/* Background image behind the card */}

        {/* Card */}
        <div className="flex flex-col items-center justify-center relative max-w-sm w-full h-full bg-black/80 border border-white/15 shadow-2xl overflow-hidden"
          style={{
    // 👈 change this path to match your file in /public
          backgroundImage: "url('/images/unlock-2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        
        >
          {/* subtle divider line like the screenshot */}
          <div className="px-6 pt-8 pb-6 text-center">
            <p className="text-sm text-white mb-6">
              You must be logged in to view the{" "}
              <span className="font-semibold">&ldquo;For You&rdquo;</span> feed.
            </p>

            <Link href="/auth/login">
              <button
                type="button"
                className="w-full rounded-full bg-[pink] text-black font-semibold py-3 text-sm hover:brightness-95 transition"
              >
                Log In
              </button>
            </Link>
          </div>

          <div className="h-px bg-white/10" />

          <div className="px-6 py-5 text-center space-y-3">
            <p className="text-xs text-white/70 mb-1">
              Don&apos;t have an account?
            </p>
            <Link href="/auth/signup">
              <button
                type="button"
                className="w-full rounded-full border border-white text-sm font-semibold py-3 hover:bg-white/5 transition"
              >
                Sign Up
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}