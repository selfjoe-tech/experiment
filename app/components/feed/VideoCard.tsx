"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import {
  Eye,
  Heart,
  Maximize2,
  Play,
  Volume2,
  VolumeX,
  Loader2,
  EllipsisIcon,
  MessageCircle,
  Send,
  SendHorizonal,
  ArrowUpRight,
  ArrowUpRightFromSquare,
  X,
  MoveLeft,
  ChevronLeftIcon,
} from "lucide-react";
import type { Video } from "./types";
import {
  checkIsFollowing,
  toggleFollowUser,
  checkHasLikedMedia,
  toggleMediaLike,
  checkHasLikedAd,      // 👈 add
  toggleAdLike,
} from "@/lib/actions/social";
import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";
import { getUserIdFromCookies } from "@/lib/actions/auth";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  fetchCommentsForMedia,
  addCommentForMedia,
  toggleCommentLikeForMedia,
  type CommentNode,
} from "@/lib/actions/comments";
import { VerifiedBadgeIcon } from "../icons/VerifiedBadgeIcon";
import { CommentListSkeleton } from "../skeletons/CommentListSkeleton";

type Props = {
  video: Video;
  onRequestFullscreen?: () => void;
  /** hide when used inside the fullscreen overlay feed */
  showFullscreenButton?: boolean;
  isMuted?: boolean;
  toggleMute?: () => void;

  // NEW:
  variant?: "default" | "sponsored";
  visitUrl?: string; // for "Visit page" button
  onClose?: () => void;
  open?: boolean;

};

export default function VideoCard({
  video,
  onRequestFullscreen,
  showFullscreenButton = true,
  isMuted,
  toggleMute,
  variant = "default",
  visitUrl,
  open,
  onClose,

}: Props) {
  const isSponsored = variant === "sponsored";

  const anyVideo = video as any;
const adIdNum =
  isSponsored && typeof anyVideo._adId === "number"
    ? anyVideo._adId
    : null;

// Only use mediaId for non-ads
const mediaIdNum = !isSponsored
  ? Number(video.mediaId ?? video.id)
  : NaN;


  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasRequestedSourceRef = useRef(false);
  const clickTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  // FOLLOW STATE
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // LIKE STATE
  const [likes, setLikes] = useState(video.likes);
  const [liked, setLiked] = useState(!!video.likedByMe);
  const [likeLoading, setLikeLoading] = useState(false);

  // VIDEO PROGRESS
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // OTHER UI
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [likeBurstVisible, setLikeBurstVisible] = useState(false);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const [isVertical, setIsVertical] = useState<boolean | null>(null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [currentId, setCurrentId] = useState("");

  // ===== COMMENTS STATE =====
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showLikeAuthTooltip, setShowLikeAuthTooltip] = useState(false);
  const isLoggedIn = !!currentId;



  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalComments = countComments(comments);

  // ===== HEART BURST ANIMATION =====

  const triggerLikeBurst = () => {
    if (likeBurstTimeoutRef.current !== null) {
      window.clearTimeout(likeBurstTimeoutRef.current);
    }
    setLikeBurstVisible(true);
    likeBurstTimeoutRef.current = window.setTimeout(() => {
      setLikeBurstVisible(false);
      likeBurstTimeoutRef.current = null;
    }, 550);
  };

  useEffect(() => {
    return () => {
      if (likeBurstTimeoutRef.current !== null) {
        window.clearTimeout(likeBurstTimeoutRef.current);
      }
    };
  }, []);

  // ===== INTERSECTION OBSERVER (auto load & play) =====

  useEffect(() => {
    const target = cardRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const mostlyVisible =
            entry.isIntersecting && entry.intersectionRatio >= 0.65;
          setIsInViewport(mostlyVisible);

          if (
            (entry.isIntersecting || entry.intersectionRatio > 0.25) &&
            !hasRequestedSourceRef.current
          ) {
            hasRequestedSourceRef.current = true;
            setShouldLoad(true);
          }
        });
      },
      { threshold: [0.25, 0.65, 0.85] }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // keep muted state in sync
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !shouldLoad) return;
    el.muted = isMuted;
  }, [isMuted, shouldLoad]);

  // auto play / reset on visibility change
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !shouldLoad) return;

    if (isInViewport) {
      el.currentTime = 0;
      const maybePlay = el.play();
      if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
    } else {
      el.pause();
      el.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    }
  }, [isInViewport, shouldLoad]);

  // ===== FOLLOW: initial state =====

  useEffect(() => {
    let cancelled = false;
    if (!video.ownerId) return;

    (async () => {
      try {
        setFollowLoading(true);
        const following = await checkIsFollowing(video.ownerId);
        if (!cancelled) {
          setIsFollowing(following);
        }
      } catch (err) {
        console.error("checkIsFollowing error", err);
      } finally {
        if (!cancelled) setFollowLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [video.ownerId]);

  const handleFollowClick = async () => {
    if (!video.ownerId) return;
    setFollowLoading(true);
    try {
      const res = await toggleFollowUser(video.ownerId);
      setIsFollowing(res.following);
    } catch (err) {
      console.error("toggleFollowUser error", err);
    } finally {
      setFollowLoading(false);
    }
  };

  // ===== LIKE: initial state (if backend didn't supply likedByMe) =====

  useEffect(() => {
  let cancelled = false;

  // If server already told us, trust it
  if (video.likedByMe !== undefined) {
    setLiked(!!video.likedByMe);
    return;
  }

  // Ads: use adId
  if (isSponsored) {
    if (!adIdNum) return;

    (async () => {
      try {
        const hasLiked = await checkHasLikedAd(adIdNum);
        if (!cancelled) setLiked(hasLiked);
      } catch (err) {
        console.error("checkHasLikedAd error", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }

  // Normal media
  if (!mediaIdNum || Number.isNaN(mediaIdNum)) return;

  (async () => {
    try {
      const hasLiked = await checkHasLikedMedia(mediaIdNum);
      if (!cancelled) setLiked(hasLiked);
    } catch (err) {
      console.error("checkHasLikedMedia error", err);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [mediaIdNum, adIdNum, isSponsored, video.likedByMe]);


  // ===== VIDEO EVENTS =====

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      const maybePlay = el.play();
      if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  };

  const handlePlay = () => setIsPlaying(true);

  const handlePause = () => {
    setIsPlaying(false);
    if (videoRef.current?.currentTime === 0) {
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.duration) setDuration(el.duration);
    setMetadataLoaded(true);
    const { videoWidth, videoHeight } = el;
    setIsVertical(videoHeight > videoWidth);
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const cur = el.currentTime;
    const dur = el.duration;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress((cur / dur) * 100);
  };

  const handleSeek = (value: number) => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const newTime = (value / 100) * el.duration;
    el.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(value);
  };

  // ===== LIKE TOGGLE (with backend) =====

  const handleToggleLike = async () => {
  // 🔐 gate likes if not logged in
  if (!isLoggedIn) {
    setShowLikeAuthTooltip(true);
    return;
  }

  // ADS
  if (isSponsored) {
    if (!adIdNum) return;

    const nextLiked = !liked;
    setLikeLoading(true);
    setLiked(nextLiked);
    setLikes((prevLikes) =>
      nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
    );
    if (nextLiked) triggerLikeBurst();

    try {
      const result = await toggleAdLike(adIdNum);

      // If backend disagrees, reconcile
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
      }
      if (result.likeCount != null) {
        setLikes(result.likeCount);
      }
    } catch (err) {
      console.error("toggleAdLike error", err);
      // roll back optimistic UI
      setLiked(!nextLiked);
      setLikes((prevLikes) =>
        !nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
      );
    } finally {
      setLikeLoading(false);
    }

    return;
  }

  // NORMAL MEDIA (your existing logic)
  if (!mediaIdNum || Number.isNaN(mediaIdNum)) {
    setLiked((prev) => !prev);
    return;
  }

  const nextLiked = !liked;
  setLikeLoading(true);
  setLiked(nextLiked);
  setLikes((prevLikes) =>
    nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
  );
  if (nextLiked) triggerLikeBurst();

  try {
    const result = await toggleMediaLike(mediaIdNum);
    if (result.liked !== nextLiked) {
      setLiked(result.liked);
      setLikes((prevLikes) =>
        result.liked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
      );
    }
  } catch (err) {
    console.error("toggleMediaLike error", err);
    setLiked(!nextLiked);
    setLikes((prevLikes) =>
      !nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
    );
  } finally {
    setLikeLoading(false);
  }
};


  const handleDoubleLike = () => {
    handleToggleLike();
  };

  // single vs double click on video
  const handleOverlayClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      handleDoubleLike();
      return;
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      togglePlay();
      clickTimeoutRef.current = null;
    }, 250);
  };

  // current user id for follow button visibility
  useEffect(() => {
    (async () => {
      const id = await getUserIdFromCookies();
      setCurrentId(id);
    })();
  }, []);

  // detect desktop vs mobile (for dialog vs drawer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // load comments when opening
  useEffect(() => {
    if (!commentsOpen || !mediaIdNum) return;
    setCommentsLoading(true);
    setCommentsError(null);

    (async () => {
      try {
        const data = await fetchCommentsForMedia(mediaIdNum);
        setComments(data);
      } catch (err: any) {
        console.error("fetchCommentsForMedia error", err);
        setCommentsError("Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [commentsOpen, mediaIdNum]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mediaIdNum || !newComment.trim()) return;
    try {
      const updated = await addCommentForMedia({
        mediaId: mediaIdNum,
        text: newComment,
        parentId: replyTo?.id ?? null,
      });
      setComments(updated);
      setNewComment("");
      setReplyTo(null);
    } catch (err: any) {
      console.error("addCommentForMedia error", err);
      setCommentsError(err?.message ?? "Failed to post comment.");
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!mediaIdNum) return;
    try {
      const updated = await toggleCommentLikeForMedia(mediaIdNum, commentId);
      setComments(updated);
    } catch (err: any) {
      console.error("toggleCommentLikeForMedia error", err);
      setCommentsError("Failed to like comment.");
    }
  };

  const showSkeleton = shouldLoad && !metadataLoaded;


  function labelToSlug (label: string): string {
    const decoded = decodeURIComponent(label).trim();
    return decoded
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toLowerCase() + word.slice(1).toLowerCase())
      .join("-");

  
}

  useEffect(() => {
  if (!showLikeAuthTooltip) return;

  const t = window.setTimeout(() => {
    setShowLikeAuthTooltip(false);
  }, 2000); // 2s, tweak if you like

  return () => window.clearTimeout(t);
}, [showLikeAuthTooltip]);

  return (
    <div
      ref={cardRef}
      className={`
        relative lg:h-[100vh]
        ${open ? "h-[100vh]" : "h-[80vh]"}
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      `}
    >
      <div className="relative h-full flex items-center">
        {/* Skeleton layer */}
        {showSkeleton && (
          <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
        )}

        <video
          ref={videoRef}
          src={shouldLoad ? video.src : undefined}
          preload={shouldLoad ? "metadata" : "none"}
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          className={`
            max-h-full max-w-full
            ${isVertical ? "h-full w-auto" : "w-full h-auto"}
            object-contain
            transition-opacity duration-300
            ${metadataLoaded ? "opacity-100" : "opacity-0"}
          `}
          loop
          playsInline
        />
      </div>

      {/* ❤️ LIKE BURST OVERLAY */}
      {likeBurstVisible && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 like-burst drop-shadow-[0_0_18px_rgba(248,113,113,1)]" />
        </div>
      )}

      {/* single-click play / pause, double-click like */}
      <button
        type="button"
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
      >
        {!isPlaying && (
          <div className="rounded-full bg-black/60 border border-white/60 p-4 text-white">
            <Play className="h-8 w-8" />
          </div>
        )}
      </button>

      <div className="absolute flex left-3 top-12 z-30 flex-col items-center">
        {open && 
          <button
            onClick={() => {
              onClose();
              
            }}
          >
            <ChevronLeftIcon size={30}/>
          </button>
        }
        
      </div>

      {/* right-side actions */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
        <StatBubble label={video.views.toLocaleString()}>
          <Eye className="h-7 w-7" />
        </StatBubble>

        {showFullscreenButton && (
          <div className="hidden lg:block">
            <IconCircleButton
              onClick={() => {
                onRequestFullscreen?.();
                const el = videoRef.current;
                if (!el) return;
                if (!el.paused) {
                  el.pause();
                }
              }}
              label="Full screen"
              className="hidden lg:flex"
            >
              <Maximize2 className="h-7 w-7" />
            </IconCircleButton>
          </div>
        )}

        <IconCircleButton onClick={toggleMute!} label="Mute / unmute">
          {isMuted ? (
            <VolumeX className="h-7 w-7" />
          ) : (
            <Volume2 className="h-7 w-7" />
          )}
        </IconCircleButton>

        {/* LIKE BUTTON */}
        {!isSponsored && (
          <div className="flex flex-col items-center gap-1 relative">
            <IconCircleButton
              onClick={handleToggleLike}
              label="Like"
              disabled={likeLoading}
            >
              <Heart
                className={`h-7 w-7 ${
                  liked ? "fill-red-500 text-red-500" : ""
                }`}
              />
            </IconCircleButton>

            <span className="text-[11px]">
              {likes?.toLocaleString() || 0}
            </span>


            {showLikeAuthTooltip && (
              <div
                className="
                  absolute -top-8
                  max-w-[160px]
                  rounded-full
                  bg-black/90
                  px-3 py-1
                  text-[10px]
                  text-center
                  text-white
                  border border-white/20
                  shadow-lg
                "
              >
                Log in to like videos
              </div>
            )}
    </div>
        )
        
        }
        

        {/* COMMENTS BUTTON */}

         {!isSponsored && (
        <div className="flex flex-col items-center gap-1">
          <IconCircleButton
            onClick={() => setCommentsOpen(true)}
            label="Comments"
          >
            <MessageCircle className="h-7 w-7" />
          </IconCircleButton>
          <span className="text-[11px]">
            {totalComments.toLocaleString()}
          </span>
        </div>
      )}

        {/* MORE OPTIONS */}
        {!isSponsored && (
          <IconCircleButton
            onClick={() => setOptionsOpen(true)}
            label="More options"
          >
            <EllipsisIcon className="h-7 w-7" />
          </IconCircleButton>
        )}
      </div>

      {/* bottom info + scrubber */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
        {/* creator row */}
        <div className="flex items-center gap-3">
          <Link href={`/${video.username}`}>
            <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
              <Image
                src={video.avatar ?? "/avatar-placeholder.png"}
                alt={video.username || `Upskirt Candy Image by ${video.username}`}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </Link>

           

          <Link href={`/${video.username}`}>
            <div className="flex gap-2 min-w-0">
              <div className="text-sm font-semibold truncate text-white">
                {video.username}
              </div>
              {isSponsored && <VerifiedBadgeIcon />}
              {video.verified && <VerifiedBadgeIcon />}
            </div>
          </Link>

          {video.ownerId !== currentId && (
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={followLoading}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                isFollowing
                  ? "bg-white text-black border-transparent"
                  : "border-white/60 bg-black/50 text-white"
              }`}
            >
              {followLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isFollowing ? (
                "Following"
              ) : (
                "Follow"
              )}
            </button>
          )}
        </div>
{isSponsored && (
              <span className="inline-flex items-center rounded-full border border-yellow-400/60 bg-yellow-400/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-300">
                Sponsored
              </span>
            )}
        {/* description */}
        <div className="text-xs text-white/85">
          <p
            className={`overflow-hidden transition-all ${
              expandedDesc ? "max-h-24" : "max-h-5"
            }`}
          >
            {video.description}{" "}
            {video.hashtags?.map((tag, index) => (
              <Link
                href={`/explore/niches/${labelToSlug(tag)}`}
                key={index}
              >
                <span key={tag} className="text-pink-500 underline">
                  #{tag}{" "}
                </span>
              </Link>
              
            ))}
          </p>
          <button
            type="button"
            onClick={() => setExpandedDesc((p) => !p)}
            className="mt-0.5 text-[11px] text-white/70"
          >
            Show {expandedDesc ? "less" : "more"}
          </button>

          
        </div>
        {isSponsored && visitUrl && (
            <button
              type="button"
              onClick={() => window.open(visitUrl, "_blank")}
              className="gap-2 items-center mt-3 inline-flex bg-pink-500 w-full h-10 items-center justify-center rounded-full text-white px-4 py-1.5 text-[20px] font-semibold hover:bg-white/90 hover:text-black"
            >
              Visit Page
          <ArrowUpRightFromSquare size={20} />
            </button>
          )}

        {/* scrubber */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="
              w-full h-1 rounded-full
              cursor-pointer
              appearance-none
              bg-pink-500/40
              accent-pink-500
            "
          />
          <span className="text-[11px] tabular-nums min-w-[70px] text-right">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* gradients */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-pink/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-pink/60 to-transparent" />

      {!isSponsored && (
        <VideoOptionsModal
          open={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          mediaId={mediaIdNum || video.id}
        />
      )}

      {/* COMMENTS OVERLAY: drawer on mobile, dialog on desktop */}
      <CommentsOverlay
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        isDesktop={isDesktop}
        comments={comments}
        loading={commentsLoading}
        error={commentsError}
        newComment={newComment}
        setNewComment={setNewComment}
        onSubmit={handleSubmitComment}
        onLikeComment={handleToggleCommentLike}
        onReplyStart={(c) =>
          setReplyTo({ id: c.id, username: c.username })
        }
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
    </div>
  );
}

type IconCircleButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

function IconCircleButton({
  children,
  onClick,
  label,
  className,
  disabled,
}: IconCircleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80 disabled:opacity-50 ${
        className || ""
      }`}
    >
      {children}
    </button>
  );
}

function StatBubble({
  label,
  children,
}: {
  label: string | number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
        {children}
      </div>
      <span className="mt-1 text-[11px]">
        {typeof label === "number" ? label.toLocaleString() : label}
      </span>
    </div>
  );
}

/* ========= COMMENTS UI HELPERS ========= */

function countComments(nodes: CommentNode[]): number {
  return nodes.reduce(
    (sum, c) => sum + 1 + countComments(c.replies ?? []),
    0
  );
}

type CommentsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  comments: CommentNode[];
  loading: boolean;
  error: string | null;
  newComment: string;
  setNewComment: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onLikeComment: (id: string) => void;
  onReplyStart: (c: CommentNode) => void;
  replyTo: { id: string; username: string } | null;
};

function CommentsOverlay({
  open,
  onOpenChange,
  isDesktop,
  comments,
  loading,
  error,
  newComment,
  setNewComment,
  onSubmit,
  onLikeComment,
  onReplyStart,
  replyTo,
  setReplyTo
}: CommentsOverlayProps) {

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <CommentListSkeleton />
        )}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-white/60">No comments yet.</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <CommentList
          comments={comments}
          onLike={onLikeComment}
          onReply={onReplyStart}
        />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-white/10 px-4 py-3 space-y-2 bg-black"
      >
        {replyTo && (
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Replying to @{replyTo.username}</span>
            <button
              type="button"
              onClick={() => {onReplyStart({ ...replyTo, replies: [], avatar_path: "", comment: "", id: replyTo.id, likes: 0 } as CommentNode)
            
              setReplyTo(null)      }}
              className="hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="bg-black border-white/30 text-white placeholder:text-white/40 h-10 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 px-4 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90"

          >
            <SendHorizonal />
          </Button>
        </div>
      </form>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} >
        <DialogContent className="max-w-md w-full bg-black text-white border-white/10 z-[100]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Comments
            </DialogTitle>
          </DialogHeader>
          <div className="h-96">{content}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // mobile drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-black text-white border-t border-white/10 z-[100]">
        <DrawerHeader>
          <DrawerTitle className="text-sm font-semibold">
            Comments
          </DrawerTitle>
        </DrawerHeader>
        <div className="h-[60vh]">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}

function CommentList({
  comments,
  onLike,
  onReply,
  level = 0,
}: {
  comments: CommentNode[];
  onLike: (id: string) => void;
  onReply: (c: CommentNode) => void;
  level?: number;
}) {
  if (!comments || comments.length === 0) return null;

  return (
    <div className={level > 0 ? "pl-4 border-l border-white/10 space-y-2" : "space-y-2"}>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 text-xs">
          <div className="mt-1 h-7 w-7 rounded-full bg-white/10 overflow-hidden shrink-0">
            {c.avatar_path ? (
            <Link href={`/${c.username}`}>
              <Image
                src={c.avatar_path}
                alt={c.username}
                width={28}
                height={28}
                className="h-full w-full object-cover"
              />
            </Link>
            ) : null}
          </div>
          <div className="flex-1">
            <Link href={`/${c.username}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{c.username}</span>
              </div>
            </Link>
            
            <p className="mt-0.5 text-white/80">{c.comment}</p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
              <button
                type="button"
                onClick={() => onLike(c.id)}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                <Heart
                  className={`h-3 w-3 ${
                    c.liked_by && c.liked_by.length > 0
                      ? "fill-red-500 text-red-500"
                      : ""
                  }`}
                />
                <span>{(c.likes ?? 0).toLocaleString()}</span>
              </button>
              <button
                type="button"
                onClick={() => onReply(c)}
                className="hover:text-white"
              >
                Reply
              </button>
            </div>

            {c.replies && c.replies.length > 0 && (
              <CommentList
                comments={c.replies}
                onLike={onLike}
                onReply={onReply}
                level={level + 1}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SponsoredVideoCard(
  props: Omit<Props, "variant" | "showFullscreenButton"> & { visitUrl: string }
) {
  return (
    <VideoCard
      {...props}
      variant="sponsored"
      showFullscreenButton={false}
      visitUrl={props.visitUrl}
    />
  );
}



// "use client";

// import Image from "next/image";
// import Link from "next/link";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   Eye,
//   Heart,
//   Maximize2,
//   Play,
//   Volume2,
//   VolumeX,
//   Loader2,
//   EllipsisIcon,
  
// } from "lucide-react";
// import type { Video } from "./types";
// import {
//   checkIsFollowing,
//   toggleFollowUser,
//   checkHasLikedMedia,
//   toggleMediaLike,
// } from "@/lib/actions/social";
// import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";
// import { getUserIdFromCookies } from "@/lib/actions/auth";


// type Props = {
//   video: Video;
//   onRequestFullscreen?: () => void;
//   /** hide when used inside the fullscreen overlay feed */
//   showFullscreenButton?: boolean;
//   isMuted?: boolean;
//   toggleMute?: () => void;
// };

// export default function VideoCard({
//   video,
//   onRequestFullscreen,
//   showFullscreenButton = true,
//   isMuted,
//   toggleMute,
// }: Props) {
//   const cardRef = useRef<HTMLDivElement | null>(null);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const hasRequestedSourceRef = useRef(false);
//   const clickTimeoutRef = useRef<number | null>(null);

//   const [isPlaying, setIsPlaying] = useState(false);

//   // FOLLOW STATE
//   const [isFollowing, setIsFollowing] = useState(false);
//   const [followLoading, setFollowLoading] = useState(false);

//   // LIKE STATE
//   const [likes, setLikes] = useState(video.likes);
//   const [liked, setLiked] = useState(!!video.likedByMe);
//   const [likeLoading, setLikeLoading] = useState(false);

//   // VIDEO PROGRESS
//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [currentTime, setCurrentTime] = useState(0);

//   // OTHER UI
//   const [expandedDesc, setExpandedDesc] = useState(false);
//   const [isInViewport, setIsInViewport] = useState(false);
//   const [shouldLoad, setShouldLoad] = useState(false);
//   const [metadataLoaded, setMetadataLoaded] = useState(false);
//   const [likeBurstVisible, setLikeBurstVisible] = useState(false);
//   const likeBurstTimeoutRef = useRef<number | null>(null);
//   const [isVertical, setIsVertical] = useState<boolean | null>(null);

//   const mediaIdNum = Number(video.mediaId ?? video.id);
//   const [optionsOpen, setOptionsOpen] = useState(false);
//   const [currentId, setCurrentId] = useState("")


//   const formatTime = (seconds: number) => {
//     if (!Number.isFinite(seconds)) return "00:00";
//     const m = Math.floor(seconds / 60);
//     const s = Math.floor(seconds % 60);
//     return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
//   };

//   // ===== HEART BURST ANIMATION =====

//   const triggerLikeBurst = () => {
//     if (likeBurstTimeoutRef.current !== null) {
//       window.clearTimeout(likeBurstTimeoutRef.current);
//     }
//     setLikeBurstVisible(true);
//     likeBurstTimeoutRef.current = window.setTimeout(() => {
//       setLikeBurstVisible(false);
//       likeBurstTimeoutRef.current = null;
//     }, 550);
//   };

//   useEffect(() => {
//     return () => {
//       if (likeBurstTimeoutRef.current !== null) {
//         window.clearTimeout(likeBurstTimeoutRef.current);
//       }
//     };
//   }, []);

//   // ===== INTERSECTION OBSERVER (auto load & play) =====

//   useEffect(() => {
//     const target = cardRef.current;
//     if (!target) return;

//     const observer = new IntersectionObserver(
//       (entries) => {
//         entries.forEach((entry) => {
//           const mostlyVisible =
//             entry.isIntersecting && entry.intersectionRatio >= 0.65;
//           setIsInViewport(mostlyVisible);

//           if (
//             (entry.isIntersecting || entry.intersectionRatio > 0.25) &&
//             !hasRequestedSourceRef.current
//           ) {
//             hasRequestedSourceRef.current = true;
//             setShouldLoad(true);
//           }
//         });
//       },
//       { threshold: [0.25, 0.65, 0.85] }
//     );

//     observer.observe(target);
//     return () => observer.disconnect();
//   }, []);

//   // keep muted state in sync
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;
//     el.muted = isMuted;
//   }, [isMuted, shouldLoad]);

//   // auto play / reset on visibility change
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;

//     if (isInViewport) {
//       el.currentTime = 0;
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//       el.currentTime = 0;
//       setIsPlaying(false);
//       setCurrentTime(0);
//       setProgress(0);
//     }
//   }, [isInViewport, shouldLoad]);

//   // ===== FOLLOW: initial state =====

//   useEffect(() => {
//     let cancelled = false;
//     if (!video.ownerId) return;

//     (async () => {
//       try {
//         setFollowLoading(true);
//         const following = await checkIsFollowing(video.ownerId);
//         if (!cancelled) {
//           setIsFollowing(following);
//         }
//       } catch (err) {
//         console.error("checkIsFollowing error", err);
//       } finally {
//         if (!cancelled) setFollowLoading(false);
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [video.ownerId]);

//   const handleFollowClick = async () => {
//     if (!video.ownerId) return;
//     setFollowLoading(true);
//     try {
//       const res = await toggleFollowUser(video.ownerId);
//       setIsFollowing(res.following);
//     } catch (err) {
//       console.error("toggleFollowUser error", err);
//     } finally {
//       setFollowLoading(false);
//     }
//   };

//   // ===== LIKE: initial state (if backend didn't supply likedByMe) =====

//   useEffect(() => {
//     let cancelled = false;

//     // if feed already told us likedByMe, trust that
//     if (video.likedByMe !== undefined) {
//       setLiked(!!video.likedByMe);
//       return;
//     }

//     if (!mediaIdNum || Number.isNaN(mediaIdNum)) return;

//     (async () => {
//       try {
//         const hasLiked = await checkHasLikedMedia(mediaIdNum);
//         if (!cancelled) setLiked(hasLiked);
//       } catch (err) {
//         console.error("checkHasLikedMedia error", err);
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [mediaIdNum, video.likedByMe]);

//   // ===== VIDEO EVENTS =====

//   const togglePlay = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.paused) {
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//     }
//   };

//   const handlePlay = () => setIsPlaying(true);

//   const handlePause = () => {
//     setIsPlaying(false);
//     if (videoRef.current?.currentTime === 0) {
//       setProgress(0);
//       setCurrentTime(0);
//     }
//   };

//   const handleLoadedMetadata = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.duration) setDuration(el.duration);
//     setMetadataLoaded(true);
//     const { videoWidth, videoHeight } = el;
//     setIsVertical(videoHeight > videoWidth);
//   };

//   const handleTimeUpdate = () => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const cur = el.currentTime;
//     const dur = el.duration;
//     setCurrentTime(cur);
//     setDuration(dur);
//     setProgress((cur / dur) * 100);
//   };

//   const handleSeek = (value: number) => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const newTime = (value / 100) * el.duration;
//     el.currentTime = newTime;
//     setCurrentTime(newTime);
//     setProgress(value);
//   };

//   // ===== LIKE TOGGLE (with backend) =====

//   const handleToggleLike = async () => {
//     if (!mediaIdNum || Number.isNaN(mediaIdNum)) {
//       // If we somehow don't have a media id, just do local toggle
//       setLiked((prev) => !prev);
//       return;
//     }

//     // optimistic update
//     const nextLiked = !liked;
//     setLikeLoading(true);
//     setLiked(nextLiked);
//     setLikes((prevLikes) =>
//       nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//     );
//     if (nextLiked) triggerLikeBurst();

//     try {
//       const result = await toggleMediaLike(mediaIdNum);
//       // if backend disagrees, sync to it
//       if (result.liked !== nextLiked) {
//         setLiked(result.liked);
//         setLikes((prevLikes) =>
//           result.liked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//         );
//       }
//     } catch (err) {
//       console.error("toggleMediaLike error", err);
//       // revert
//       setLiked(!nextLiked);
//       setLikes((prevLikes) =>
//         !nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//       );
//     } finally {
//       setLikeLoading(false);
//     }
//   };

//   const handleDoubleLike = () => {
//     handleToggleLike();
//   };

//   // single vs double click on video
//   const handleOverlayClick = () => {
//     if (clickTimeoutRef.current !== null) {
//       window.clearTimeout(clickTimeoutRef.current);
//       clickTimeoutRef.current = null;
//       handleDoubleLike();
//       return;
//     }

//     clickTimeoutRef.current = window.setTimeout(() => {
//       togglePlay();
//       clickTimeoutRef.current = null;
//     }, 250);
//   };

//   useEffect(() => {
//     (async () =>{
//       const id = await getUserIdFromCookies()
//       setCurrentId(id)
//     })()
//   })

  

//   const showSkeleton = shouldLoad && !metadataLoaded;

//   return (
//     <div
//       ref={cardRef}
//       className="
//         relative lg:h-[100vh]
//         h-[80vh]
//         flex items-center justify-center
//         bg-neutral-900 shadow-5xl overflow-hidden
//       "
//     >
//       <div className="relative h-full flex items-center">
//         {/* Skeleton layer */}
//         {showSkeleton && (
//           <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
//         )}

//         <video
//           ref={videoRef}
//           src={shouldLoad ? video.src : undefined}
//           preload={shouldLoad ? "metadata" : "none"}
//           muted={isMuted}
//           onLoadedMetadata={handleLoadedMetadata}
//           onTimeUpdate={handleTimeUpdate}
//           onPlay={handlePlay}
//           onPause={handlePause}
//           className={`
//             max-h-full max-w-full
//             ${isVertical ? "h-full w-auto" : "w-full h-auto"}
//             object-contain
//             transition-opacity duration-300
//             ${metadataLoaded ? "opacity-100" : "opacity-0"}
//           `}
//           loop
//           playsInline
//         />
//       </div>

//       {/* ❤️ LIKE BURST OVERLAY */}
//       {likeBurstVisible && (
//         <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
//           <Heart className="h-24 w-24 text-red-500 fill-red-500 like-burst drop-shadow-[0_0_18px_rgba(248,113,113,1)]" />
//         </div>
//       )}

//       {/* single-click play / pause, double-click like */}
//       <button
//         type="button"
//         onClick={handleOverlayClick}
//         className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
//       >
//         {!isPlaying && (
//           <div className="rounded-full bg-black/60 border border-white/60 p-4 text-white">
//             <Play className="h-8 w-8" />
//           </div>
//         )}
//       </button>

//       {/* right-side actions */}
//       <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
//         <StatBubble label={video.views.toLocaleString()}>
//           <Eye className="h-7 w-7" />
//         </StatBubble>

//         {showFullscreenButton && (
//           <div className="hidden lg:block">
//             <IconCircleButton
//               onClick={() => {
//                 onRequestFullscreen?.();
//                 const el = videoRef.current;
//                 if (!el) return;
//                 if (!el.paused) {
//                   el.pause();
//                 }
//               }}
//               label="Full screen"
//               className="hidden lg:flex"
//             >
//               <Maximize2 className="h-7 w-7" />
//             </IconCircleButton>
//           </div>
//         )}

//         <IconCircleButton onClick={toggleMute!} label="Mute / unmute">
//           {isMuted ? (
//             <VolumeX className="h-7 w-7" />
//           ) : (
//             <Volume2 className="h-7 w-7" />
//           )}
//         </IconCircleButton>

        

//         <div className="flex flex-col items-center gap-1">
//           <IconCircleButton
//             onClick={handleToggleLike}
//             label="Like"
//             disabled={likeLoading}
//           >
//             <Heart
//               className={`h-7 w-7 ${
//                 liked ? "fill-red-500 text-red-500" : ""
//               }`}
//             />
//           </IconCircleButton>
//           <span className="text-[11px]">
//             {likes.toLocaleString()}
//           </span>
//         </div>

//         <IconCircleButton
//             onClick={() => setOptionsOpen(true)}
//             label="More options"
//         >
//           <EllipsisIcon className="h-7 w-7" />
//         </IconCircleButton>

//       </div>

//       {/* bottom info + scrubber */}
//       <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
//         {/* creator row */}
//         <div className="flex items-center gap-3">
//           <Link href={`/profile/${video.username}`}>
//             <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
//               <Image
//                 src={video.avatar ?? "/avatar-placeholder.png"}
//                 alt={video.username}
//                 width={40}
//                 height={40}
//                 className="h-full w-full object-cover"
//                 loading="lazy"
//               />
//             </div>
//           </Link>

//           <Link href={`/profile/${video.username}`}>
//             <div className="min-w-0">
//               <div className="text-sm font-semibold truncate">
//                 {video.username}
//               </div>
//             </div>
//           </Link>

//     {video.ownerId !== currentId &&   
//       <button
//             type="button"
//             onClick={() => handleFollowClick()}
//             disabled={followLoading}
//             className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
//               isFollowing
//                 ? "bg-white text-black border-transparent"
//                 : "border-white/60 bg-black/50 text-white"
//             }`}
//           >
//             {followLoading ? (
//               <Loader2 className="h-3.5 w-3.5 animate-spin" />
//             ) : isFollowing ? (
//               "Following"
//             ) : (
//               "Follow"
//             )}
//           </button>
    
//     }
          



//         </div>

//         {/* description */}
//         <div className="text-xs text-white/85">
//           <p
//             className={`overflow-hidden transition-all ${
//               expandedDesc ? "max-h-24" : "max-h-5"
//             }`}
//           >
//             {video.description}{" "}
//             {video.hashtags?.map((tag) => (
//               <span key={tag} className="text-white/70">
//                 #{tag}{" "}
//               </span>
//             ))}
//           </p>
//           <button
//             type="button"
//             onClick={() => setExpandedDesc((p) => !p)}
//             className="mt-0.5 text-[11px] text-white/70"
//           >
//             Show {expandedDesc ? "less" : "more"}
//           </button>
//         </div>

//         {/* scrubber */}
//         <div className="flex items-center gap-2">
//           <input
//             type="range"
//             min={0}
//             max={100}
//             step={0.1}
//             value={progress}
//             onChange={(e) => handleSeek(Number(e.target.value))}
//             className="
//               w-full h-1 rounded-full
//               cursor-pointer
//               appearance-none
//               bg-pink-500/40
//               accent-pink-500
//             "
//           />
//           <span className="text-[11px] tabular-nums min-w-[70px] text-right">
//             {formatTime(currentTime)} / {formatTime(duration || 0)}
//           </span>
//         </div>
//       </div>

//       {/* gradients */}
//       <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-pink/50 to-transparent" />
//       <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-pink/60 to-transparent" />
//       <VideoOptionsModal
//         open={optionsOpen}
//         onClose={() => setOptionsOpen(false)}
//         mediaId={mediaIdNum || video.id}
//       />
//     </div>
//   );
// }

// type IconCircleButtonProps = {
//   children: React.ReactNode;
//   onClick: () => void;
//   label?: string;
//   className?: string;
//   disabled?: boolean;
// };

// function IconCircleButton({
//   children,
//   onClick,
//   label,
//   className,
//   disabled,
// }: IconCircleButtonProps) {
//   return (
//     <button
//       type="button"
//       aria-label={label}
//       onClick={disabled ? undefined : onClick}
//       disabled={disabled}
//       className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80 disabled:opacity-50 ${
//         className || ""
//       }`}
//     >
//       {children}
//     </button>
//   );
// }

// function StatBubble({
//   label,
//   children,
// }: {
//   label: string | number;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
//       <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
//         {children}
//       </div>
//       <span className="mt-1 text-[11px]">
//         {typeof label === "number" ? label.toLocaleString() : label}
//       </span>
//     </div>
//   );
// }












// "use client";

// import Image from "next/image";
// import React, { useEffect, useRef, useState } from "react";
// import { Eye, Heart, Maximize2, Play, Volume2, VolumeX } from "lucide-react";
// import type { Video } from "./types";
// import Link from "next/link";

// type Props = {
//   video: Video;
//   onRequestFullscreen?: () => void;
//   /** hide when used inside the fullscreen overlay feed */
//   showFullscreenButton?: boolean;
//   isMuted?: boolean;
//   toggleMute?: () => void;
// };

// export default function VideoCard({
//   video,
//   onRequestFullscreen,
//   showFullscreenButton = true,
//   isMuted,
//   toggleMute,
// }: Props) {
//   const cardRef = useRef<HTMLDivElement | null>(null);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const hasRequestedSourceRef = useRef(false);
//   const clickTimeoutRef = useRef<number | null>(null);

//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isFollowing, setIsFollowing] = useState(false);

//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [currentTime, setCurrentTime] = useState(0);

//   const [expandedDesc, setExpandedDesc] = useState(false);
//   const [likes, setLikes] = useState(video.likes);
//   const [liked, setLiked] = useState(false);

//   const [isInViewport, setIsInViewport] = useState(false);
//   const [shouldLoad, setShouldLoad] = useState(false);

//   // skeleton + fade-in
//   const [metadataLoaded, setMetadataLoaded] = useState(false);

//   // ❤️ big heart animation
//   const [likeBurstVisible, setLikeBurstVisible] = useState(false);
//   const likeBurstTimeoutRef = useRef<number | null>(null);
//   const [isVertical, setIsVertical] = useState<boolean | null>(null);


//   const formatTime = (seconds: number) => {
//     if (!Number.isFinite(seconds)) return "00:00";
//     const m = Math.floor(seconds / 60);
//     const s = Math.floor(seconds % 60);
//     return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
//   };

  

//   // small helper to trigger the center-heart animation
//   const triggerLikeBurst = () => {
//     if (likeBurstTimeoutRef.current !== null) {
//       window.clearTimeout(likeBurstTimeoutRef.current);
//     }
//     setLikeBurstVisible(true);
//     likeBurstTimeoutRef.current = window.setTimeout(() => {
//       setLikeBurstVisible(false);
//       likeBurstTimeoutRef.current = null;
//     }, 550);
//   };

//   // cleanup timeout when unmounting
//   useEffect(() => {
//     return () => {
//       if (likeBurstTimeoutRef.current !== null) {
//         window.clearTimeout(likeBurstTimeoutRef.current);
//       }
//     };
//   }, []);

//   const toggleLike = () => {
//     setLiked((prevLiked) => {
//       const nextLiked = !prevLiked;

//       setLikes((prevLikes) =>
//         nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//       );

//       // only animate when going from unliked -> liked
//       if (!prevLiked) {
//         triggerLikeBurst();
//       }

//       return nextLiked;
//     });
//   };

//   const handleDoubleLike = () => {
//     toggleLike();
//   };

//   const handleSeek = (value: number) => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const newTime = (value / 100) * el.duration;
//     el.currentTime = newTime;
//     setCurrentTime(newTime);
//     setProgress(value);
//   };

//   // Intersection observer
//   useEffect(() => {
//     const target = cardRef.current;
//     if (!target) return;

//     const observer = new IntersectionObserver(
//       (entries) => {
//         entries.forEach((entry) => {
//           const mostlyVisible =
//             entry.isIntersecting && entry.intersectionRatio >= 0.65;
//           setIsInViewport(mostlyVisible);

//           if (
//             (entry.isIntersecting || entry.intersectionRatio > 0.25) &&
//             !hasRequestedSourceRef.current
//           ) {
//             hasRequestedSourceRef.current = true;
//             setShouldLoad(true);
//           }
//         });
//       },
//       { threshold: [0.25, 0.65, 0.85] }
//     );

//     observer.observe(target);
//     return () => observer.disconnect();
//   }, []);

//   // keep muted state in sync
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;
//     el.muted = isMuted;
//   }, [isMuted, shouldLoad]);

//   // auto play / reset on visibility change
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;

//     if (isInViewport) {
//       el.currentTime = 0;
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//       el.currentTime = 0;
//       setIsPlaying(false);
//       setCurrentTime(0);
//       setProgress(0);
//     }
//   }, [isInViewport, shouldLoad]);

//   // video events
//   const togglePlay = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.paused) {
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//     }
//   };

//   const handlePlay = () => setIsPlaying(true);

//   const handlePause = () => {
//     setIsPlaying(false);
//     if (videoRef.current?.currentTime === 0) {
//       setProgress(0);
//       setCurrentTime(0);
//     }
//   };

//   const handleLoadedMetadata = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.duration) setDuration(el.duration);
//     setMetadataLoaded(true);
//     const { videoWidth, videoHeight } = el;
//     setIsVertical(videoHeight > videoWidth);
//   };

//   const handleTimeUpdate = () => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const cur = el.currentTime;
//     const dur = el.duration;
//     setCurrentTime(cur);
//     setDuration(dur);
//     setProgress((cur / dur) * 100);
//   };

//   const toggleFollow = () => {
//     setIsFollowing((prev) => !prev)

//   };

//   // single vs double click on video
//   const handleOverlayClick = () => {
//     if (clickTimeoutRef.current !== null) {
//       window.clearTimeout(clickTimeoutRef.current);
//       clickTimeoutRef.current = null;
//       handleDoubleLike();
//       return;
//     }

//     clickTimeoutRef.current = window.setTimeout(() => {
//       togglePlay();
//       clickTimeoutRef.current = null;
//     }, 250);
//   };

//   const showSkeleton = shouldLoad && !metadataLoaded;

//   return (
//     <div
//       ref={cardRef}
//       className="
//         relative lg:h-[100vh]
//         h-[80vh]
//         flex items-center justify-center
//         bg-neutral-900 shadow-5xl overflow-hidden
//       "
//     >
//       <div className="relative h-full flex items-center">
//         {/* Skeleton layer */}
//         {showSkeleton && (
//           <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
//         )}

//         <video
//           ref={videoRef}
//           src={shouldLoad ? video.src : undefined}
//           preload={shouldLoad ? "metadata" : "none"}
//           muted={isMuted}
//           onLoadedMetadata={handleLoadedMetadata}
//           onTimeUpdate={handleTimeUpdate}
//           onPlay={handlePlay}
//           onPause={handlePause}
//           className={`
//             max-h-full max-w-full
//             ${isVertical ? "h-full w-auto" : "w-full h-auto"}
//             object-contain
//             transition-opacity duration-300
//             ${metadataLoaded ? "opacity-100" : "opacity-0"}
//           `}
//           loop
//           playsInline
//         />
//       </div>

//       {/* ❤️ LIKE BURST OVERLAY */}
//       {likeBurstVisible && (
//         <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
//           <Heart className="h-24 w-24 text-red-500 fill-red-500 like-burst drop-shadow-[0_0_18px_rgba(248,113,113,1)]" />
//         </div>
//       )}

//       {/* single-click play / pause, double-click like */}
//       <button
//         type="button"
//         onClick={handleOverlayClick}
//         className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
//       >
//         {!isPlaying && (
//           <div className="rounded-full bg-black/60 border border-white/60 p-4 text-white">
//             <Play className="h-8 w-8" />
//           </div>
//         )}
//       </button>

//       {/* right-side actions */}
//       <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
//         <StatBubble label={video.views.toLocaleString()}>
//           <Eye className="h-7 w-7" />
//         </StatBubble>

//         {showFullscreenButton && (
//           <div className="hidden lg:block">
//             <IconCircleButton
//               onClick={() => {
//                 onRequestFullscreen?.();
//                 const el = videoRef.current;
//                 if (!el) return
//                   if (el.paused) {
//                       return
//                     }
//                   else {
//                     el.pause()
//                   }

                
//               }}
//               label="Full screen"
//               className="hidden lg:flex"
//             >
//               <Maximize2 className="h-7 w-7" />
//             </IconCircleButton>
//           </div>
//         )}

//         <IconCircleButton onClick={toggleMute!} label="Mute / unmute">
//           {isMuted ? (
//             <VolumeX className="h-7 w-7" />
//           ) : (
//             <Volume2 className="h-7 w-7" />
//           )}
//         </IconCircleButton>

//         <div className="flex flex-col items-center gap-1">
//           <IconCircleButton onClick={toggleLike} label="Like">
//             <Heart
//               className={`h-7 w-7 ${
//                 liked ? "fill-red-500 text-red-500" : ""
//               }`}
//             />
//           </IconCircleButton>
//           <span className="text-[11px]">
//             {likes.toLocaleString()}
//           </span>
//         </div>
//       </div>

//       {/* bottom info + scrubber */}
//       <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
//         {/* creator row */}
//         <div className="flex items-center gap-3">

//           <Link
//             href={`/profile/${video.username}`}
//           >
//             <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
//               <Image
//                 src={video.avatar}
//                 alt={video.username}
//                 width={40}
//                 height={40}
//                 className="h-full w-full object-cover"
//                 loading="lazy"
//               />
//             </div>
//           </Link>

//           <Link
//             href={`/profile/${video.username}`}
//           >
//           <div className="min-w-0">
//             <div className="text-sm font-semibold truncate">
//               {video.username}
//             </div>
//           </div>
//           </Link>

//           <button
//             type="button"
//             onClick={toggleFollow}
//             className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
//               isFollowing
//                 ? "bg-white text-black border-transparent"
//                 : "border-white/60 bg-black/50 text-white"
//             }`}
//           >
//             {isFollowing ? "Following" : "Follow"}
//           </button>
//         </div>

//         {/* description */}
//         <div className="text-xs text-white/85">
//           <p
//             className={`overflow-hidden transition-all ${
//               expandedDesc ? "max-h-24" : "max-h-5"
//             }`}
//           >
//             {video.description}{" "}
//             {video.hashtags.map((tag) => (
//               <span key={tag} className="text-white/70">
//                 #{tag}{" "}
//               </span>
//             ))}
//           </p>
//           <button
//             type="button"
//             onClick={() => setExpandedDesc((p) => !p)}
//             className="mt-0.5 text-[11px] text-white/70"
//           >
//             Show {expandedDesc ? "less" : "more"}
//           </button>
//         </div>

//         {/* scrubber */}
//         <div className="flex items-center gap-2">
//           <input
//             type="range"
//             min={0}
//             max={100}
//             step={0.1}
//             value={progress}
//             onChange={(e) => handleSeek(Number(e.target.value))}
//             className="
//               w-full h-1 rounded-full
//               cursor-pointer
//               appearance-none
//               bg-pink-500/40
//               accent-pink-500
//             "
//           />
//           <span className="text-[11px] tabular-nums min-w-[70px] text-right">
//             {formatTime(currentTime)} / {formatTime(duration || 0)}
//           </span>
//         </div>
//       </div>

//       {/* gradients */}
//       <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
//       <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
//     </div>
//   );
// }

// type IconCircleButtonProps = {
//   children: React.ReactNode;
//   onClick: () => void;
//   label?: string;
//   className?: string;
//   disabled?: boolean;
// };

// function IconCircleButton({
//   children,
//   onClick,
//   label,
//   className,
//   disabled,
// }: IconCircleButtonProps) {
//   return (
//     <button
//       type="button"
//       aria-label={label}
//       onClick={disabled ? undefined : onClick}
//       disabled={disabled}
//       className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80 disabled:opacity-50 ${className || ""}`}
//     >
//       {children}
//     </button>
//   );
// }

// function StatBubble({
//   label,
//   children,
// }: {
//   label: string | number;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
//       <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
//         {children}
//       </div>
//       <span className="mt-1 text-[11px]">
//         {typeof label === "number" ? label.toLocaleString() : label}
//       </span>
//     </div>
//   );
// }












// // app/components/feed/VideoCard.tsx
// "use client";

// import Image from "next/image";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   Eye,
//   Heart,
//   Maximize2,
//   Play,
//   Volume2,
//   VolumeX,
// } from "lucide-react";
// import { toggleMediaLike } from "@/lib/actions/mediaFeed";

// import type { Video } from "./types";

// type Props = {
//   video: Video;
//   onRequestFullscreen?: () => void;
//   showFullscreenButton?: boolean;
//   isMuted?: boolean;
//   toggleMute?: () => void;
// };

// export default function VideoCard({
//   video,
//   onRequestFullscreen,
//   showFullscreenButton = true,
//   isMuted = true,
//   toggleMute,
// }: Props) {
//   const cardRef = useRef<HTMLDivElement | null>(null);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const hasRequestedSourceRef = useRef(false);
//   const clickTimeoutRef = useRef<number | null>(null);

//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isFollowing, setIsFollowing] = useState(false);

//   const [progress, setProgress] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [currentTime, setCurrentTime] = useState(0);

//   const [expandedDesc, setExpandedDesc] = useState(false);
  

//   const [isInViewport, setIsInViewport] = useState(false);
//   const [shouldLoad, setShouldLoad] = useState(false);
//   const [metadataLoaded, setMetadataLoaded] = useState(false);

//   const [likes, setLikes] = useState(video.likes);
//   const [liked, setLiked] = useState(false);
//   const [likeBusy, setLikeBusy] = useState(false);

//   // -------- helpers --------

//   const formatTime = (seconds: number) => {
//     if (!Number.isFinite(seconds)) return "00:00";
//     const m = Math.floor(seconds / 60);
//     const s = Math.floor(seconds % 60);
//     return `${m.toString().padStart(2, "0")}:${s
//       .toString()
//       .padStart(2, "0")}`;
//   };

//     async function handleLikeClick() {
//     if (likeBusy) return;
//     setLikeBusy(true);

//     try {
//       const res = await toggleMediaLike(video.mediaId);

//       setLiked(res.liked);

//       if (typeof res.likeCount === "number") {
//         setLikes(res.likeCount);
//       } else {
//         // fallback if we couldn't read like_count
//         setLikes((prev) =>
//           res.liked ? prev + 1 : Math.max(0, prev - 1)
//         );
//       }
//     } catch (err: any) {
//       console.error("Like failed", err);
//       if (err?.message) {
//         alert(err.message); // swap with your toast system later
//       }
//     } finally {
//       setLikeBusy(false);
//     }
//   };

//   const toggleLike = async () => {
//     setLiked((prevLiked) => {
//       const nextLiked = !prevLiked;
//       setLikes((prevLikes) =>
//         nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//       );
//       return nextLiked;
//     });
//     await handleLikeClick()
//   };

//   const handleDoubleLike = () => {
//     toggleLike();
//   };

//   const handleSeek = (value: number) => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const newTime = (value / 100) * el.duration;
//     el.currentTime = newTime;
//     setCurrentTime(newTime);
//     setProgress(value);
//   };

//   // ---- intersection observer for auto-load & auto-play ----

//   useEffect(() => {
//     const target = cardRef.current;
//     if (!target) return;

//     const observer = new IntersectionObserver(
//       (entries) => {
//         entries.forEach((entry) => {
//           const mostlyVisible =
//             entry.isIntersecting && entry.intersectionRatio >= 0.65;
//           setIsInViewport(mostlyVisible);

//           if (
//             (entry.isIntersecting || entry.intersectionRatio > 0.25) &&
//             !hasRequestedSourceRef.current
//           ) {
//             hasRequestedSourceRef.current = true;
//             setShouldLoad(true);
//           }
//         });
//       },
//       { threshold: [0.25, 0.65, 0.85] }
//     );

//     observer.observe(target);
//     return () => observer.disconnect();
//   }, []);

//   // keep muted state in sync
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;
//     el.muted = isMuted;
//   }, [isMuted, shouldLoad]);

//   // auto play / reset on visibility change
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;

//     if (isInViewport) {
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//       el.currentTime = 0;
//       setIsPlaying(false);
//       setCurrentTime(0);
//       setProgress(0);
//     }
//   }, [isInViewport, shouldLoad]);

//   // ---- video events ----

//   const togglePlay = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.paused) {
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//     }
//   };

//   const handlePlay = () => setIsPlaying(true);

//   const handlePause = () => {
//     setIsPlaying(false);
//     if (videoRef.current?.currentTime === 0) {
//       setProgress(0);
//       setCurrentTime(0);
//     }
//   };

//   const handleLoadedMetadata = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.duration) setDuration(el.duration);
//     setMetadataLoaded(true);
//     const { videoWidth, videoHeight } = el;
//     setIsVertical(videoHeight > videoWidth);
//   };

//   const handleTimeUpdate = () => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const cur = el.currentTime;
//     const dur = el.duration;
//     setCurrentTime(cur);
//     setDuration(dur);
//     setProgress((cur / dur) * 100);
//   };

//   const toggleFollow = () => setIsFollowing((prev) => !prev);

//   // single vs double click
//   const handleOverlayClick = () => {
//     if (clickTimeoutRef.current !== null) {
//       window.clearTimeout(clickTimeoutRef.current);
//       clickTimeoutRef.current = null;
//       handleDoubleLike();
//       return;
//     }

//     clickTimeoutRef.current = window.setTimeout(() => {
//       togglePlay();
//       clickTimeoutRef.current = null;
//     }, 250);
//   };

//   // ------------- render -------------

//   const showSkeleton = !shouldLoad || !metadataLoaded;

//   const [isVertical, setIsVertical] = useState<boolean | null>(null);

  


//   return (
//     <div
//       ref={cardRef}
//       className="
//         relative lg:h-[100vh]
//         h-[80vh]
//         flex items-center justify-center
//         bg-neutral-900 shadow-5xl overflow-hidden
//       "
//     >
//       <div className="relative h-full flex items-center">
//         {/* Skeleton layer */}
//         {showSkeleton && (
//           <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
//         )}

//         <video
//   ref={videoRef}
//   src={shouldLoad ? video.src : undefined}
//   preload={shouldLoad ? "metadata" : "none"}
//   muted={isMuted}
//   onLoadedMetadata={handleLoadedMetadata}
//   onTimeUpdate={handleTimeUpdate}
//   onPlay={handlePlay}
//   onPause={handlePause}
//   className={`
//     max-h-full max-w-full
//     ${isVertical ? "h-full w-auto" : "w-full h-auto"}
//     object-contain
//     transition-opacity duration-300
//     ${metadataLoaded ? "opacity-100" : "opacity-0"}
//   `}
//   loop
//   playsInline
// />

//       </div>

//       {/* play/pause + double-like overlay */}
//       <button
//         type="button"
//         onClick={handleOverlayClick}
//         className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
//       >
//         {!isPlaying && (
//           <div className="rounded-full bg-black/60 border border-white/60 p-4 text-white">
//             <Play className="h-8 w-8" />
//           </div>
//         )}
//       </button>

//       {/* right-side actions */}
//       <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
//         <StatBubble label={video.views.toLocaleString()}>
//           <Eye className="h-7 w-7" />
//         </StatBubble>

//         {showFullscreenButton && (
//           <div className="hidden lg:block">
//             <IconCircleButton
//               onClick={() => {
//                 togglePlay();
//                 onRequestFullscreen?.();
//               }}
//               label="Full screen"
//               className="hidden lg:flex"
//             >
//               <Maximize2 className="h-7 w-7" />
//             </IconCircleButton>
//           </div>
//         )}

//         {toggleMute && (
//           <IconCircleButton onClick={toggleMute} label="Mute / unmute">
//             {isMuted ? (
//               <VolumeX className="h-7 w-7" />
//             ) : (
//               <Volume2 className="h-7 w-7" />
//             )}
//           </IconCircleButton>
//         )}

//         <div className="flex flex-col items-center gap-1">
//           <IconCircleButton
//             onClick={handleLikeClick}
//             label="Like"
//             disabled={likeBusy}
//           >
//             <Heart
//               className={`h-7 w-7 ${
//                 liked ? "fill-red-500 text-red-500" : ""
//               }`}
//             />
//           </IconCircleButton>
//           <span className="text-[11px]">{likes.toLocaleString()}</span>
//         </div>
//       </div>

//       {/* bottom info + scrubber */}
//       <div className="absolute inset-x-3 bottom-3 z-20 space-y-2">
//         <div className="flex items-center gap-3">
//           <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
//             <Image
//               src={video.avatar}
//               alt={video.username}
//               width={40}
//               height={40}
//               className="h-full w-full object-cover"
//               loading="lazy"
//             />
//           </div>

//           <div className="min-w-0">
//             <div className="text-sm font-semibold truncate">
//               {video.username}
//             </div>
//           </div>

//           <button
//             type="button"
//             onClick={toggleFollow}
//             className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
//               isFollowing
//                 ? "bg-white text-black border-transparent"
//                 : "border-white/60 bg-black/50 text-white"
//             }`}
//           >
//             {isFollowing ? "Following" : "Follow"}
//           </button>
//         </div>

//         <div className="text-xs text-white/85">
//           <p
//             className={`overflow-hidden transition-all ${
//               expandedDesc ? "max-h-24" : "max-h-5"
//             }`}
//           >
//             {video.description}{" "}
//             {video.hashtags.map((tag) => (
//               <span key={tag} className="text-white/70">
//                 #{tag}{" "}
//               </span>
//             ))}
//           </p>
//           <button
//             type="button"
//             onClick={() => setExpandedDesc((p) => !p)}
//             className="mt-0.5 text-[11px] text-white/70"
//           >
//             Show {expandedDesc ? "less" : "more"}
//           </button>
//         </div>

//         <div className="flex items-center gap-2">
//           <input
//             type="range"
//             min={0}
//             max={100}
//             step={0.1}
//             value={progress}
//             onChange={(e) => handleSeek(Number(e.target.value))}
//             className="
//               w-full h-1 rounded-full
//               cursor-pointer
//               appearance-none
//               bg-pink-500/40
//               accent-pink-500
//             "
//           />
//           <span className="text-[11px] tabular-nums min-w-[70px] text-right">
//             {formatTime(currentTime)} / {formatTime(duration || 0)}
//           </span>
//         </div>
//       </div>

//       {/* gradients */}
//       <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
//       <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
//     </div>
//   );
// }

// type IconCircleButtonProps = {
//   children: React.ReactNode;
//   onClick: () => void;
//   label?: string;
//   className?: string;
//   disabled?: boolean;
// };

// function IconCircleButton({
//   children,
//   onClick,
//   label,
//   className,
//   disabled,
// }: IconCircleButtonProps) {
//   return (
//     <button
//       type="button"
//       aria-label={label}
//       onClick={disabled ? undefined : onClick}
//       disabled={disabled}
//       className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80
//                   disabled:opacity-50 disabled:cursor-default ${className || ""}`}
//     >
//       {children}
//     </button>
//   );
// }

// function StatBubble({
//   label,
//   children,
// }: {
//   label: string | number;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
//       <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
//         {children}
//       </div>
//       <span className="mt-1 text-[11px]">{label}</span>
//     </div>
//   );
// }



// "use client";

// import Image from "next/image";
// import React, { useEffect, useRef, useState } from "react";
// import { Eye, Heart, Maximize2, Play, Volume2, VolumeX } from "lucide-react";
// import type { Video } from "./types";

// type Props = {
//   video: Video;
//   onRequestFullscreen?: () => void;
//   /** hide when used inside the fullscreen overlay feed */
//   showFullscreenButton?: boolean;
//   isMuted?: boolean;
//   toggleMute?: () => void;
// };

// export default function VideoCard({
//   video,
//   onRequestFullscreen,
//   showFullscreenButton = true,
//   isMuted,
//   toggleMute,
// }: Props) {
//   const cardRef = useRef<HTMLDivElement | null>(null);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const hasRequestedSourceRef = useRef(false);
//   // NEW: click timer for single vs double click
//   const clickTimeoutRef = useRef<number | null>(null);

//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isFollowing, setIsFollowing] = useState(false);

//   const [progress, setProgress] = useState(0); // 0–100
//   const [duration, setDuration] = useState(0); // seconds
//   const [currentTime, setCurrentTime] = useState(0); // seconds

//   const [expandedDesc, setExpandedDesc] = useState(false);
//   const [likes, setLikes] = useState(video.likes);
//   const [liked, setLiked] = useState(false);

//   const [isInViewport, setIsInViewport] = useState(false);
//   const [shouldLoad, setShouldLoad] = useState(false);

//   // --- helpers --------------------------------------------------------------

//   const formatTime = (seconds: number) => {
//     if (!Number.isFinite(seconds)) return "00:00";
//     const m = Math.floor(seconds / 60);
//     const s = Math.floor(seconds % 60);
//     return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
//   };

//   const toggleLike = () => {
//     setLiked((prevLiked) => {
//       const nextLiked = !prevLiked;
//       setLikes((prevLikes) =>
//         nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
//       );
//       return nextLiked;
//     });
//   };

//   const handleDoubleLike = () => {
//     toggleLike();
//   };

//   const handleSeek = (value: number) => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const newTime = (value / 100) * el.duration;
//     el.currentTime = newTime;
//     setCurrentTime(newTime);
//     setProgress(value);
//   };

//   // --- intersection observer (auto-play when mostly in view) ---------------

//   useEffect(() => {
//     const target = cardRef.current;
//     if (!target) return;

//     const observer = new IntersectionObserver(
//       (entries) => {
//         entries.forEach((entry) => {
//           const mostlyVisible =
//             entry.isIntersecting && entry.intersectionRatio >= 0.65;
//           setIsInViewport(mostlyVisible);

//           if (
//             (entry.isIntersecting || entry.intersectionRatio > 0.25) &&
//             !hasRequestedSourceRef.current
//           ) {
//             hasRequestedSourceRef.current = true;
//             setShouldLoad(true);
//           }
//         });
//       },
//       { threshold: [0.25, 0.65, 0.85] }
//     );

//     observer.observe(target);
//     return () => observer.disconnect();
//   }, []);

//   // keep muted state in sync
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;
//     el.muted = isMuted;
//   }, [isMuted, shouldLoad]);

//   // auto play / reset on visibility change
//   useEffect(() => {
//     const el = videoRef.current;
//     if (!el || !shouldLoad) return;

//     if (isInViewport) {
//       el.currentTime = 0;
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//       el.currentTime = 0;
//       setIsPlaying(false);
//       setCurrentTime(0);
//       setProgress(0);
//     }
//   }, [isInViewport, shouldLoad]);

//   // --- video event handlers -------------------------------------------------

//   const togglePlay = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.paused) {
//       const maybePlay = el.play();
//       if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
//     } else {
//       el.pause();
//     }
//   };

//   const handlePlay = () => setIsPlaying(true);

//   const handlePause = () => {
//     setIsPlaying(false);
//     if (videoRef.current?.currentTime === 0) {
//       setProgress(0);
//       setCurrentTime(0);
//     }
//   };

//   const handleLoadedMetadata = () => {
//     const el = videoRef.current;
//     if (!el) return;
//     if (el.duration) setDuration(el.duration);
//   };

//   const handleTimeUpdate = () => {
//     const el = videoRef.current;
//     if (!el || !el.duration) return;
//     const cur = el.currentTime;
//     const dur = el.duration;
//     setCurrentTime(cur);
//     setDuration(dur);
//     setProgress((cur / dur) * 100);
//   };

//   const toggleFollow = () => setIsFollowing((prev) => !prev);

//   // NEW: handle overlay click (single vs double)
//   const handleOverlayClick = () => {
//     // second click within window → treat as double-click like
//     if (clickTimeoutRef.current !== null) {
//       window.clearTimeout(clickTimeoutRef.current);
//       clickTimeoutRef.current = null;
//       handleDoubleLike();
//       return;
//     }

//     // first click: wait briefly to see if another click comes
//     clickTimeoutRef.current = window.setTimeout(() => {
//       togglePlay(); // only single-click toggles play
//       clickTimeoutRef.current = null;
//     }, 250); // ~200ms double-click window
//   };

//   // --------------------------------------------------------------------------

//   return (
//     <div
//       ref={cardRef}
//       /* removed onDoubleClick so we don't also pause/play */
//       className="
//         relative lg:h-[100vh]
//         h-[80vh]
//         flex items-center justify-center
//         bg-neutral-900 shadow-5xl overflow-hidden
//       "
//     >
//       <video
//         ref={videoRef}
//         src={shouldLoad ? video.src : undefined}
//         preload={shouldLoad ? "metadata" : "none"}
//         muted={isMuted}
//         onLoadedMetadata={handleLoadedMetadata}
//         onTimeUpdate={handleTimeUpdate}
//         onPlay={handlePlay}
//         onPause={handlePause}
//         className="
//           h-full
//           aspect-[9/16]
//           w-auto
//           max-w-[min(100vw,480px)]
//           md:max-w-[min(100vw,600px)]
//           lg:max-w-[min(100vw,420px)]
//           object-cover
//         "
//         loop
//         playsInline
//       />

//       {/* single-click play / pause, double-click like */}
//       <button
//         type="button"
//         onClick={handleOverlayClick}
//         className="absolute inset-0 z-10 flex items-center justify-center focus:outline-none"
//       >
//         {!isPlaying && (
//           <div className="rounded-full bg-black/60 border border-white/60 p-4 text-white">
//             <Play className="h-8 w-8" />
//           </div>
//         )}
//       </button>

//       {/* right-side actions */}
//       <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
//         <StatBubble label={video.views}>
//           <Eye className="h-7 w-7" />
//         </StatBubble>

//         {/* fullscreen button is desktop-only */}
//         {showFullscreenButton && (
//           <div className="hidden lg:block">
//             <IconCircleButton
//               onClick={() => {
//                 togglePlay()
//                 onRequestFullscreen?.();
                
//               }
//               }
//               label="Full screen"
//               className="hidden lg:flex"
//             >
//               <Maximize2 className="h-7 w-7" />
//             </IconCircleButton>
//           </div>
//         )}

//         <IconCircleButton onClick={toggleMute!} label="Mute / unmute">
//           {isMuted ? (
//             <VolumeX className="h-7 w-7" />
//           ) : (
//             <Volume2 className="h-7 w-7" />
//           )}
//         </IconCircleButton>

//         <div className="flex flex-col items-center gap-1">
//           <IconCircleButton onClick={toggleLike} label="Like">
//             <Heart
//               className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : ""}`}
//             />
//           </IconCircleButton>
//           <span className="text-[11px]">{likes}</span>
//         </div>
//       </div>

//       {/* bottom info + scrubber */}
//       <div className="absolute inset-x-3 bottom-3 z-20 space-y-2">
//         {/* creator row */}
//         <div className="flex items-center gap-3">
//           <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
//             <Image
//               src={video.avatar}
//               alt={video.username}
//               width={40}
//               height={40}
//               className="h-full w-full object-cover"
//               loading="lazy"
//             />
//           </div>

//           <div className="min-w-0">
//             <div className="text-sm font-semibold truncate">
//               {video.username}
//             </div>
//           </div>

//           <button
//             type="button"
//             onClick={toggleFollow}
//             className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
//               isFollowing
//                 ? "bg-white text-black border-transparent"
//                 : "border-white/60 bg-black/50 text-white"
//             }`}
//           >
//             {isFollowing ? "Following" : "Follow"}
//           </button>
//         </div>

//         {/* description */}
//         <div className="text-xs text-white/85">
//           <p
//             className={`overflow-hidden transition-all ${
//               expandedDesc ? "max-h-24" : "max-h-5"
//             }`}
//           >
//             {video.description}{" "}
//             {video.hashtags.map((tag) => (
//               <span key={tag} className="text-white/70">
//                 #{tag}{" "}
//               </span>
//             ))}
//           </p>
//           <button
//             type="button"
//             onClick={() => setExpandedDesc((p) => !p)}
//             className="mt-0.5 text-[11px] text-white/70"
//           >
//             Show {expandedDesc ? "less" : "more"}
//           </button>
//         </div>

//         {/* pink draggable progress bar + time */}
//         <div className="flex items-center gap-2">
//           <input
//             type="range"
//             min={0}
//             max={100}
//             step={0.1}
//             value={progress}
//             onChange={(e) => handleSeek(Number(e.target.value))}
//             className="
//               w-full h-1 rounded-full
//               cursor-pointer
//               appearance-none
//               bg-pink-500/40
//               accent-pink-500
//             "
//           />
//           <span className="text-[11px] tabular-nums min-w-[70px] text-right">
//             {formatTime(currentTime)} / {formatTime(duration || 0)}
//           </span>
//         </div>
//       </div>

//       {/* gradients */}
//       <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
//       <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
//     </div>
//   );
// }

// type IconCircleButtonProps = {
//   children: React.ReactNode;
//   onClick: () => void;
//   label?: string;
//   className?: string;
// };

// function IconCircleButton({
//   children,
//   onClick,
//   label,
//   className,
// }: IconCircleButtonProps) {
//   return (
//     <button
//       type="button"
//       aria-label={label}
//       onClick={onClick}
//       className={`h-10 w-10 rounded-full flex items-center justify-center text-lg text-white hover:bg-black/80 ${className || ""}`}
//     >
//       {children}
//     </button>
//   );
// }

// function StatBubble({
//   label,
//   children,
// }: {
//   label: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="flex flex-col items-center text-xs hover:bg-black/80 rounded-full">
//       <div className="h-10 w-10 rounded-full flex items-center justify-center text-white">
//         {children}
//       </div>
//       <span className="mt-1 text-[11px]">{label}</span>
//     </div>
//   );
// }
