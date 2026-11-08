"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bookmark, ChevronDown, Heart, Image as ImageIcon, LoaderCircle, Play, Video } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import GridVideoPreview from "@/app/components/media/GridVideoPreview";
import LazyImage from "@/app/components/media/LazyImage";
import { getUserIdFromCookies } from "@/lib/actions/auth";
import { toggleMediaLike } from "@/lib/actions/social";
import { toggleMediaBookmark } from "@/lib/actions/bookmarks";
import { fetchHistoryPostsBatch, type HistoryTab, type HistoryMediaType } from "@/lib/actions/history";
import type { HomePost } from "@/lib/actions/homeFeed";

const BATCH_SIZE = 12;

export default function HistoryClient({ initialTab }: { initialTab: HistoryTab }) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const [mediaType, setMediaType] = useState<HistoryMediaType>("video");
  const [viewer, setViewer] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [items, setItems] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [removingIds, setRemovingIds] = useState<number[]>([]);

  const page = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const version = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getUserIdFromCookies()
      .then((id) => { if (active) setViewer(id); })
      .catch(() => { if (active) setViewer(null); })
      .finally(() => { if (active) setAuthLoaded(true); });
    return () => { active = false; };
  }, []);

  const fetchMore = useCallback(async () => {
    if (!viewer || loadingRef.current || !hasMoreRef.current) return;

    const requestVersion = version.current;
    const currentPage = page.current;
    loadingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const batch = await fetchHistoryPostsBatch({
        tab, mediaType, page: currentPage, limit: BATCH_SIZE,
      });
      if (requestVersion !== version.current) return;

      setItems((previous) => {
        const map = new Map(previous.map((post) => [post.id, post]));
        for (const post of batch) map.set(post.id, post);
        return [...map.values()];
      });
      page.current = currentPage + 1;
      const more = batch.length === BATCH_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (cause) {
      if (requestVersion !== version.current) return;
      setError(cause instanceof Error ? cause.message : "Unable to load your history.");
    } finally {
      if (requestVersion === version.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [viewer, tab, mediaType]);

  useEffect(() => {
    version.current += 1;
    page.current = 0;
    loadingRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setItems([]);
    setError("");
    setRemovingIds([]);

    if (viewer) void fetchMore();
    else setLoading(false);
  }, [viewer, tab, mediaType, fetchMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !viewer || !hasMore || error) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchMore();
    }, { rootMargin: "550px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [viewer, hasMore, error, fetchMore, items.length]);

  function chooseTab(next: HistoryTab) {
    if (next === tab) return;
    setTab(next);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
  }

  async function removeFromHistory(mediaId: number) {
    if (removingIds.includes(mediaId)) return;

    const requestVersion = version.current;
    setRemovingIds((current) => [...current, mediaId]);
    setError("");

    try {
      if (tab === "liked") {
        const result = await toggleMediaLike(mediaId);
        if (!result.liked && requestVersion === version.current) {
          setItems((previous) => previous.filter((post) => post.id !== mediaId));
        }
      } else {
        const stillBookmarked = await toggleMediaBookmark(mediaId);
        if (!stillBookmarked && requestVersion === version.current) {
          setItems((previous) => previous.filter((post) => post.id !== mediaId));
        }
      }
    } catch (cause) {
      if (requestVersion === version.current) {
        setError(cause instanceof Error ? cause.message : "Could not update the post.");
      }
    } finally {
      setRemovingIds((current) => current.filter((id) => id !== mediaId));
    }
  }

  const emptyText = tab === "liked"
    ? mediaType === "video"
      ? "Videos you like will appear here."
      : "Images you like will appear here."
    : mediaType === "video"
      ? "Bookmark videos to save them here."
      : "Bookmark images to save them here.";

  return (
    <div className="min-h-[100dvh] bg-[#0b0d10] text-white">
      <DesktopShell />
      <MobileChrome />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-[88px] sm:px-6 lg:pl-[108px] lg:pr-8 lg:pt-12 min-[1360px]:pl-[250px]">
        <header className="mx-auto max-w-[1100px]">
          <h1 className="text-[30px] font-semibold tracking-[-.045em] sm:text-[38px]">Your history</h1>
          <p className="mt-2 max-w-lg text-[13px] leading-6 text-white/50 sm:text-sm">
            Everything you&apos;ve liked or bookmarked, organized in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-x-5 gap-y-4 border-b border-white/10">
            <div role="tablist" aria-label="History collections" className="flex gap-7 sm:gap-9">
              {(["liked", "bookmarked"] as const).map((key) => {
                const active = key === tab;
                const Icon = key === "liked" ? Heart : Bookmark;
                return (
                  <button
                    type="button"
                    key={key}
                    role="tab"
                    id={`history-tab-${key}`}
                    aria-selected={active}
                    aria-controls="history-panel"
                    onClick={() => chooseTab(key)}
                    className={`relative flex h-11 items-center gap-2 border-b-2 pb-3 text-[13px] font-semibold transition-colors sm:text-sm ${
                      active ? "border-white text-white" : "border-transparent text-white/45 hover:text-white/80"
                    }`}
                  >
                    <Icon size={17} className={active && key === "liked" ? "fill-white" : ""} />
                    {key === "liked" ? "Liked" : "Bookmarked"}
                  </button>
                );
              })}
            </div>

            <div className="relative mb-3 min-w-[135px]">
              <label htmlFor="history-media-type" className="sr-only">Content type</label>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/65">
                {mediaType === "video" ? <Video size={16} /> : <ImageIcon size={16}/>}
              </span>
              <select
                id="history-media-type"
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value as HistoryMediaType)}
                className="h-10 w-full appearance-none rounded-lg border border-white/15 bg-[#1a1b21] py-1 pl-9 pr-8 text-[12px] font-semibold text-white outline-none transition hover:border-white/25 focus-visible:border-pink-400"
              >
                <option value="video">Videos</option>
                <option value="image">Images</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50"/>
            </div>
          </div>
        </header>

        <section
          id="history-panel"
          role="tabpanel"
          aria-labelledby={`history-tab-${tab}`}
          className="mx-auto max-w-[1100px] pt-5"
        >
          {!authLoaded && (
            <div role="status" className="flex justify-center py-16">
              <LoaderCircle className="animate-spin text-white/50" size={24}/>
            </div>
          )}

          {authLoaded && !viewer && (
            <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#14151a] px-5 py-14 text-center">
              <Bookmark size={30} className="mx-auto text-white/55"/>
              <h2 className="mt-4 text-xl font-semibold">Sign in to see your history</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">Your likes and bookmarks are saved to your account.</p>
              <a href="/auth/login?redirect=%2Fhistory"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-pink-500 px-7 text-sm font-semibold hover:bg-pink-400">Log in</a>
            </div>
          )}

          {viewer && (
            <>
              {items.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                  {items.map((post) => (
                    <article key={post.id} className="group relative aspect-[4/5] min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#17181e]">
                      <a
                        href={post.type === "video" ? `/watch/${post.id}` : `/image/${post.id}`}
                        aria-label={post.type === "video" ? `Watch video by @${post.username}` : `View image by @${post.username}`}
                        className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                      >
                        {post.type === "video" ? (
                          <GridVideoPreview
                            src={post.src}
                            cacheKey={`history-${post.id}`}
                            className="h-full w-full"
                            hoverPlay
                            mobileLimit={5}
                            mobileMode="still"
                          />
                        ) : (
                          <LazyImage src={post.src} alt={post.title || post.description || "Saved image"}
                            className="h-full w-full object-cover"/>
                        )}
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15"/>
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                            {post.type === "video" ? <Play size={13} fill="currentColor"/> : <ImageIcon size={14}/>}
                            <span className="min-w-0 truncate">@{post.username}</span>
                          </div>
                          {post.type === "video" && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-white/75">
                              Watch video <ArrowUpRight size={12}/>
                            </div>
                          )}
                        </div>
                      </a>
                      <button
                        type="button"
                        aria-label={tab === "liked" ? "Remove from liked" : "Remove bookmark"}
                        title={tab === "liked" ? "Unlike this post" : "Remove from bookmarks"}
                        disabled={removingIds.includes(post.id)}
                        onClick={() => void removeFromHistory(post.id)}
                        className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-md backdrop-blur-sm transition hover:bg-black/85 disabled:opacity-40"
                      >
                        {tab === "liked" ? <Heart size={18} className="fill-white"/> : <Bookmark size={18} className="fill-white"/>}
                      </button>
                    </article>
                  ))}
                </div>
              )}

              {loading && (
                <div role="status" className={`flex justify-center py-12 ${items.length ? "mt-2" : ""}`}>
                  {items.length ? <LoaderCircle className="animate-spin text-white/50" size={23}/> :
                    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 8 }, (_, index) =>
                        <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-white/[.055]"/>)}
                    </div>}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-20 text-center">
                  {tab === "liked" ? <Heart size={30} className="text-white/25"/> : <Bookmark size={30} className="text-white/25"/>}
                  <p className="text-base font-semibold text-white/80">Nothing here yet</p>
                  <p className="text-sm text-white/45">{emptyText}</p>
                  <a href={mediaType === "video" ? "/reels" : "/explore/images"}
                    className="mt-3 inline-flex h-10 items-center rounded-lg border border-white/20 px-5 text-xs font-semibold text-white hover:bg-white/10">
                    Explore {mediaType === "video" ? "videos" : "images"}
                  </a>
                </div>
              )}

              {error && (
                <div role="alert" className="my-8 rounded-xl border border-rose-500/20 bg-rose-500/[.08] p-4 text-center text-[13px] text-rose-200">
                  {error}
                  <button type="button" onClick={() => void fetchMore()} className="ml-3 font-semibold underline underline-offset-2">Retry</button>
                </div>
              )}

              <div ref={sentinel} className="h-3" aria-hidden="true"/>
              {!hasMore && items.length > 0 && (
                <p className="py-8 text-center text-[12px] text-white/35">You&apos;re all caught up.</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
