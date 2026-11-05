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

function commentTotal(comments: CommentNode[]): number {
  return comments.reduce((count, node) => count + 1 + commentTotal(node.replies ?? []), 0);
}

export default function PostCard({ post, viewerId }: { post: HomePost; viewerId: string | null }) {
  const router = useRouter();
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewed = useRef(false);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
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
    if (visible && !previewEnded) video.play().catch(() => {});
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
    if (video.duration > 30 && video.currentTime >= 30) {
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

  return <article className="w-full border-b border-white/10 pb-5 pt-3 text-white sm:pb-6">
    <header className="flex h-[57px] items-center gap-3 px-1">
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
    </header>

    <div ref={mediaRef} className="relative mt-2 flex aspect-[4/5] max-h-[650px] w-full items-center justify-center overflow-hidden rounded-md border border-white/[0.06] bg-[#090a0c]" onDoubleClick={doubleClickVideo}>
      {post.type === "video" ?
        <video ref={videoRef} src={post.src} loop playsInline muted={muted} preload="metadata"
          onLoadedMetadata={event => setVideoDuration(event.currentTarget.duration)}
          onTimeUpdate={timeUpdate}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onClick={clickVideo}
          className="h-full w-full cursor-pointer object-contain" aria-label={post.title || "Video post"} /> :
        <Image unoptimized src={post.src} alt={post.title || "Image post"} fill sizes="(max-width: 640px) 100vw, 520px" className="object-contain" />}
      {post.type === "video" && <>
        {!previewEnded && <button type="button" onClick={toggleVideoPlayback}
          className="absolute left-4 top-4 rounded-full bg-black/55 p-2.5 text-white/90 backdrop-blur-sm transition hover:scale-105"
          aria-label={playing ? "Pause video" : "Play video"}>
          {playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}
        </button>}
        <button type="button" onClick={() => setMuted(value => !value)} className="absolute bottom-4 right-4 rounded-full bg-black/65 p-2.5 text-white backdrop-blur-sm" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}
        </button>
      </>}
      {previewEnded && post.type === "video" && videoDuration > 30 && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/75 px-5 text-center backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-[.16em] text-white/60">Preview complete</span>
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

    <VideoOptionsModal open={optionsOpen} onClose={() => setOptionsOpen(false)} mediaId={post.id} videoUrl={post.src} sharePath={post.type === "video" ? `/watch/${post.id}` : "/explore/images"} allowEmbed={post.type === "video"}/>
  </article>;
}
