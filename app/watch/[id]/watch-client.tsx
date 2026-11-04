"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import type { Video } from "@/app/components/feed/types";
import { fetchVideoById, fetchWatchSuggestions, registerView } from "@/lib/actions/mediaFeed";
import WatchVideoCard from "@/app/components/feed/WatchVideoCard";
import WatchDesktopShell from "@/app/components/feed/layout/WatchDesktopShell";
import WatchMobileChrome from "@/app/components/feed/layout/WatchMobileChrome";
import { SponsoredAdPanel } from "@/app/components/ads/AdPlacements";

const INITIAL_SUGGESTIONS = 6;
const MORE_SUGGESTIONS = 6;

function SuggestionCard({ video }: { video: Video }) {
  return <a href={`/watch/${video.mediaId}`} className="group flex w-full items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-white/[.06]">
    <div className="relative aspect-video w-[126px] shrink-0 overflow-hidden rounded-md bg-[#17191e] sm:w-[142px]">
      <video
        src={video.src}
        preload="metadata"
        playsInline
        muted
        className="h-full w-full object-cover"
        onMouseEnter={event => { void event.currentTarget.play().catch(() => {}); }}
        onMouseLeave={event => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
        <Play size={24} fill="white" />
      </div>
    </div>
    <div className="min-w-0 flex-1 pt-1 text-left">
      <h3 className="line-clamp-2 break-words text-[13px] font-semibold leading-5 text-white">{video.title || video.description || "Watch video"}</h3>
      <p className="mt-1 truncate text-xs text-white/55">@{video.username}</p>
      <p className="mt-1 text-[11px] text-white/40">{new Intl.NumberFormat("en", { notation: "compact" }).format(video.views)} views</p>
    </div>
  </a>;
}

function WatchRecommendations({ mediaId }: { mediaId: number }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedExtra, setLoadedExtra] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setVideos([]);
    setLoadedExtra(false);
    setCanLoadMore(false);
    setError("");
    setLoading(true);
    fetchWatchSuggestions({ excludeMediaId: mediaId, page: 0, limit: INITIAL_SUGGESTIONS })
      .then(result => { if (!active) return; setVideos(result); setCanLoadMore(result.length === INITIAL_SUGGESTIONS); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Could not load suggestions."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mediaId]);

  async function loadMoreOnce() {
    if (loadingMore || loadedExtra) return;
    setLoadingMore(true);
    setError("");
    try {
      const result = await fetchWatchSuggestions({ excludeMediaId: mediaId, page: 1, limit: MORE_SUGGESTIONS });
      setVideos(previous => [...previous, ...result.filter(video => !previous.some(item => item.mediaId === video.mediaId))]);
      setLoadedExtra(true);
      setCanLoadMore(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more videos.");
    } finally { setLoadingMore(false); }
  }

  return <section aria-label="Recommended videos" className="mt-10 min-w-0 border-t border-white/10 pt-7 text-white">
    <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
      <h2 className="text-[15px] font-semibold">More videos</h2>
      <a href="/reels" className="text-xs text-white/50 hover:text-white">See Reels</a>
    </div>
    {loading && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading video recommendations">
      {Array.from({length: 6}, (_, i) => <div key={i} className="flex animate-pulse gap-3 rounded-lg p-2">
        <div className="aspect-video w-28 shrink-0 rounded-md bg-white/10"/>
        <div className="flex-1 space-y-3 pt-2"><div className="h-3 rounded bg-white/10"/><div className="h-3 w-2/3 rounded bg-white/10"/></div>
      </div>)}
    </div>}
    {!loading && !error && videos.length === 0 && <p className="py-6 text-xs text-white/45">No more videos available.</p>}
    <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">{videos.map(video => <SuggestionCard key={video.mediaId} video={video} />)}</div>
    {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
    {!loading && canLoadMore && !loadedExtra && <button type="button" onClick={() => void loadMoreOnce()} disabled={loadingMore}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50">
      {loadingMore ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
      {loadingMore ? "Loading..." : "Load more"}
    </button>}
  </section>;
}

export default function WatchClient({ mediaId }: { mediaId: number }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) {
      setLoading(false);
      setError("Invalid video.");
      return;
    }
    setVideo(null);
    setLoading(true);
    setError("");
    fetchVideoById(mediaId)
      .then(result => {
        if (!active) return;
        if (!result) { setError("Video not found."); return; }
        setVideo(result);
        void registerView(mediaId);
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load video."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mediaId]);

  return <div className="min-h-screen overflow-x-hidden bg-[#0b0d10] text-white">
    <WatchDesktopShell />
    <WatchMobileChrome />
    <div className="h-[58px] lg:hidden" aria-hidden="true"/>
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-28 pt-5 sm:px-6 lg:pl-[92px] lg:pr-5 lg:pt-8 min-[1360px]:pl-[260px]">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-9">
        <section className="mx-auto w-full min-w-0 max-w-[570px] lg:mx-0">
          {loading ? <div className="aspect-[9/16] w-full animate-pulse rounded-lg bg-white/[.055]" aria-label="Loading video" /> :
            error || !video ? <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-white/10 bg-black px-6 text-center text-sm text-white/50">{error || "Video not found."}</div> :
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-white/10 bg-black">
              <WatchVideoCard video={video} isMuted={muted} toggleMute={() => setMuted(value => !value)}/>
            </div>}
        </section>
        <aside className="w-full min-w-0 max-w-[350px] lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-y-auto lg:overscroll-contain lg:py-3">
          <div className="hidden lg:block">
            <SponsoredAdPanel zone={1130838} withContacts={false} adHeight={420}/>
            <div className="mt-8 border-t border-white/10 pt-7">
              <SponsoredAdPanel zone={1130843} withContacts adHeight={360} title="Sponsored · Footer"/>
            </div>
          </div>
          {/* Mobile ads live in the menu; watch desktop ad stays in the right column. */}

        </aside>
        </div>
        {Number.isSafeInteger(mediaId) && mediaId > 0 && <WatchRecommendations mediaId={mediaId}/>}
      </div>
    </main>
  </div>;
}
