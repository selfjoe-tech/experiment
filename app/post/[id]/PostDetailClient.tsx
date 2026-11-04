"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import PostCard from "@/app/components/feed/PostCard";
import type { HomePost } from "@/lib/actions/homeFeed";
import { fetchHomePostById } from "@/lib/actions/homeFeed";
import { getUserIdFromCookies } from "@/lib/actions/auth";

export default function PostDetailClient({ id }: { id: number }) {
  const [post, setPost] = useState<HomePost | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([fetchHomePostById(id), getUserIdFromCookies()])
      .then(([result, userId]) => { if (active) { setPost(result); setViewerId(userId); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load the post."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell/>
    <MobileChrome/>
    <main className="min-h-screen px-3 pb-24 pt-[76px] sm:px-6 lg:pl-[76px] min-[1360px]:pl-[244px] lg:pr-[340px] lg:pt-9">
      <div className="mx-auto max-w-[480px]">
        <a href="/" className="mb-5 flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={17}/> Back to feed</a>
        {loading ? <div className="flex justify-center py-24"><Loader2 size={26} className="animate-spin text-white/50"/></div> :
          error ? <p className="py-16 text-center text-sm text-rose-400">{error}</p> :
          post ? <PostCard post={post} viewerId={viewerId} /> :
          <p className="py-20 text-center text-sm text-white/50">This post isn't available.</p>}
      </div>
    </main>
  </div>;
}
