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
  EllipsisIcon
} from "lucide-react";
import type { Video } from "./types";
import {
  checkIsFollowing,
  toggleFollowUser,
  checkHasLikedMedia,
  toggleMediaLike,
} from "@/lib/actions/social";
import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";
import { getUserIdFromCookies } from "@/lib/actions/auth";


type Props = {
  video: Video;
  onRequestFullscreen?: () => void;
  /** hide when used inside the fullscreen overlay feed */
  showFullscreenButton?: boolean;
  isMuted?: boolean;
  toggleMute?: () => void;
};

export default function VideoCard({
  video,
  onRequestFullscreen,
  showFullscreenButton = true,
  isMuted,
  toggleMute,
}: Props) {
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

  const mediaIdNum = Number(video.mediaId ?? video.id);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [currentId, setCurrentId] = useState("")


  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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

    // if feed already told us likedByMe, trust that
    if (video.likedByMe !== undefined) {
      setLiked(!!video.likedByMe);
      return;
    }

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
  }, [mediaIdNum, video.likedByMe]);

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
    if (!mediaIdNum || Number.isNaN(mediaIdNum)) {
      // If we somehow don't have a media id, just do local toggle
      setLiked((prev) => !prev);
      return;
    }

    // optimistic update
    const nextLiked = !liked;
    setLikeLoading(true);
    setLiked(nextLiked);
    setLikes((prevLikes) =>
      nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
    );
    if (nextLiked) triggerLikeBurst();

    try {
      const result = await toggleMediaLike(mediaIdNum);
      // if backend disagrees, sync to it
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
        setLikes((prevLikes) =>
          result.liked ? prevLikes + 1 : Math.max(0, prevLikes - 1)
        );
      }
    } catch (err) {
      console.error("toggleMediaLike error", err);
      // revert
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

  useEffect(() => {
    (async () =>{
      const id = await getUserIdFromCookies()
      setCurrentId(id)
    })()
  })

  

  const showSkeleton = shouldLoad && !metadataLoaded;

  return (
    <div
      ref={cardRef}
      className="
        relative lg:h-[100vh]
        h-[80vh]
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      "
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

        

        <div className="flex flex-col items-center gap-1">
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
            {likes.toLocaleString()}
          </span>
        </div>

        <IconCircleButton
            onClick={() => setOptionsOpen(true)}
            label="More options"
        >
          <EllipsisIcon className="h-7 w-7" />
        </IconCircleButton>

      </div>

      {/* bottom info + scrubber */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
        {/* creator row */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${video.username}`}>
            <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
              <Image
                src={video.avatar ?? "/avatar-placeholder.png"}
                alt={video.username}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </Link>

          <Link href={`/profile/${video.username}`}>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {video.username}
              </div>
            </div>
          </Link>

    {video.ownerId !== currentId &&   
      <button
            type="button"
            onClick={() => handleFollowClick()}
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
    
    }
          



        </div>

        {/* description */}
        <div className="text-xs text-white/85">
          <p
            className={`overflow-hidden transition-all ${
              expandedDesc ? "max-h-24" : "max-h-5"
            }`}
          >
            {video.description}{" "}
            {video.hashtags?.map((tag) => (
              <span key={tag} className="text-white/70">
                #{tag}{" "}
              </span>
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
      <VideoOptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        mediaId={mediaIdNum || video.id}
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
