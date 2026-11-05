"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, MoreVertical, Play, RefreshCw } from "lucide-react";
import type { Video } from "@/app/components/feed/types";
import { fetchVideoById, fetchWatchSuggestions, registerView } from "@/lib/actions/mediaFeed";
import WatchVideoCard from "@/app/components/feed/WatchVideoCard";
import WatchDesktopShell from "@/app/components/feed/layout/WatchDesktopShell";
import WatchMobileChrome from "@/app/components/feed/layout/WatchMobileChrome";
import WatchMonetizedAds from "@/app/components/ads/WatchMonetizedAds";
import { VerifiedBadgeIcon } from "@/app/components/icons/VerifiedBadgeIcon";

const INITIAL_SUGGESTIONS = 6;
const MORE_SUGGESTIONS = 6;
const compact = (count: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
    .format(Number.isFinite(count) ? count : 0);
const formatDuration = (duration: number) => {
  if (!Number.isFinite(duration)) return "";
  const seconds = Math.floor(duration);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

function SuggestionCard({ video }: { video: Video }) {
  const [duration, setDuration] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const href = `/watch/${video.mediaId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied(true);
      setMenuOpen(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return <article className="group relative min-w-0 overflow-visible bg-black text-white">
    <a href={href} className="block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-500" aria-label={`Watch ${video.title || video.description || "video"}`}>
      <div className="relative aspect-video w-full overflow-hidden bg-[#18191d]">
        <video src={video.src} preload="metadata" playsInline muted
          className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onMouseEnter={e => { void e.currentTarget.play().catch(() => {}); }}
          onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
          aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 transition-opacity group-hover:opacity-100">
          <Play size={30} className="fill-white text-white drop-shadow-lg" />
        </div>
        {duration !== null && <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/85 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
          {formatDuration(duration)}
        </span>}
      </div>
    </a>
    <div className="relative px-0.5 pb-2 pt-2">
      <div className="flex items-center justify-between gap-2 pr-6 text-[11px]">
        <a href={`/${encodeURIComponent(video.username)}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-white hover:underline">
          <span className="truncate">{video.username.toUpperCase()}</span>
          {video.verified && <VerifiedBadgeIcon />}
        </a>
        <span className="inline-flex shrink-0 items-center gap-1 text-white/60">
          <Eye size={13} /> {compact(video.views)}
        </span>
      </div>
      <a href={href} className="mt-1 block pr-6 text-[13px] leading-5 text-[#f0ce86] hover:text-[#ffe6ac]">
        <span className="line-clamp-2">{video.title || video.description || "Watch video"}</span>
      </a>
      <button type="button" aria-label={`Options for ${video.title || "video"}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
        className="absolute bottom-1 right-0 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
        <MoreVertical size={18} />
      </button>
      {menuOpen && <div className="absolute bottom-9 right-0 z-20 w-36 overflow-hidden rounded-lg border border-white/15 bg-[#202126] py-1 text-xs shadow-2xl">
        <a href={href} className="block px-3 py-2 hover:bg-white/10">Open video</a>
        <button type="button" onClick={() => void copyLink()} className="block w-full px-3 py-2 text-left hover:bg-white/10">Copy link</button>
      </div>}
      {copied && <span role="status" className="absolute bottom-9 right-0 rounded bg-[#202126] px-2 py-1 text-[11px]">Link copied</span>}
    </div>
  </article>;
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
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-base font-semibold tracking-tight">More videos</h2>
      <a href="/reels" className="text-xs text-white/50 hover:text-white">See Reels</a>
    </div>
    {loading && <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading video recommendations">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="animate-pulse">
        <div className="aspect-video w-full bg-white/10"/>
        <div className="mt-3 h-3 w-1/2 rounded bg-white/10"/>
        <div className="mt-2 h-3 w-3/4 rounded bg-white/10"/>
      </div>)}
    </div>}
    {!loading && !error && videos.length === 0 && <p className="py-6 text-xs text-white/45">No more videos available.</p>}
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{videos.map(video => <SuggestionCard key={video.mediaId} video={video}/>)}</div>
    {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
    {!loading && canLoadMore && !loadedExtra && <button type="button" onClick={() => void loadMoreOnce()} disabled={loadingMore}
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50">
      {loadingMore ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
      {loadingMore ? "Loading..." : "Load more"}
    </button>}
  </section>;
}

export default function WatchClient({ mediaId, startAtSeconds = 0 }: { mediaId: number; startAtSeconds?: number }) {
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
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_336px] xl:gap-9">
          <section className="mx-auto w-full min-w-0 max-w-[530px] lg:mx-0">
            <div className="mb-3 flex items-center justify-between text-sm">
              <a href="/reels" className="inline-flex items-center gap-2 text-white/70 hover:text-white">
                <ArrowLeft size={17}/> Reels
              </a>
              <span className="text-xs text-white/45">Full video</span>
            </div>
            {loading ? <div className="mx-auto aspect-[9/16] w-full max-w-[460px] animate-pulse rounded-[22px] bg-white/[.055]" aria-label="Loading video" /> :
              error || !video ? <div className="mx-auto flex aspect-[9/16] w-full max-w-[460px] items-center justify-center rounded-[22px] border border-white/10 bg-black px-6 text-center text-sm text-white/50">{error || "Video not found."}</div> :
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[460px] overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_20px_90px_rgba(0,0,0,.55)] lg:w-[min(460px,calc(77dvh*9/16))]">
                <WatchVideoCard key={video.mediaId} video={video}
                  startAtSeconds={startAtSeconds}
                  isMuted={muted} toggleMute={() => setMuted(value => !value)}/>
              </div>}
          </section>
          {/* Same established sponsor zones; unrelated to player playback. */}
          <div className="relative isolate z-0 min-w-0 border-t border-white/10 pt-6 lg:border-t-0 lg:pt-[178px]">
            <WatchMonetizedAds key={mediaId} mediaId={mediaId} />
          </div>
        </div>
        {Number.isSafeInteger(mediaId) && mediaId > 0 && <WatchRecommendations mediaId={mediaId}/>}
      </div>
    </main>
  </div>;
}
