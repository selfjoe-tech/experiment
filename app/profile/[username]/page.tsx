// app/profile/[username]/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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

  return (
    <div className="px-3 sm:px-4">
      {/* ===== Header ===== */}
      <div className="pt-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + stats + button */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-white/10 border border-white/15 grid place-items-center">
                <User2 className="h-8 w-8 text-white/80" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-semibold truncate">
                  {username}
                </div>
                <div className="mt-2 flex items-center gap-6 text-sm">
                  <Stat label="Posts" value={stats.posts} />
                  <Stat label="Followers" value={stats.followers} />
                  <Stat label="Views" value={stats.views} />
                </div>
              </div>
            </div>

            <button
              className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-black"
              style={{ backgroundColor: ACCENT }}
              type="button"
            >
              <span className="inline-block h-4 w-4 rounded-full border border-black" />
              Get Verified
            </button>

            {/* Tag chips row under helper text */}
            <div className="mt-5">
              <p className="text-xs text-white/70 mb-2">
                Filter {username}’s porn gifs/images by tag
              </p>
              <div className="flex flex-wrap gap-2">
                {["Amateur", "Ass", "Big Tits"].map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      border: `1px solid ${ACCENT}`,
                      color: "white",
                      background: "transparent",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: actions (opens modal) */}
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            className="shrink-0 rounded-full p-2 hover:bg-white/10"
            aria-label="More"
            title="More"
          >
            <Ellipsis className="h-5 w-5" />
          </button>
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
      <ProfileActionsModal
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onShare={() => {
          const url =
            typeof window !== "undefined" ? window.location.href : "";
          if (url)
            navigator.clipboard.writeText(url).catch(() => {});
          setActionsOpen(false);
        }}
      />

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

function ProfileActionsModal({
  open,
  onClose,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Don’t block clicks when closed
  return (
    <div
      className={`fixed inset-0 z-[100] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        {/* subtle bottom red glow like the screenshot */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-pink-900/30 to-transparent" />
      </div>

      {/* dialog */}
      <div
        className={`absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2
                    rounded-2xl border border-white/10 bg-black/90 shadow-2xl
                    transition-all duration-200 ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-end p-3">
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <ActionRow
            danger
            icon={<Trash2 className="h-5 w-5" />}
            label="Delete this account"
            onClick={() => {
              // TODO: hook up destructive action confirm
              onClose();
            }}
          />
          <ActionRow
            icon={<Pencil className="h-5 w-5" />}
            label="Edit"
            onClick={() => {
              // e.g., route to /settings/profile
              onClose();
            }}
          />
          <ActionRow
            icon={<Share2 className="h-5 w-5" />}
            label="Share this profile"
            onClick={onShare}
          />
          <ActionRow
            icon={<BarChart2 className="h-5 w-5" />}
            label="Data Dashboard"
            onClick={() => {
              // e.g., route to /dashboard
              onClose();
            }}
          />
          <ActionRow
            icon={<Grid3X3 className="h-5 w-5" />}
            label="Manage Uploads"
            onClick={() => {
              // e.g., route to /manage/uploads
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

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
