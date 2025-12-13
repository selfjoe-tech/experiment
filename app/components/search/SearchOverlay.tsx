// app/components/search/SearchOverlay.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Hash,
  Image as ImageIcon,
  PlayCircle,
  User2,
} from "lucide-react";
import type {
  GlobalSearchResult,
  CreatorSearchResult,
  TagSearchResult,
  MediaSearchResult,
} from "@/lib/actions/search";
import { globalSearch } from "@/lib/actions/search";
import { checkIsFollowing, toggleFollowUser } from "@/lib/actions/social";
import LazyImage from "@/app/components/media/LazyImage";
import LazyVideo from "@/app/components/media/LazyVideo";

type TabKey = "creators" | "tags" | "images" | "videos" | "all";

type Props = {
  query: string;
  onItemSelected?: () => void;
};

export default function SearchOverlay({ query, onItemSelected }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("creators");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState(query);

  // debounce query
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = debouncedQ.trim();
      if (!q || q.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await globalSearch(q);
        if (!cancelled) setResults(data);
      } catch (err) {
        console.error("globalSearch error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  if (!query.trim()) return null;

  const showTab = (tab: TabKey) => {
    setActiveTab(tab);
  };

  const tabClass = (tab: TabKey) =>
    `pb-2 text-sm ${
      activeTab === tab
        ? "text-white font-semibold border-b-2 border-white"
        : "text-white/70 hover:text-white"
    }`;

  const current = results ?? {
    creators: [],
    tags: [],
    images: [],
    videos: [],
  };

  const renderSkeleton = () => (
    <div className="p-4 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-9 w-9 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-white/10 rounded" />
            <div className="h-3 w-1/4 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderCreators = () => {
    if (loading) return renderSkeleton();
    if (!current.creators.length)
      return (
        <div className="p-4 text-xs text-white/60">
          No creators match your search.
        </div>
      );

    return (
      <div className="p-4 space-y-3">
        {current.creators.map((c) => (
          <CreatorRow
            key={c.id}
            user={c}
            onSelected={onItemSelected}
          />
        ))}
      </div>
    );
  };

  const renderTags = () => {
    if (loading) return renderSkeleton();
    if (!current.tags.length)
      return (
        <div className="p-4 text-xs text-white/60">
          No tags match your search.
        </div>
      );

    return (
      <div className="p-4 space-y-2">
        {current.tags.map((t) => (
          <TagRow key={t.id} tag={t} onSelected={onItemSelected} />
        ))}
      </div>
    );
  };

  const renderMediaList = (items: MediaSearchResult[], type: "image" | "video") => {
    if (loading) {
      return (
        <div className="p-4 grid grid-cols-3 gap-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-white/10" />
          ))}
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="p-4 text-xs text-white/60">
          No {type === "image" ? "images" : "videos"} match your search.
        </div>
      );
    }

    return (
      <div className="p-3 grid grid-cols-3 gap-2">
        {items.map((m) => {
          const href =
            type === "video"
              ? `/watch/${m.id}`
              : `/media/${m.id}`;

          return (
            <Link
              href={href}
              key={`${type}-${m.id}`}
              onClick={onItemSelected}
              className="block aspect-square overflow-hidden rounded-md"
            >
              {type === "image" ? (
                <LazyImage
                  src={m.src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <LazyVideo
                  src={m.src}
                  className="w-full h-full object-cover"
                  hoverPlay
                />
              )}
            </Link>
          );
        })}
      </div>
    );
  };

  const renderAll = () => {
    if (loading) return renderSkeleton();

    const hasAny =
      current.creators.length ||
      current.tags.length ||
      current.images.length ||
      current.videos.length;

    if (!hasAny)
      return (
        <div className="p-4 text-xs text-white/60">
          No results found.
        </div>
      );

    return (
      <div className="p-4 space-y-5">
        {current.creators.length > 0 && (
          <section>
            <h4 className="text-xs text-white/60 mb-2">Creators</h4>
            <div className="space-y-2">
              {current.creators.slice(0, 4).map((c) => (
                <CreatorRow
                  key={c.id}
                  user={c}
                  onSelected={onItemSelected}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        {current.tags.length > 0 && (
          <section>
            <h4 className="text-xs text-white/60 mb-2">Tags</h4>
            <div className="space-y-1">
              {current.tags.slice(0, 6).map((t) => (
                <TagRow key={t.id} tag={t} onSelected={onItemSelected} />
              ))}
            </div>
          </section>
        )}

        {current.images.length > 0 && (
          <section>
            <h4 className="text-xs text-white/60 mb-2">Images</h4>
            <div className="grid grid-cols-3 gap-2">
              {current.images.slice(0, 6).map((m) => (
                <Link
                  href={`/media/${m.id}`}
                  key={`img-${m.id}`}
                  onClick={onItemSelected}
                  className="block aspect-square overflow-hidden rounded-md"
                >
                  <LazyImage
                    src={m.src}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {current.videos.length > 0 && (
          <section>
            <h4 className="text-xs text-white/60 mb-2">Videos</h4>
            <div className="grid grid-cols-3 gap-2">
              {current.videos.slice(0, 6).map((m) => (
                <Link
                  href={`/watch/${m.id}`}
                  key={`vid-${m.id}`}
                  onClick={onItemSelected}
                  className="block aspect-square overflow-hidden rounded-md"
                >
                  <LazyVideo
                    src={m.src}
                    className="w-full h-full object-cover"
                    hoverPlay
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  let body: React.ReactNode = null;
  if (activeTab === "creators") body = renderCreators();
  else if (activeTab === "tags") body = renderTags();
  else if (activeTab === "images") body = renderMediaList(current.images, "image");
  else if (activeTab === "videos") body = renderMediaList(current.videos, "video");
  else body = renderAll();

  return (
    <div className="absolute z-50 mt-2 w-full max-w-lg rounded-2xl bg-black border border-white/15 shadow-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-6 px-4 pt-3">
        <button className={tabClass("creators")} onClick={() => showTab("creators")}>
          Creators
        </button>
        <button className={tabClass("tags")} onClick={() => showTab("tags")}>
          Tags
        </button>
        <button className={tabClass("images")} onClick={() => showTab("images")}>
          Images
        </button>
        <button className={tabClass("videos")} onClick={() => showTab("videos")}>
          Videos
        </button>
        <button className={tabClass("all")} onClick={() => showTab("all")}>
          All
        </button>
      </div>

      <div className="border-t border-white/10 mt-2">{body}</div>
    </div>
  );
}

/* ---------- Row components ---------- */

function CreatorRow({
  user,
  onSelected,
  compact,
}: {
  user: CreatorSearchResult;
  onSelected?: () => void;
  compact?: boolean;
}) {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const following = await checkIsFollowing(user.id);
        if (!cancelled) setIsFollowing(following);
      } catch (err) {
        console.error("CreatorRow checkIsFollowing error", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await toggleFollowUser(user.id);
      setIsFollowing(res.following);
    } catch (err) {
      console.error("CreatorRow toggleFollowUser error", err);
    } finally {
      setLoading(false);
    }
  };

  const followersLabel =
    user.followerCount >= 1000
      ? `${Math.round(user.followerCount / 100) / 10}K FOLLOWERS`
      : `${user.followerCount} FOLLOWERS`;

  return (
    <Link
      href={`/${user.username}`}
      onClick={onSelected}
      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5 transition-colors"
    >
      <div className="h-9 w-9 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.username}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <User2 className="h-4 w-4 text-white/70" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {user.username}
        </div>
        {!compact && (
          <div className="text-[11px] text-white/60">
            {followersLabel}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleFollow}
        disabled={loading || isFollowing === null}
        className={`px-3 py-1.5 text-xs rounded-full border ${
          isFollowing
            ? "bg-white text-black border-transparent"
            : "bg-transparent text-white border-white/60"
        } disabled:opacity-60`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </Link>
  );
}

function TagRow({
  tag,
  onSelected,
}: {
  tag: TagSearchResult;
  onSelected?: () => void;
}) {
  const postsLabel =
    tag.postCount >= 1000
      ? `${Math.round(tag.postCount / 100) / 10}K POSTS`
      : `${tag.postCount} POSTS`;

  return (
    <Link
      href={`/explore/niches/${encodeURIComponent(tag.slug)}`}
      onClick={onSelected}
      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5 transition-colors"
    >
      <div className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center">
        <Hash className="h-4 w-4 text-white/80" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          #{tag.label}
        </div>
        <div className="text-[11px] text-white/60">{postsLabel}</div>
      </div>
    </Link>
  );
}
