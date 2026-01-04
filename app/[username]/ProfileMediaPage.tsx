// app/profile/[username]/page.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trackProfileVisitByUsername } from "@/lib/actions/earn";

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
import { FollowCounts, getFollowCountsByUsername, getMyFollowCounts, getUserProfileByUsername } from "@/lib/actions/social";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { PROVIDERS, type ProviderKey } from "@/app/components/verify/providers";
import { getUserMedia } from "@/app/components/explore/data";


type MediaTab = "gifs" | "images";
const ACCENT = "pink";

export default function ProfileMediaPage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();

  const username = (params?.username).toString();
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
const [overlayVideos, setOverlayVideos] = useState<Video[]>([]);
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [verified, setVerified] = useState(false)
    const router = useRouter()
      const [followCounts, setFollowCounts] = useState<FollowCounts | null>(null);
        const [avatar, setAvatar] = useState("");
          const [followCountsLoading, setFollowCountsLoading] = useState(true);

    const [isMuted, setIsMuted] = useState(true)
    const toggleMute = () => setIsMuted((prev) => !prev);
    const OVERLAY_LIMIT = 12;
const overlayPageRef = useRef(0);
const overlaySeenRef = useRef(new Set<string>());
const overlaySessionRef = useRef(0);
const isLoadingMoreRef = useRef(false);
const [links, setLinks] = useState({});
const [initialOverlayIndex, setInitialOverlayIndex] = useState<number | null>(null);


useEffect(() => {
  overlaySessionRef.current += 1;
  overlayPageRef.current = 0;
  overlaySeenRef.current.clear();
  setOverlayOpen(false);
  setActiveVideoId(null);
  setOverlayVideos([]);
}, [username, tab, sortBy]);





  function formatCount(n?: number | null): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1_000)}k`;
  return num.toString();
}


function userItemToVideo(i: any): Video {
  return {
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
    verified: i.verified
  };
}

    

const handleVideoClick = (video: any, index?: number, currentItems?: any[]) => {
  const items = currentItems ?? [video];

  const batch: Video[] = items
    .filter((x) => x.type === "gif" || x.type === "video")
    .map(userItemToVideo);

  overlaySessionRef.current += 1;

  overlaySeenRef.current.clear();
  for (const v of batch) overlaySeenRef.current.add(String(v.id));

  overlayPageRef.current = Math.ceil(batch.length / OVERLAY_LIMIT);

  setInitialOverlayIndex(typeof index === "number" ? index : null); // ✅ ADD

  setOverlayVideos(batch);
  setActiveVideoId(String(video.id));
  setOverlayOpen(true);
};


  
    const fetchMore = async () => {
  if (tab !== "gifs") return;
  if (isLoadingMoreRef.current) return;

  const session = overlaySessionRef.current;
  isLoadingMoreRef.current = true;
  setIsLoadingMore(true);

  try {
    const MAX_DUP_PAGES = 6;

    for (let tries = 0; tries < MAX_DUP_PAGES; tries++) {
      const pageToFetch = overlayPageRef.current;

      const batch = await getUserMedia({
        username,
        tab,
        sortBy,
        limit: OVERLAY_LIMIT,
        page: pageToFetch,
      });

      if (overlaySessionRef.current !== session) return;

      const media = batch.filter((x: any) => x.type === "gif" || x.type === "video") as any[];
      if (media.length === 0) return; // no more

      const toAdd: Video[] = [];
      for (const m of media) {
        const v = userItemToVideo(m);
        const key = String(v.id);
        if (!overlaySeenRef.current.has(key)) {
          overlaySeenRef.current.add(key);
          toAdd.push(v);
        }
      }

      // we consumed this page either way
      overlayPageRef.current += 1;

      // if we found new items, append and stop
      if (toAdd.length > 0) {
        setOverlayVideos((prev) => [...prev, ...toAdd]);
        return;
      }

      // otherwise: duplicates only, loop and try next page
    }
  } catch (err) {
    console.error("Profile overlay fetchMore error", err);
  } finally {
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
  }
};


useEffect(() => {
  if (!username) return;

  const w = window as any;
  w.__pvLastTs ??= {}; // { [username]: lastTimestampMs }

  const now = Date.now();
  const last = w.__pvLastTs[username] ?? 0;

  // Prevent React Strict Mode (dev) double-fire + accidental duplicate calls
  if (now - last < 1500) return;
  w.__pvLastTs[username] = now;

  trackProfileVisitByUsername(username).catch(() => {});
}, [username]);




 useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      const [isVerified, profile, counts] = await Promise.all([
        getVerified(username),
        getUserProfileByUsername(username),
        getFollowCountsByUsername(username),
      ]);

      if (cancelled) return;

      setVerified(isVerified); // 👈 no toggle, just set it
      setLinks(profile.links)
      setFollowCounts(counts);
      setAvatar(profile.avatarUrl || "/avatar-placeholder.png");
      setFollowCountsLoading(false);
    } catch (err) {
      console.error("Profile header load error", err);
      if (!cancelled) {
        setFollowCountsLoading(false);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [username]);

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

  function normalizeUrl(raw: string) {
  const v = (raw ?? "").trim();
  if (!v) return "";
  // If user pasted without scheme, assume https
  if (!/^https?:\/\//i.test(v)) return `https://${v}`;
  return v;
}

function isSafeExternalUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}



  return (
    <div className="px-3 sm:px-4">
      {/* ===== Header ===== */}
      <div className="pt-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + stats + button */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <div className="h-15 w-15 rounded-full bg-white/60 overflow-hidden">

                  <Image
                  src={avatar || "/avatar-placeholder.png"}
                  height={20}
                  width={20}
                  alt={`${username}' avatar on Upskirt Candy - Porn videos`} 
                  className="h-full w-full object-cover"
                  loading="lazy"              
                  />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-lg sm:text-xl font-semibold truncate">
                  {username}
                </div>
                {verified && <VerifiedBadgeIcon />}
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

            {/* Tag chips row under helper text */}
          {(() => {
            // linksJsonb is your jsonb object from DB, e.g. { onlyfans: "https://...", pornhub: "..."}
            const linksJsonb = (links ?? {}) as Partial<Record<ProviderKey, string>>;

            const items = PROVIDERS
              .map((p) => {
                const url = normalizeUrl(String(linksJsonb[p.key] ?? ""));
                return { ...p, url };
              })
              .filter((p) => p.url && isSafeExternalUrl(p.url));

            if (items.length === 0) return null;

            return (
              <div className="mt-3 flex flex-wrap gap-2">
                
                {items.map((p) => (
                  <Link
                    key={p.key}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${p.label}`}
                  >
                      {/* your icon from PROVIDERS */}
                      <span className="[&>svg]:h-8 [&>svg]:w-8">{p.short}</span>
                    
                    
                  </Link>
                ))}
              </div>
            );
          })()}

          
          </div>

          {/* Right: actions (opens modal) */}
          
        </div>
      </div>

      {/* ===== Tabs + Sort (Explore style) ===== */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex w-full justify-center">
          <ProfileTabs active={tab} username={username} />
        </div>
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
      

      <FullscreenVideoOverlay
                open={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                videos={overlayVideos}
                initialVideoId={activeVideoId}
                isLoadingMore={isLoadingMore}
                isMuted={isMuted}
                toggleMute={toggleMute}
                onEndReached={fetchMore}      
                  initialIndex={initialOverlayIndex}   // ✅ ADD

                
              />
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
    { key: "gifs" as const, label: "GIFs", href: `/${username}?tag=gif` },
    { key: "images" as const, label: "Images", href: `/${username}?tag=image` },
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




