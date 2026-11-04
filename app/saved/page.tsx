"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Loader2 } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import PostCard from "@/app/components/feed/PostCard";
import { getUserIdFromCookies } from "@/lib/actions/auth";
import { fetchBookmarkedPostsBatch } from "@/lib/actions/bookmarks";
import type { HomePost } from "@/lib/actions/homeFeed";

export default function SavedPage() {
  const [viewer, setViewer] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState("");
  const page = useRef(0);
  const fetching = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserIdFromCookies().then(id => setViewer(id)).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const fetchMore = useCallback(async () => {
    if (fetching.current || !viewer || !more) return;
    fetching.current = true;
    setLoading(true);
    setError("");
    try {
      const batch: HomePost[] = await fetchBookmarkedPostsBatch(page.current, 7);
      setItems(previous => [...previous, ...batch]);
      page.current += 1;
      setMore(batch.length === 7);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved posts.");
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [viewer, more]);

  useEffect(() => {
    if (viewer && loaded && page.current === 0) void fetchMore();
    if (loaded && !viewer) setLoading(false);
  }, [viewer, loaded, fetchMore]);

  useEffect(() => {
    if (!sentinel.current || !viewer || !more) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !fetching.current) void fetchMore();
    }, { rootMargin: "600px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [viewer, more, fetchMore]);

  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell />
    <MobileChrome />
    <main className="min-h-screen px-3 pb-28 pt-[78px] sm:px-6 lg:pl-[76px] min-[1360px]:pl-[244px] lg:pr-[340px] lg:pt-12">
      <div className="mx-auto max-w-[480px]">
        <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-5">
          <Bookmark size={25}/>
          <div><h1 className="text-xl font-semibold">Saved</h1><p className="text-xs text-white/50">Posts you've bookmarked</p></div>
        </div>
        {loaded && !viewer ? <p className="py-16 text-center text-sm text-white/60"><Link className="text-[#8ea4ff]" href="/auth/login">Log in</Link> to see your saved posts.</p> :
          <>
            {items.map(item => <PostCard key={item.id} post={item} viewerId={viewer}/>)}
            {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/60" size={24}/></div>}
            {error && <p className="py-6 text-center text-sm text-rose-400">{error} <button type="button" onClick={() => void fetchMore()} className="ml-2 text-white underline">Retry</button></p>}
            {!loading && !error && items.length===0 && <p className="py-20 text-center text-sm text-white/45">Save posts using the bookmark icon to find them here.</p>}
            <div ref={sentinel} className="h-4" />
          </>}
      </div>
    </main>
  </div>;
}
