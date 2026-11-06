"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import PostCard from "@/app/components/feed/PostCard";
import {
  fetchHomeFeedBatch,
  type HomeFeedMode, type HomePost,
} from "@/lib/actions/homeFeed";
import { getUserIdFromCookies } from "@/lib/actions/auth";
import { useAutoHideHeader } from "@/app/hooks/useAutoHideHeader";
import StaticPageAdPair from "@/app/components/ads/StaticPageAdPair";

function PostSkeleton() {
  return <div className="animate-pulse space-y-3 border-b border-white/10 py-4">
    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-white/10"/><div className="h-3 w-28 rounded bg-white/10"/></div>
    <div className="aspect-[4/5] w-full rounded-sm bg-white/[0.06]"/>
    <div className="h-4 w-44 rounded bg-white/10"/>
  </div>;
}

export default function HomeTimeline() {
  const hideFeedTabs = useAutoHideHeader();
  const [mode, setMode] = useState<HomeFeedMode>("forYou");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const page = useRef(0);
  const loadingRef = useRef(false);
  const moreRef = useRef(true);
  const session = useRef(0);

  useEffect(() => {
    let active = true;
    getUserIdFromCookies()
      .then(id => { if (active) { setViewerId(id); setViewerLoaded(true); } })
      .catch(() => { if (active) setViewerLoaded(true); });
    return () => { active = false; };
  }, []);

  const loadMore = useCallback(async (feedMode: HomeFeedMode, token: number) => {
    if (loadingRef.current || !moreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const currentPage = page.current;
    try {
      const batch = await fetchHomeFeedBatch({ mode: feedMode, page: currentPage, limit: 7 });
      if (token !== session.current) return;
      setPosts(previous => [...previous, ...batch]);
      page.current += 1;
      moreRef.current = batch.length === 7;
      setMore(moreRef.current);
    } catch (err) {
      if (token !== session.current) return;
      setError(err instanceof Error ? err.message : "Could not load the feed.");
    } finally {
      if (token === session.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!viewerLoaded) return;
    session.current += 1;
    const token = session.current;
    page.current = 0;
    loadingRef.current = false;
    moreRef.current = true;
    setMore(true);
    setPosts([]);
    setError(null);
    if (mode === "following" && !viewerId) {
      moreRef.current = false;
      setMore(false);
      setLoading(false);
      return;
    }
    void loadMore(mode, token);
    return () => { session.current += 1; };
  }, [mode, viewerId, viewerLoaded, loadMore]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !more || !viewerLoaded) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !loadingRef.current) void loadMore(mode, session.current);
    }, { rootMargin: "950px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, more, viewerLoaded, loadMore]);



  return <div className="min-h-screen overflow-x-hidden bg-[#0b0d10] text-white">
    <DesktopShell/>
    <MobileChrome/>
    <div className="h-[58px] lg:hidden" aria-hidden="true"/>
    <main className="min-h-screen pb-24 pt-0 lg:pl-[76px] lg:pr-4 lg:pt-0">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-4 px-0 pt-0 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
        <section className="order-2 min-w-0 w-full max-w-[480px] lg:order-1">
          <div className={`sticky top-[58px] z-30 border-b border-white/10 bg-[#0b0d10]/95 px-4 pb-2 pt-3 backdrop-blur-xl transition-all duration-300 sm:px-0 lg:top-0 ${hideFeedTabs ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
            <div className="flex items-center gap-7 text-sm">
              <button type="button" className={`relative pb-3 font-semibold transition-colors ${mode === "forYou" ? "text-white" : "text-white/45 hover:text-white"}`} onClick={() => setMode("forYou")}>For you{mode==="forYou"&&<span className="absolute inset-x-0 bottom-0 h-[2px] bg-white"/>}</button>
              <button type="button" className={`relative pb-3 font-semibold transition-colors ${mode === "following" ? "text-white" : "text-white/45 hover:text-white"}`} onClick={() => setMode("following")}>Following{mode==="following"&&<span className="absolute inset-x-0 bottom-0 h-[2px] bg-white"/>}</button>
            </div>
          </div>

          <div className="space-y-0 px-3 sm:px-0">
            {mode==="following" && !viewerId && viewerLoaded ? <div className="py-24 text-center">
              <h2 className="text-lg font-semibold">See posts from people you follow</h2><p className="mt-2 text-sm text-white/50">Log in to view your following feed.</p>
              <a href="/auth/login" className="mt-6 inline-block rounded-lg bg-[#8ea4ff] px-5 py-2.5 text-sm font-semibold text-black">Log in</a>
            </div> :
            <>
              {posts.map(post => <PostCard post={post} viewerId={viewerId} key={post.id}/>)}
              {loading && (posts.length === 0 ? <><PostSkeleton/><PostSkeleton/></> : <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/55" size={23}/></div>)}
              {!loading && error && <div className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-sm text-white/55">{error}</p><button className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm" onClick={() => void loadMore(mode, session.current)}><RefreshCw size={16}/> Try again</button></div>}
              {!loading && !error && !more && posts.length === 0 && <div className="py-24 text-center"><h2 className="text-lg font-semibold">No posts yet</h2><p className="mt-2 text-sm text-white/50">{mode==="following"?"Follow creators to see their posts here.":"Explore the community or check back later."}</p><a href="/explore/gifs" className="mt-5 inline-block text-sm text-[#8ea4ff]">Explore posts</a></div>}
              {!loading && !error && !more && posts.length > 0 && <p className="py-10 text-center text-xs text-white/35">You're all caught up</p>}
              <div ref={sentinel} className="h-4" aria-hidden="true"/>
            </>}
          </div>
        </section>
        {/* Ads live beside the feed on desktop, in a swipeable row above it on mobile.
            They never depend on For You / Following, pagination, or post state. */}
        <div className="order-1 min-w-0 w-full max-w-[700px] border-b border-white/10 px-3 pb-4 pt-[180px] sm:px-0 lg:sticky lg:top-0 lg:order-2 lg:w-[340px] lg:shrink-0 lg:border-b-0 lg:pt-[186px]">
          <StaticPageAdPair/>
        </div>
      </div>
    </main>
  </div>;
}
