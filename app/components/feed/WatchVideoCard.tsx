"use client";

import Image from "next/image";
import Link from "next/link";
import React, {
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

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
  SendHorizonal,
  ArrowUpRightFromSquare,
  Minimize2,
  Loader,
} from "lucide-react";

import type { Video } from "./types";

import {
  checkIsFollowing,
  toggleFollowUser,
  checkHasLikedMedia,
  toggleMediaLike,
  checkHasLikedAd,
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
import { incrementAdClicks } from "@/lib/actions/ads";

/* ============================================================
   TYPES
   ============================================================ */

type WatchVideoCardProps = {
  video: Video;

  isMuted?: boolean;
  toggleMute?: () => void;

  /**
   * Optional controlled maximize state.
   *
   * If omitted, the component manages its own fullscreen state.
   */
  maximize?: boolean;
  onMaximizeChange?: (value: boolean) => void;

  /**
   * Kept for compatibility with the existing card/API pattern.
   */
  onRequestFullscreen?: () => void;

  /**
   * Sponsored-video support retained from the existing card.
   */
  variant?: "default" | "sponsored";
  visitUrl?: string;

  /**
   * Optional external close behavior.
   *
   * Useful if WatchVideoCard is ever placed inside another
   * fullscreen/modal wrapper.
   */
  open?: boolean;
  onClose?: () => void;

  className?: string;
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function WatchVideoCard({
  video,
  isMuted = true,
  toggleMute,
  maximize: controlledMaximize,
  onMaximizeChange,
  onRequestFullscreen,
  variant = "default",
  visitUrl,
  open,
  onClose,
  className = "",
}: WatchVideoCardProps) {
  const isSponsored = variant === "sponsored";

  const anyVideo = video as any;

  const adIdNum =
    isSponsored && typeof anyVideo._adId === "number"
      ? anyVideo._adId
      : null;

  const mediaIdNum = !isSponsored
    ? Number(video.mediaId ?? video.id)
    : NaN;

  /* ==========================================================
     REFS
     ========================================================== */

  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const likeBurstTimeoutRef = useRef<number | null>(null);

  /* ==========================================================
     MAXIMIZE / FULLSCREEN
     ========================================================== */

  const [internalMaximize, setInternalMaximize] = useState(false);

  const maximize =
    controlledMaximize !== undefined
      ? controlledMaximize
      : internalMaximize;

  const setMaximize = (value: boolean) => {
    setInternalMaximize(value);
    onMaximizeChange?.(value);
  };

  /* ==========================================================
     VIDEO STATE
     ========================================================== */

  const [isPlaying, setIsPlaying] = useState(false);

  const [metadataLoaded, setMetadataLoaded] = useState(false);

  const [isVertical, setIsVertical] = useState<boolean | null>(
    null
  );

  const [duration, setDuration] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);

  const [progress, setProgress] = useState(0);

  /* ==========================================================
     FOLLOW STATE
     ========================================================== */

  const [isFollowing, setIsFollowing] = useState(false);

  const [followLoading, setFollowLoading] = useState(false);

  /* ==========================================================
     LIKE STATE
     ========================================================== */

  const [likes, setLikes] = useState(video.likes ?? 0);

  const [liked, setLiked] = useState(!!video.likedByMe);

  const [likeLoading, setLikeLoading] = useState(false);

  const [likeBurstVisible, setLikeBurstVisible] = useState(false);

  /* ==========================================================
     OTHER UI STATE
     ========================================================== */

  const [expandedDesc, setExpandedDesc] = useState(false);

  const [optionsOpen, setOptionsOpen] = useState(false);

  const [currentId, setCurrentId] = useState("");

  const [isDesktop, setIsDesktop] = useState(false);

  const [showLikeAuthTooltip, setShowLikeAuthTooltip] =
    useState(false);

  /* ==========================================================
     COMMENTS STATE
     ========================================================== */

  const [commentsOpen, setCommentsOpen] = useState(false);

  const [comments, setComments] = useState<CommentNode[]>([]);

  const [commentsLoading, setCommentsLoading] = useState(false);

  const [commentsError, setCommentsError] = useState<string | null>(
    null
  );

  const [newComment, setNewComment] = useState("");

  const [replyTo, setReplyTo] = useState<{
    id: string;
    username: string;
  } | null>(null);

  const [sendCommentLoading, setSendCommentLoading] = useState(false);

  const isLoggedIn = !!currentId;

  /* ==========================================================
     FORMATTING
     ========================================================== */

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "00:00";

    const m = Math.floor(seconds / 60);

    const s = Math.floor(seconds % 60);

    return `${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatAbbrev = (input: number): string => {
    if (!Number.isFinite(input)) return "0";

    const sign = input < 0 ? "-" : "";

    const n = Math.abs(input);

    const units = [
      { v: 1_000_000_000, s: "B" },
      { v: 1_000_000, s: "M" },
      { v: 1_000, s: "K" },
    ] as const;

    for (const u of units) {
      if (n >= u.v) {
        const raw = n / u.v;

        const str = raw
          .toFixed(1)
          .replace(/\.0$/, "");

        return `${sign}${str}${u.s}`;
      }
    }

    return `${sign}${Math.round(n)}`;
  };

  const labelToSlug = (label: string): string => {
    const decoded = decodeURIComponent(label).trim();

    return decoded
      .split(" ")
      .filter(Boolean)
      .map(
        (word) =>
          word.charAt(0).toLowerCase() +
          word.slice(1).toLowerCase()
      )
      .join("-");
  };

  const totalComments = countComments(comments);

  /* ==========================================================
     CURRENT USER
     ========================================================== */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const id = await getUserIdFromCookies();

        if (!cancelled) {
          setCurrentId(id);
        }
      } catch (error) {
        console.error("getUserIdFromCookies error", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ==========================================================
     DESKTOP / MOBILE DETECTION
     ========================================================== */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(
      "(min-width: 1024px)"
    );

    const update = () => {
      setIsDesktop(mediaQuery.matches);
    };

    update();

    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  /* ==========================================================
     FOLLOW
     ========================================================== */

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
      } catch (error) {
        console.error("checkIsFollowing error", error);
      } finally {
        if (!cancelled) {
          setFollowLoading(false);
        }
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
      const result = await toggleFollowUser(video.ownerId);

      setIsFollowing(result.following);
    } catch (error) {
      console.error("toggleFollowUser error", error);
    } finally {
      setFollowLoading(false);
    }
  };

  /* ==========================================================
     LIKE INITIAL STATE
     ========================================================== */

  useEffect(() => {
    let cancelled = false;

    /*
     * If the server already provided the state,
     * use that state.
     */
    if (video.likedByMe !== undefined) {
      setLiked(!!video.likedByMe);

      return () => {
        cancelled = true;
      };
    }

    /*
     * Sponsored content.
     */
    if (isSponsored) {
      if (!adIdNum) return;

      (async () => {
        try {
          const hasLiked = await checkHasLikedAd(adIdNum);

          if (!cancelled) {
            setLiked(hasLiked);
          }
        } catch (error) {
          console.error("checkHasLikedAd error", error);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    /*
     * Normal media.
     */
    if (!mediaIdNum || Number.isNaN(mediaIdNum)) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const hasLiked =
          await checkHasLikedMedia(mediaIdNum);

        if (!cancelled) {
          setLiked(hasLiked);
        }
      } catch (error) {
        console.error(
          "checkHasLikedMedia error",
          error
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mediaIdNum,
    adIdNum,
    isSponsored,
    video.likedByMe,
  ]);

  /* ==========================================================
     LIKE BURST CLEANUP
     ========================================================== */

  useEffect(() => {
    return () => {
      if (likeBurstTimeoutRef.current !== null) {
        window.clearTimeout(
          likeBurstTimeoutRef.current
        );
      }

      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(
          clickTimeoutRef.current
        );
      }
    };
  }, []);

  /* ==========================================================
     VIDEO MUTED STATE
     ========================================================== */

  useEffect(() => {
    const element = videoRef.current;

    if (!element) return;

    element.muted = isMuted;
  }, [isMuted]);

  /* ==========================================================
     AUTOPLAY
     ========================================================== */

  /*
   * Unlike the feed VideoCard, this component has no
   * loadLevel and no neighbor lifecycle.
   *
   * There is exactly one video, so it is loaded immediately.
   *
   * We still start it muted so browser autoplay policies
   * don't prevent playback.
   */

  useEffect(() => {
    const element = videoRef.current;

    if (!element) return;

    element.muted = isMuted;

    const playPromise = element.play();

    if (playPromise) {
      playPromise.catch(() => {
        /*
         * Browser autoplay may still reject.
         * In that case the normal Play button remains available.
         */
      });
    }
  }, [video.src]);

  /* ==========================================================
     VIDEO EVENTS
     ========================================================== */

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);

    if (videoRef.current?.currentTime === 0) {
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handleLoadedMetadata = () => {
    const element = videoRef.current;

    if (!element) return;

    if (Number.isFinite(element.duration)) {
      setDuration(element.duration);
    }

    setMetadataLoaded(true);

    const {
      videoWidth,
      videoHeight,
    } = element;

    setIsVertical(videoHeight > videoWidth);
  };

  const handleTimeUpdate = () => {
    const element = videoRef.current;

    if (!element || !element.duration) return;

    const current = element.currentTime;

    const dur = element.duration;

    setCurrentTime(current);

    setDuration(dur);

    setProgress((current / dur) * 100);
  };

  const handleSeek = (value: number) => {
    const element = videoRef.current;

    if (!element || !element.duration) return;

    const newTime =
      (value / 100) * element.duration;

    element.currentTime = newTime;

    setCurrentTime(newTime);

    setProgress(value);
  };

  const togglePlay = () => {
    const element = videoRef.current;

    if (!element) return;

    if (element.paused) {
      const playPromise = element.play();

      if (playPromise) {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    } else {
      element.pause();
    }
  };

  /* ==========================================================
     LIKE BURST
     ========================================================== */

  const triggerLikeBurst = () => {
    if (likeBurstTimeoutRef.current !== null) {
      window.clearTimeout(
        likeBurstTimeoutRef.current
      );
    }

    setLikeBurstVisible(true);

    likeBurstTimeoutRef.current =
      window.setTimeout(() => {
        setLikeBurstVisible(false);

        likeBurstTimeoutRef.current = null;
      }, 550);
  };

  /* ==========================================================
     LIKE
     ========================================================== */

  const handleToggleLike = async () => {
    if (!isLoggedIn) {
      setShowLikeAuthTooltip(true);

      return;
    }

    /*
     * Sponsored content.
     */
    if (isSponsored) {
      if (!adIdNum) return;

      const nextLiked = !liked;

      setLikeLoading(true);

      setLiked(nextLiked);

      setLikes((previous) =>
        nextLiked
          ? previous + 1
          : Math.max(0, previous - 1)
      );

      if (nextLiked) {
        triggerLikeBurst();
      }

      try {
        const result =
          await toggleAdLike(adIdNum);

        if (result.liked !== nextLiked) {
          setLiked(result.liked);
        }

        if (result.likeCount != null) {
          setLikes(result.likeCount);
        }
      } catch (error) {
        console.error(
          "toggleAdLike error",
          error
        );

        setLiked(!nextLiked);

        setLikes((previous) =>
          !nextLiked
            ? previous + 1
            : Math.max(0, previous - 1)
        );
      } finally {
        setLikeLoading(false);
      }

      return;
    }

    /*
     * Normal media.
     */
    if (!mediaIdNum || Number.isNaN(mediaIdNum)) {
      setLiked((previous) => !previous);

      return;
    }

    const nextLiked = !liked;

    setLikeLoading(true);

    setLiked(nextLiked);

    setLikes((previous) =>
      nextLiked
        ? previous + 1
        : Math.max(0, previous - 1)
    );

    if (nextLiked) {
      triggerLikeBurst();
    }

    try {
      const result =
        await toggleMediaLike(mediaIdNum);

      if (result.liked !== nextLiked) {
        setLiked(result.liked);

        /*
         * Reconcile count if backend disagrees.
         */
        setLikes((previous) =>
          result.liked
            ? previous + 1
            : Math.max(0, previous - 1)
        );
      }
    } catch (error) {
      console.error(
        "toggleMediaLike error",
        error
      );

      setLiked(!nextLiked);

      setLikes((previous) =>
        !nextLiked
          ? previous + 1
          : Math.max(0, previous - 1)
      );
    } finally {
      setLikeLoading(false);
    }
  };

  /* ==========================================================
     DOUBLE CLICK / SINGLE CLICK
     ========================================================== */

  const handleDoubleLike = () => {
    void handleToggleLike();
  };

  const handleOverlayClick = () => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(
        clickTimeoutRef.current
      );

      clickTimeoutRef.current = null;

      handleDoubleLike();

      return;
    }

    clickTimeoutRef.current =
      window.setTimeout(() => {
        togglePlay();

        clickTimeoutRef.current = null;
      }, 250);
  };

  /* ==========================================================
     FULLSCREEN
     ========================================================== */

  const handleFullscreen = async () => {
    /*
     * Allow the parent to know fullscreen was requested.
     */
    onRequestFullscreen?.();

    const element = cardRef.current;

    if (!element) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();

        setMaximize(false);

        return;
      }

      if (element.requestFullscreen) {
        await element.requestFullscreen();

        setMaximize(true);

        return;
      }
    } catch (error) {
      console.error(
        "Fullscreen request failed:",
        error
      );
    }

    /*
     * Fallback for browsers exposing webkit fullscreen
     * on the video element.
     */
    const videoElement = videoRef.current as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
        })
      | null;

    try {
      videoElement?.webkitEnterFullscreen?.();

      setMaximize(true);
    } catch (error) {
      console.error(
        "webkit fullscreen request failed:",
        error
      );
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active =
        document.fullscreenElement ===
        cardRef.current;

      setMaximize(active);
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  /* ==========================================================
     COMMENTS
     ========================================================== */

  useEffect(() => {
    if (!commentsOpen || !mediaIdNum) return;

    setCommentsLoading(true);

    setCommentsError(null);

    (async () => {
      try {
        const data =
          await fetchCommentsForMedia(
            mediaIdNum
          );

        setComments(data);
      } catch (error) {
        console.error(
          "fetchCommentsForMedia error",
          error
        );

        setCommentsError(
          "Failed to load comments."
        );
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [commentsOpen, mediaIdNum]);

  const handleSubmitComment = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!mediaIdNum || !newComment.trim()) {
      return;
    }

    setSendCommentLoading(true);

    try {
      const updated =
        await addCommentForMedia({
          mediaId: mediaIdNum,
          text: newComment.trim(),
          parentId: replyTo?.id ?? null,
        });

      setComments(updated);

      setNewComment("");

      setReplyTo(null);

      setCommentsError(null);
    } catch (error: any) {
      console.error(
        "addCommentForMedia error",
        error
      );

      setCommentsError(
        error?.message ??
          "Failed to post comment."
      );
    } finally {
      setSendCommentLoading(false);
    }
  };

  const handleToggleCommentLike = async (
    commentId: string
  ) => {
    if (!mediaIdNum) return;

    try {
      const updated =
        await toggleCommentLikeForMedia(
          mediaIdNum,
          commentId
        );

      setComments(updated);
    } catch (error) {
      console.error(
        "toggleCommentLikeForMedia error",
        error
      );

      setCommentsError(
        "Failed to like comment."
      );
    }
  };

  const handleReplyStart = (
    comment: CommentNode
  ) => {
    setReplyTo({
      id: comment.id,
      username: comment.username,
    });
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  /* ==========================================================
     LIKE AUTH TOOLTIP
     ========================================================== */

  useEffect(() => {
    if (!showLikeAuthTooltip) return;

    const timeout = window.setTimeout(() => {
      setShowLikeAuthTooltip(false);
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showLikeAuthTooltip]);

  /* ==========================================================
     LOADING
     ========================================================== */

  const showSkeleton = !metadataLoaded;

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div
      ref={cardRef}
      className={`
        relative
        w-full
        h-full
        min-h-0
        flex
        items-center
        justify-center
        bg-neutral-900
        overflow-hidden
        ${maximize ? "fixed inset-0 z-[9999]" : ""}
        ${className}
      `}
    >
      {/* ======================================================
          VIDEO
          ====================================================== */}

      <div className="relative h-full w-full flex items-center justify-center">
        {/* Skeleton */}
        {showSkeleton && (
          <div className="absolute inset-0 z-[1] bg-neutral-800 animate-pulse" />
        )}

        <video
          ref={videoRef}
          src={video.src}
          preload="auto"
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          loop
          playsInline
          className={`
            relative
            z-[2]
            max-h-full
            max-w-full
            object-contain
            bg-black
            transition-opacity
            duration-300
            ${
              metadataLoaded
                ? "opacity-100"
                : "opacity-0"
            }
            ${
              isVertical
                ? "h-full w-auto"
                : "h-full w-full"
            }
          `}
        />
      </div>

      {/* ======================================================
          HEART BURST
          ====================================================== */}

      {likeBurstVisible && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart
            className="
              h-24
              w-24
              fill-red-500
              text-red-500
              like-burst
              drop-shadow-[0_0_18px_rgba(248,113,113,1)]
            "
          />
        </div>
      )}

      {/* ======================================================
          SINGLE CLICK / DOUBLE CLICK OVERLAY
          ====================================================== */}

      <button
        type="button"
        onClick={handleOverlayClick}
        aria-label={
          isPlaying
            ? "Pause video"
            : "Play video"
        }
        className="
          absolute
          inset-0
          z-10
          flex
          items-center
          justify-center
          focus:outline-none
        "
      >
        {!isPlaying && (
          <div
            className="
              rounded-full
              border
              border-white/60
              bg-black/60
              p-4
              text-white
            "
          >
            <Play className="h-8 w-8" />
          </div>
        )}
      </button>

      {/* ======================================================
          RIGHT ACTIONS
          ====================================================== */}

      <div
        className="
          absolute
          right-1
          bottom-15
          z-30
          flex
          flex-col
          items-center
          gap-4
        "
      >
        {/* Views */}

        <StatBubble
          label={formatAbbrev(
            video.views || 0
          )}
        >
          <Eye className="h-7 w-7" />
        </StatBubble>

        {/* Fullscreen */}

        {!isSponsored && (
          <>
            {open && onClose ? (
              <IconCircleButton
                onClick={onClose}
                label="Close fullscreen"
              >
                <Minimize2 className="h-7 w-7" />
              </IconCircleButton>
            ) : (
              <IconCircleButton
                onClick={handleFullscreen}
                label={
                  maximize
                    ? "Exit fullscreen"
                    : "Full screen"
                }
              >
                {maximize ? (
                  <Minimize2 className="h-7 w-7" />
                ) : (
                  <Maximize2 className="h-7 w-7" />
                )}
              </IconCircleButton>
            )}
          </>
        )}

        {/* Mute */}

        {!isSponsored &&
          toggleMute && (
            <IconCircleButton
              onClick={toggleMute}
              label={
                isMuted
                  ? "Unmute"
                  : "Mute"
              }
            >
              {isMuted ? (
                <VolumeX className="h-7 w-7" />
              ) : (
                <Volume2 className="h-7 w-7" />
              )}
            </IconCircleButton>
          )}

        {/* Like */}

        {!isSponsored && (
          <div className="relative flex flex-col items-center gap-1">
            <IconCircleButton
              onClick={handleToggleLike}
              label="Like"
              disabled={likeLoading}
            >
              <Heart
                className={`
                  h-7
                  w-7
                  ${
                    liked
                      ? "fill-red-500 text-red-500"
                      : ""
                  }
                `}
              />
            </IconCircleButton>

            <span className="text-[11px]">
              {formatAbbrev(likes || 0)}
            </span>

            {showLikeAuthTooltip && (
              <div
                className="
                  absolute
                  -top-8
                  max-w-[160px]
                  rounded-full
                  border
                  border-white/20
                  bg-black/90
                  px-3
                  py-1
                  text-center
                  text-[10px]
                  text-white
                  shadow-lg
                "
              >
                Log in to like videos
              </div>
            )}
          </div>
        )}

        {/* Comments */}

        {!isSponsored && (
          <div className="flex flex-col items-center gap-1">
            <IconCircleButton
              onClick={() =>
                setCommentsOpen(true)
              }
              label="Comments"
            >
              <MessageCircle className="h-7 w-7" />
            </IconCircleButton>

            <span className="text-[11px]">
              {formatAbbrev(
                totalComments || 0
              )}
            </span>
          </div>
        )}

        {/* More options */}

        {!isSponsored && (
          <IconCircleButton
            label="More options"
            onClick={() =>
              setOptionsOpen(true)
            }
          >
            <EllipsisIcon className="h-7 w-7" />
          </IconCircleButton>
        )}
      </div>

      {/* ======================================================
          BOTTOM INFORMATION
          ====================================================== */}

      <div
        className="
          absolute
          inset-x-3
          bottom-3
          z-30
          space-y-2
        "
      >
        {/* Creator */}

        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${video.username}`}>
            <div
              className="
                h-10
                w-10
                shrink-0
                overflow-hidden
                rounded-full
                bg-white/60
              "
            >
              <Image
                src={
                  video.avatar ||
                  "/avatar-placeholder.png"
                }
                alt={`Goon Gram avatar by ${video.username}`}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          </Link>

          <Link
            href={`/${video.username}`}
            className="min-w-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-semibold text-white">
                {video.username}
              </div>

              {video.verified && (
                <VerifiedBadgeIcon />
              )}
            </div>
          </Link>

          {video.ownerId !== currentId && (
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={followLoading}
              className={`
                shrink-0
                rounded-full
                border
                px-3
                py-1.5
                text-xs
                font-semibold
                transition
                ${
                  isFollowing
                    ? "border-transparent bg-white text-black"
                    : "border-white/60 bg-black/50 text-white"
                }
              `}
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

        {/* Sponsored label */}

        {isSponsored && (
          <span
            className="
              inline-flex
              items-center
              rounded-full
              border
              border-yellow-400/60
              bg-yellow-400/10
              px-3
              py-0.5
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-yellow-300
            "
          >
            Sponsored
          </span>
        )}

        {/* Description */}

        <div className="text-xs text-white/85">
          <p
            className={`
              overflow-hidden
              transition-all
              ${
                expandedDesc
                  ? "max-h-24"
                  : "max-h-5"
              }
            `}
          >
            {video.description}{" "}

            {video.hashtags?.map(
              (tag, index) => (
                <Link
                  href={`/explore/niches/${labelToSlug(
                    tag
                  )}`}
                  key={`${tag}-${index}`}
                >
                  <span className="text-pink-500 underline">
                    #{tag}{" "}
                  </span>
                </Link>
              )
            )}
          </p>

          <button
            type="button"
            onClick={() =>
              setExpandedDesc(
                (previous) => !previous
              )
            }
            className="
              mt-0.5
              text-[11px]
              text-white/70
            "
          >
            Show{" "}
            {expandedDesc
              ? "less"
              : "more"}
          </button>
        </div>

        {/* Sponsored visit button */}

        {isSponsored && visitUrl && (
          <button
            type="button"
            onClick={() => {
              window.open(
                visitUrl,
                "_blank",
                "noopener,noreferrer"
              );

              startTransition(() => {
                void incrementAdClicks(
                  video.id
                );
              });
            }}
            className="
              mt-3
              inline-flex
              h-10
              w-full
              items-center
              justify-center
              gap-2
              rounded-full
              bg-pink-500
              px-4
              py-1.5
              text-[20px]
              font-semibold
              text-white
              hover:bg-white/90
              hover:text-black
            "
          >
            Visit Page

            <ArrowUpRightFromSquare
              size={20}
            />
          </button>
        )}

        {/* Scrubber */}

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(event) =>
              handleSeek(
                Number(event.target.value)
              )
            }
            aria-label="Video progress"
            className="
              h-1
              w-full
              cursor-pointer
              appearance-none
              rounded-full
              bg-pink-500/40
              accent-pink-500
            "
          />

          <span
            className="
              min-w-[70px]
              text-right
              text-[11px]
              tabular-nums
            "
          >
            {formatTime(currentTime)} /{" "}
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* ======================================================
          GRADIENTS
          ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          bottom-0
          z-[5]
          h-40
          bg-gradient-to-t
          from-black
          via-pink/50
          to-transparent
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          z-[5]
          h-24
          bg-gradient-to-b
          from-pink/60
          to-transparent
        "
      />

      {/* ======================================================
          VIDEO OPTIONS
          ====================================================== */}

      {!isSponsored && (
        <div className="z-[200]">
          <VideoOptionsModal
            open={optionsOpen}
            onClose={() =>
              setOptionsOpen(false)
            }
            mediaId={
              mediaIdNum || video.id
            }
            videoUrl={video.src}
          />
        </div>
      )}

      {/* ======================================================
          COMMENTS
          ====================================================== */}

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
        onLikeComment={
          handleToggleCommentLike
        }
        onReplyStart={
          handleReplyStart
        }
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        sendCommentLoading={
          sendCommentLoading
        }
        onCancelReply={cancelReply}
      />
    </div>
  );
}

/* ============================================================
   ICON BUTTON
   ============================================================ */

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
  className = "",
  disabled = false,
}: IconCircleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        flex
        h-10
        w-10
        cursor-pointer
        items-center
        justify-center
        rounded-full
        text-lg
        text-white
        hover:bg-black/80
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${className}
      `}
    >
      {children}
    </button>
  );
}

/* ============================================================
   STAT BUBBLE
   ============================================================ */

function StatBubble({
  label,
  children,
}: {
  label: string | number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        rounded-full
        text-xs
        hover:bg-black/80
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          text-white
        "
      >
        {children}
      </div>

      <span className="mt-1 text-[11px]">
        {typeof label === "number"
          ? label.toLocaleString()
          : label}
      </span>
    </div>
  );
}

/* ============================================================
   COMMENTS COUNT
   ============================================================ */

function countComments(
  nodes: CommentNode[]
): number {
  return nodes.reduce(
    (sum, comment) =>
      sum +
      1 +
      countComments(
        comment.replies ?? []
      ),
    0
  );
}

/* ============================================================
   COMMENTS OVERLAY
   ============================================================ */

type CommentsOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  isDesktop: boolean;

  comments: CommentNode[];

  loading: boolean;

  error: string | null;

  newComment: string;

  setNewComment: (value: string) => void;

  onSubmit: (
    event: React.FormEvent<HTMLFormElement>
  ) => void;

  onLikeComment: (
    commentId: string
  ) => void;

  onReplyStart: (
    comment: CommentNode
  ) => void;

  replyTo: {
    id: string;
    username: string;
  } | null;

  setReplyTo: (
    value: {
      id: string;
      username: string;
    } | null
  ) => void;

  sendCommentLoading: boolean;

  onCancelReply: () => void;
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
  setReplyTo,
  sendCommentLoading,
  onCancelReply,
}: CommentsOverlayProps) {
  const content = (
    <div className="flex h-full flex-col">
      {/* Comments list */}

      <div
        className="
          flex-1
          space-y-3
          overflow-y-auto
          px-4
          py-3
        "
      >
        {loading && (
          <CommentListSkeleton />
        )}

        {!loading &&
          comments.length === 0 && (
            <p className="text-xs text-white/60">
              No comments yet.
            </p>
          )}

        {error && (
          <p className="text-xs text-red-400">
            {error}
          </p>
        )}

        <CommentList
          comments={comments}
          onLike={onLikeComment}
          onReply={onReplyStart}
        />
      </div>

      {/* Comment form */}

      <form
        onSubmit={onSubmit}
        className="
          space-y-2
          border-t
          border-white/10
          bg-black
          px-4
          py-3
        "
      >
        {replyTo && (
          <div
            className="
              flex
              items-center
              justify-between
              text-[11px]
              text-white/60
            "
          >
            <span>
              Replying to @{replyTo.username}
            </span>

            <button
              type="button"
              onClick={onCancelReply}
              className="hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newComment}
            onChange={(event) =>
              setNewComment(
                event.target.value
              )
            }
            placeholder={
              replyTo
                ? `Reply to @${replyTo.username}...`
                : "Add a comment..."
            }
            className="
              h-10
              border-white/30
              bg-black
              text-xs
              text-white
              placeholder:text-white/40
            "
          />

          <Button
            type="submit"
            size="sm"
            disabled={
              sendCommentLoading ||
              !newComment.trim()
            }
            className="
              h-10
              rounded-full
              bg-white
              px-4
              text-xs
              font-semibold
              text-black
              hover:bg-white/90
            "
          >
            {sendCommentLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  /* ==========================================================
     DESKTOP
     ========================================================== */

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent
          className="
            z-[100]
            w-full
            max-w-md
            border-white/10
            bg-black
            text-white
          "
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Comments
            </DialogTitle>
          </DialogHeader>

          <div className="h-96">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  /* ==========================================================
     MOBILE
     ========================================================== */

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
    >
      <DrawerContent
        className="
          z-[100]
          border-t
          border-white/10
          bg-black
          text-white
        "
      >
        <DrawerHeader>
          <DrawerTitle className="text-sm font-semibold">
            Comments
          </DrawerTitle>
        </DrawerHeader>

        <div className="h-[60vh]">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ============================================================
   COMMENT LIST
   ============================================================ */

function CommentList({
  comments,
  onLike,
  onReply,
  level = 0,
}: {
  comments: CommentNode[];
  onLike: (id: string) => void;
  onReply: (comment: CommentNode) => void;
  level?: number;
}) {
  if (!comments || comments.length === 0) {
    return null;
  }

  return (
    <div
      className={
        level > 0
          ? "space-y-2 border-l border-white/10 pl-4"
          : "space-y-2"
      }
    >
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="flex gap-2 text-xs"
        >
          {/* Avatar */}

          <div
            className="
              mt-1
              h-7
              w-7
              shrink-0
              overflow-hidden
              rounded-full
              bg-white/10
            "
          >
            {comment.avatar_path ? (
              <Link
                href={`/${comment.username}`}
              >
                <Image
                  src={comment.avatar_path}
                  alt={`Goon Gram Image by ${comment.username}`}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </Link>
            ) : null}
          </div>

          {/* Content */}

          <div className="flex-1 min-w-0">
            <Link
              href={`/${comment.username}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {comment.username}
                </span>

                {comment.verified && (
                  <VerifiedBadgeIcon />
                )}
              </div>
            </Link>

            <p className="mt-0.5 text-white/80">
              {comment.comment}
            </p>

            <div
              className="
                mt-1
                flex
                items-center
                gap-3
                text-[11px]
                text-white/60
              "
            >
              <button
                type="button"
                onClick={() =>
                  onLike(comment.id)
                }
                className="
                  inline-flex
                  items-center
                  gap-1
                  hover:text-white
                "
              >
                <Heart
                  className={`
                    h-3
                    w-3
                    ${
                      comment.liked_by &&
                      comment.liked_by.length > 0
                        ? "fill-red-500 text-red-500"
                        : ""
                    }
                  `}
                />

                <span>
                  {(
                    comment.likes ?? 0
                  ).toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onReply(comment)
                }
                className="hover:text-white"
              >
                Reply
              </button>
            </div>

            {/* Replies */}

            {comment.replies &&
              comment.replies.length > 0 && (
                <CommentList
                  comments={
                    comment.replies
                  }
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