"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Bookmark, Check, Eye, Heart, Loader2, MessageCircle, Pause, Play,
  Send, Volume2, VolumeX, X
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { HomePost } from "@/lib/actions/homeFeed";
import { toggleMediaLike, toggleFollowUser, checkIsFollowing } from "@/lib/actions/social";
import { registerView } from "@/lib/actions/mediaFeed";
import { addCommentForMedia, fetchCommentsForMedia, toggleCommentLikeForMedia, type CommentNode } from "@/lib/actions/comments";
import { checkMediaBookmarked, toggleMediaBookmark } from "@/lib/actions/bookmarks";
import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";

function compact(num: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - Date.parse(date));
  if (!Number.isFinite(diff)) return "";
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h";
  if (diff < 604_800_000) return Math.floor(diff / 86_400_000) + "d";
  return new Date(date).toLocaleDateString();
}

function remainingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—:—";
  const total = Math.ceil(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function commentTotal(comments: CommentNode[]): number {
  return comments.reduce((count, node) => count + 1 + commentTotal(node.replies ?? []), 0);
}

export default function PostCard({ post, viewerId, prioritizeImage = false }: { post: HomePost; viewerId: string | null; prioritizeImage?: boolean }) {
  const router = useRouter();
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewed = useRef(false);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(post.durationSeconds ?? 0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [previewEnded, setPreviewEnded] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const [burstIteration, setBurstIteration] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const isMe = !!viewerId && viewerId === post.ownerId;
  const canFollow = !!viewerId && !!post.ownerId && !isMe;

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikes(post.likes);
  }, [post.id, post.likedByMe, post.likes]);

  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    checkMediaBookmarked(post.id).then(value => { if (!cancelled) setBookmarked(value); }).catch(() => {});
    if (canFollow && post.ownerId) {
      checkIsFollowing(post.ownerId).then(value => { if (!cancelled) setFollowing(value); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [post.id, post.ownerId, viewerId, canFollow]);

  useEffect(() => {
    const target = mediaRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      const active = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.58);
      setVisible(active);
      if (active && !viewed.current) {
        viewed.current = true;
        registerView(post.id).catch(() => {});
      }
    }, { threshold: [0, 0.58, 0.8] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [post.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // The Home feed can contain many posts. Only the visible video should
    // hold a media URL and decoder buffers on mobile.
    if (!visible) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      setPlaying(false);
      return;
    }

    if (!previewEnded) void video.play().catch(() => {});
    else video.pause();
  }, [visible, previewEnded]);

  useEffect(() => () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  const triggerBurst = () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
    setBurstIteration(iteration => iteration + 1);
    setBurst(true);
    burstTimer.current = setTimeout(() => setBurst(false), 740);
  };

  const toggleLike = async (forceLike = false) => {
    if (!viewerId) { router.push("/auth/login"); return; }
    if (busy || (forceLike && liked)) {
      if (forceLike && liked) triggerBurst();
      return;
    }
    const next = forceLike ? true : !liked;
    setLiked(next);
    setLikes(count => Math.max(0, count + (next ? 1 : -1)));
    if (next) triggerBurst();
    setBusy(true);
    try {
      const result = await toggleMediaLike(post.id);
      setLiked(result.liked);
      if (result.liked !== next) setLikes(count => Math.max(0, count + (result.liked ? 1 : -1)));
    } catch {
      setLiked(!next);
      setLikes(count => Math.max(0, count + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video || previewEnded) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };
  const clickVideo = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(toggleVideoPlayback, 220);
  };
  const doubleClickVideo = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = null;
    void toggleLike(true);
  };
  const timeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : post.durationSeconds ?? 0;
    // Count down the ORIGINAL video time, even though the Home preview ends at 30s.
    setPlayedSeconds(Math.min(30, current));
    if (duration > 30 && current >= 30) {
      video.currentTime = 30;
      video.pause();
      setPreviewEnded(true);
    }
  };

  const toggleBookmark = async () => {
    if (!viewerId) { router.push("/auth/login"); return; }
    if (bookmarkBusy) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkBusy(true);
    try {
      setBookmarked(await toggleMediaBookmark(post.id));
    } catch {
      setBookmarked(!next);
    } finally {
      setBookmarkBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!post.ownerId) return;
    if (!viewerId) { router.push("/auth/login"); return; }
    if (followBusy) return;
    setFollowBusy(true);
    try {
      const result = await toggleFollowUser(post.ownerId);
      setFollowing(result.following);
    } catch {} finally { setFollowBusy(false); }
  };

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError("");
    try {
      setComments(await fetchCommentsForMedia(post.id));
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Could not load comments.");
    } finally { setCommentsLoading(false); }
  }, [post.id]);

  useEffect(() => {
    if (commentsOpen) void loadComments();
  }, [commentsOpen, loadComments]);

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!viewerId) { router.push("/auth/login"); return; }
    if (!commentDraft.trim() || commentBusy) return;
    setCommentBusy(true);
    setCommentsError("");
    try {
      const result = await addCommentForMedia({ mediaId: post.id, text: commentDraft.trim(), parentId: replyTo?.id ?? null });
      setComments(result);
      setCommentDraft("");
      setReplyTo(null);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Could not post comment.");
    } finally { setCommentBusy(false); }
  };

  const likeComment = async (commentId: string) => {
    if (!viewerId) { router.push("/auth/login"); return; }
    try {
      setComments(await toggleCommentLikeForMedia(post.id, commentId));
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Could not like comment.");
    }
  };

  const originalRemaining = videoDuration > 0
    ? remainingTime(Math.max(0, videoDuration - playedSeconds))
    : "—:—";

  return <article className="w-full border-b border-white/10 pb-5 pt-3 text-white sm:pb-6 [content-visibility:auto] [contain-intrinsic-size:auto_720px]">
    {post.type === "image" && <header className="flex h-[57px] items-center gap-3 px-1">
      <a href={"/" + encodeURIComponent(post.username)} className="shrink-0 rounded-full bg-gradient-to-tr from-amber-400 p-[2px]">
        <Image unoptimized src={post.avatar} width={40} height={40} alt={post.username} className="h-10 w-10 rounded-full border-2 border-[#0b0d10] object-cover" />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <a href={"/" + encodeURIComponent(post.username)} className="truncate font-semibold hover:opacity-80">{post.username}</a>
          {post.verified && <span aria-label="Verified" className="text-sky-400"><Check size={14}/></span>}
          <span className="text-white/35">·</span><time className="shrink-0 text-white/50" dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
        </div>
      </div>
      {canFollow && !following && <button type="button" onClick={toggleFollow} disabled={followBusy} className="pr-2 text-xs font-semibold text-[#8ea4ff] hover:text-white">{followBusy ? "..." : "Follow"}</button>}
    </header>}

    <div ref={mediaRef} className={`relative flex aspect-[4/5] max-h-[650px] w-full items-center justify-center overflow-hidden rounded-md ${post.type === "image" ? "mt-2 bg-[#090a0c]" : "bg-black"}`} onDoubleClick={doubleClickVideo}>
      {post.type === "video" ?
        <video ref={videoRef} src={visible ? post.src : undefined} poster={post.poster || undefined} loop playsInline muted={muted} preload={visible ? "metadata" : "none"}
          onLoadedMetadata={event => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) setVideoDuration(duration);
          }}
          onTimeUpdate={timeUpdate}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onClick={clickVideo}
          className="absolute inset-0 h-full w-full cursor-pointer object-cover" aria-label={post.title || "Video post"} /> :
        <Image src={post.src} alt={post.title || "Image post"} fill sizes="(max-width: 640px) 100vw, 520px" priority={prioritizeImage} className="object-contain" />}
      {post.type === "video" && <>
        {/* Creator information and original runtime sit ON the video, not outside it. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/65 via-black/20 to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="pointer-events-auto flex min-w-0 items-center gap-2.5">
            <a href={`/${encodeURIComponent(post.username)}`} aria-label={`Open ${post.username}'s profile`}
              className="shrink-0 rounded-full border border-white/50 bg-black/25 p-[2px]">
              <Image unoptimized src={post.avatar} width={36} height={36} alt={post.username}
                className="h-9 w-9 rounded-full object-cover" />
            </a>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-white drop-shadow-md sm:text-[13px]">
                <a href={`/${encodeURIComponent(post.username)}`} className="truncate hover:underline">{post.username}</a>
                {post.verified && <span aria-label="Verified creator" className="shrink-0 text-sky-300"><Check size={14}/></span>}
              </div>
              <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}
                className="mt-0.5 block text-[11px] text-white/80 drop-shadow-md">
                {timeAgo(post.createdAt)}
              </time>
            </div>
            {canFollow && !following && <button type="button" onClick={toggleFollow}
              disabled={followBusy}
              className="ml-0.5 shrink-0 rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-white/25 disabled:opacity-60">
              {followBusy ? "..." : "Follow"}
            </button>}
          </div>
          <div className="shrink-0 rounded-md bg-black/45 px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-white backdrop-blur-sm"
            aria-label={`Original video time remaining: ${originalRemaining}`}
            title="Time remaining in original video">
            {originalRemaining}
          </div>
        </div>
        {!previewEnded && <button type="button" onClick={toggleVideoPlayback}
          className="absolute bottom-4 left-4 z-20 rounded-full bg-black/55 p-2.5 text-white/90 backdrop-blur-sm transition hover:scale-105"
          aria-label={playing ? "Pause video" : "Play video"}>
          {playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}
        </button>}
        <button type="button" onClick={() => setMuted(value => !value)} className="absolute bottom-4 right-4 z-20 rounded-full bg-black/65 p-2.5 text-white backdrop-blur-sm" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
        </button>
      </>}
      {previewEnded && post.type === "video" && videoDuration > 30 && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/75 px-5 text-center backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-white">Keep watching</h3>
        <a href={`/watch/${post.id}?s=30`} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
          Watch full video <ArrowUpRight size={18}/>
        </a>
      </div>}
      {burst && <div key={burstIteration} className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden="true">
        <div className="goon-heart-halo" />
        <Heart className="goon-feed-heart-burst h-32 w-32 fill-white text-white drop-shadow-[0_10px_32px_rgba(0,0,0,.5)]" strokeWidth={1.6}/>
        {Array.from({ length: 10 }, (_, i) => <Heart
          key={i} size={i % 3 === 0 ? 20 : 14}
          fill={i % 2 === 0 ? "#ff3c78" : "#fff"}
          stroke="none"
          className="goon-heart-particle absolute"
          style={{ "--particle-index": i, "--particle-angle": `${i * 36}deg`, "--particle-distance": `${90 + (i % 3) * 22}px` } as React.CSSProperties}
        />)}
      </div>}
    </div>

    <div className="flex items-center gap-4 px-1 pt-3">
      <button type="button" aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked} disabled={busy} onClick={() => void toggleLike()} className="transition-transform duration-200 hover:scale-110 active:scale-90">
        <Heart size={26} strokeWidth={1.9} className={liked ? "fill-[#ff325a] text-[#ff325a] goon-feed-liked" : "text-white"}/>
      </button>
      <button type="button" aria-label="Comments" onClick={() => setCommentsOpen(true)} className="transition-transform hover:scale-110 active:scale-90"><MessageCircle size={26} strokeWidth={1.9}/></button>
      <button type="button" aria-label="Share and post options" onClick={() => setOptionsOpen(true)} className="transition-transform hover:scale-110 active:scale-90"><Send size={25} strokeWidth={1.9}/></button>
      {post.type === "video" && (
        <a href={`/watch/${post.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-[12px] font-semibold text-white transition hover:bg-white/20" aria-label="Watch full video">
          Watch full video <ArrowUpRight size={15} aria-hidden="true"/>
        </a>
      )}
      <div className="flex-1"/>
      <button type="button" aria-label={bookmarked ? "Remove bookmark" : "Bookmark"} aria-pressed={bookmarked} disabled={bookmarkBusy} onClick={() => void toggleBookmark()} className="transition-transform hover:scale-110 active:scale-90">
        <Bookmark size={26} strokeWidth={1.9} className={bookmarked ? "fill-white" : ""}/>
      </button>
    </div>
    <div className="flex items-center gap-4 px-1 pt-2 text-[13px]">
      <span className="font-semibold">{compact(likes)} {likes === 1 ? "like" : "likes"}</span>
      <span className="inline-flex items-center gap-1.5 text-white/50"><Eye size={15}/> {compact(post.views)} views</span>
    </div>
    {(post.description || post.title) && <p className="px-1 pt-1 text-[13px] leading-5 text-white/90">
      <a href={"/" + encodeURIComponent(post.username)} className="mr-2 font-semibold">{post.username}</a>
      {post.description || post.title}
    </p>}
    {post.hashtags.length > 0 && <div className="px-1 pt-1 text-[13px] text-[#8da8d2]">{post.hashtags.slice(0,8).map((tag,index) => {
      const label = tag.replace(/^#/, "").trim();
      return <a key={tag + index} href={`/explore/niches/${encodeURIComponent(label.toLowerCase().replace(/\s+/g, "-"))}`} className="mr-2 inline-block transition hover:text-white">#{label}</a>;
    })}</div>}
    <button type="button" onClick={() => setCommentsOpen(true)} className="px-1 pt-2 text-left text-[13px] text-white/50">View comments</button>
    <button type="button" onClick={() => setCommentsOpen(true)} className="block px-1 pt-2 text-left text-[12px] text-white/40">Add a comment...</button>

    <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
      <DialogContent showCloseButton={false} className="flex max-h-[88dvh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111216] p-0 text-white shadow-[0_30px_100px_rgba(0,0,0,.7)] data-[state=open]:duration-300">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <DialogTitle className="text-center text-sm font-semibold">Comments {comments.length>0 ? "(" + commentTotal(comments) + ")" : ""}</DialogTitle>
          <button type="button" onClick={() => setCommentsOpen(false)} aria-label="Close comments"><X size={22}/></button>
        </div>
        <div className="min-h-40 flex-1 space-y-5 overflow-y-auto p-5">
          {commentsLoading ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin"/></div> : comments.length===0 ? <p className="py-12 text-center text-sm text-white/50">No comments yet. Start the conversation.</p> :
            comments.map(comment => <div key={comment.id} className="flex gap-3 text-[13px]">
              <Image unoptimized src={comment.avatar_path || "/avatar-placeholder.png"} width={32} height={32} alt="" className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <span className="mr-2 font-semibold">{comment.username}</span><span className="break-words text-white/85">{comment.comment}</span>
                <div className="mt-1.5 flex items-center gap-4 text-[11px] text-white/50">
                  <button type="button" onClick={() => setReplyTo({ id: comment.id, username: comment.username })} className="font-semibold hover:text-white">Reply</button>
                  <button type="button" onClick={() => void likeComment(comment.id)} className="flex items-center gap-1 hover:text-white" aria-label="Like comment">
                    <Heart size={13} className={viewerId && comment.liked_by?.includes(viewerId) ? "fill-pink-500 text-pink-500" : ""}/>
                    {comment.likes ? comment.likes : ""}
                  </button>
                </div>
                {comment.replies?.map(reply=><div key={reply.id} className="mt-3 border-l border-white/15 pl-3 text-xs">
                  <span className="mr-2 font-semibold">{reply.username}</span>{reply.comment}
                  <button type="button" onClick={() => void likeComment(reply.id)} className="ml-3 text-white/45 hover:text-white" aria-label="Like reply"><Heart size={12}/></button>
                </div>)}
              </div>
            </div>)
          }
        </div>
        {commentsError && <p className="px-5 pb-2 text-xs text-rose-400">{commentsError}</p>}
        {replyTo && <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-white/60">
          <span>Replying to @{replyTo.username}</span>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={15}/></button>
        </div>}
        <form onSubmit={submitComment} className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <input value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} maxLength={5000} placeholder="Add a comment..." aria-label="Add a comment" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"/>
          <button type="submit" disabled={commentBusy || !commentDraft.trim()} className="text-sm font-semibold text-[#8da8ff] disabled:opacity-40">{commentBusy ? "Posting..." : "Post"}</button>
        </form>
      </DialogContent>
    </Dialog>

    <VideoOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} mediaId={post.id} videoUrl={post.src} sharePath={post.type === "video" ? `/watch/${post.id}` : "/explore/images"} allowEmbed={post.type === "video"} allowDownload={post.type !== "video"}/>
  </article>;
}
