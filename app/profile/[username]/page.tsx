// app/profile/[username]/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Ellipsis,
  User2,
  X,
  Trash2,
  Pencil,
  Share2,
  BarChart2,
  Grid3X3,
} from "lucide-react";

import ExploreGrid from "@/app/components/explore/ExploreGrid";
import SortDropdown, { SortKey } from "@/app/components/explore/SortDropdown";
import { fetchByUserName } from "@/app/components/explore/data"; 
import type { Video } from "@/app/components/feed/types";
import FullscreenVideoOverlay from "@/app/components/feed/FullscreenVideoOverlay";
import UserGrid from "@/app/components/profile/UserGrid";
import { VerifiedBadgeIcon } from "@/app/components/icons/VerifiedBadgeIcon";
import { verify } from "crypto";
import { getUserProfileFromCookies, getVerified } from "@/lib/actions/auth";
import { FollowCounts, getMyFollowCounts } from "@/lib/actions/social";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

type MediaTab = "gifs" | "images";
const ACCENT = "pink";

export default function ProfileMediaPage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();

  const username = (params?.username || "darknoir").toString();
  const tagParam = (search?.get("tag") || "gif").toLowerCase();
  const tab: MediaTab = tagParam === "image" ? "images" : "gifs";

  // Fake stats for now; wire these to your API later
  const stats = { posts: 3, followers: 0, views: 5 };

  const [sortBy, setSortBy] = useState<SortKey>("trending");
  const [actionsOpen, setActionsOpen] = useState(false);

  const [items, setItems] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
    // Only used for the fullscreen overlay
    const [overlayVideos, setOverlayVideos] = useState<Video[]>();
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [verified, setVerified] = useState(false)
    const router = useRouter()
      const [followCounts, setFollowCounts] = useState<FollowCounts | null>(null);
        const [avatar, setAvatar] = useState("");
          const [followCountsLoading, setFollowCountsLoading] = useState(true);


          function formatCount(n?: number | null): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1_000)}k`;
  return num.toString();
}

    

  const handleVideoClick = (
    video: Video,
    _index: number,
    currentVideos: Video[]
  ) => {
    setOverlayVideos(currentVideos);  // 👈 pass the grid’s list
    setActiveVideoId(video.id);
    setOverlayOpen(true);
  };


  
    const fetchMore = async () => {
      if (isLoadingMore) return;
      setIsLoadingMore(true);
  
      try {
        const res = await fetch(`/api/explore?page=${page + 1}`);
        const data = (await res.json()) as { videos: Video[] };
  
        setOverlayVideos((prev) => [...prev, ...data.videos]);
        setPage((p) => p + 1);
      } catch (err) {
        console.error("Failed to load more videos", err);
      } finally {
        setIsLoadingMore(false);
      }
    };


  useEffect( () => {

        let cancelled = false;

    (async () => {
        const verify = await getVerified();
        if (verify === true) {
          setVerified(prev => !prev)
        }

      const [profile, counts] = await Promise.all([
                getUserProfileFromCookies(),
                getVerified(),
                getMyFollowCounts(),
              ]);
              setFollowCounts(counts);
              setAvatar(profile.avatarUrl || "/avatar-placeholder.png");
        if (!cancelled) setFollowCountsLoading(false);

        return () => {
      cancelled = true;
    };

    })()
  } )

  // ===== Fetch media for this username + tab =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchByUserName(username, tab);
        if (!cancelled) {
          setItems(data);
        }
      } catch (err) {
        console.error("ProfileMediaPage fetch error", err);
        if (!cancelled) {
          setError("Failed to load media");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [username, tab]);

  // ===== Sort the fetched items locally =====
  const sortedItems = useMemo(() => {
    const base = items ?? [];
    const copy = [...base];

    switch (sortBy) {
      case "newest":
        copy.sort(
          (a: any, b: any) =>
            (b.createdAt || b.date || 0) - (a.createdAt || a.date || 0)
        );
        break;
      case "views":
        copy.sort(
          (a: any, b: any) => (b.views || 0) - (a.views || 0)
        );
        break;
      default:
        // trending / score – fall back to views or a score field
        copy.sort(
          (a: any, b: any) => (b.score || b.views || 0) - (a.score || a.views || 0)
        );
    }

    return copy;
  }, [items, sortBy]);

  console.log(avatar, "<========= avatar")

  return (
    <div className="px-3 sm:px-4">
      {/* ===== Header ===== */}
      <div className="pt-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + stats + button */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <Image
              src={avatar || "/avatar-placeholder.png"}
              height={20}
              width={20}
              alt={username} 
              
              />
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-semibold truncate">
                  {username}
                </div>
                {followCountsLoading ? (
            <div className="mt-1 flex gap-2">
              <Skeleton className="h-3 w-20 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          ) : (
            <div className="text-xs text-white/60">
              {formatCount(followCounts?.followers)} Followers ·{" "}
              {formatCount(followCounts?.following)} Following ·{" "}
              {formatCount(followCounts?.views)} Views
            </div>
          )}
              </div>
            </div>

            

            {/* Tag chips row under helper text */}
          
          </div>

          {/* Right: actions (opens modal) */}
          
        </div>
      </div>

      {/* ===== Tabs + Sort (Explore style) ===== */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <ProfileTabs active={tab} username={username} />
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* ===== Grid ===== */}
      {error && (
        <div className="text-sm text-red-400 mb-2">{error}</div>
      )}
      {loading && sortedItems.length === 0 ? (
        <div className="py-10 text-center text-white/60">Loading…</div>
      ) : (
            <UserGrid
              username={username}
              tab={tab}            
              sortBy={sortBy}
              onVideoClick={handleVideoClick}
            />      
        )}

      {/* ===== Actions Modal ===== */}
      {/* <ProfileActionsModal
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onShare={() => {
          const url =
            typeof window !== "undefined" ? window.location.href : "";
          if (url)
            navigator.clipboard.writeText(url).catch(() => {});
          setActionsOpen(false);
        }}
      /> */}

      <FullscreenVideoOverlay
                open={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                videos={overlayVideos}
                initialVideoId={activeVideoId}
                onEndReached={fetchMore}
                isLoadingMore={isLoadingMore}
              />
    </div>
  );
}




function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-semibold">{value}</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}

function ProfileTabs({
  active,
  username,
}: {
  active: "gifs" | "images";
  username: string;
}) {
  const tabs = [
    { key: "gifs" as const, label: "GIFs", href: `/profile/${username}?tag=gif` },
    { key: "images" as const, label: "Images", href: `/profile/${username}?tag=image` },
  ];
  return (
    <div className="flex items-center gap-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`pb-2 text-sm ${
            active === t.key
              ? "font-semibold text-white border-b-2 border-white"
              : "text-white/70 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* --------------------- Modal --------------------- */


function ActionRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors
        ${danger ? "text-pink-400 hover:bg-pink-400/10" : "hover:bg-white/10"}`}
    >
      <span className={`shrink-0 ${danger ? "text-pink-400" : "text-white/90"}`}>{icon}</span>
      <span className={`text-sm ${danger ? "text-pink-400" : "text-white"}`}>{label}</span>
    </button>
  );
}
