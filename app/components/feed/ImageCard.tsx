// app/components/explore/ImageCard.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Eye, Heart } from "lucide-react";
import {
  checkHasLikedMedia,
  toggleMediaLike,
} from "@/lib/actions/social";
import { fetchImageById, ImageMedia, registerView } from "@/lib/actions/mediaFeed";

type Props = {
  mediaId: number;
  initialSrc?: string;
  initialViews?: number;
  fullscreen?: boolean; 
};

export default function ImageCard({ mediaId,
    initialSrc,
    initialViews,
    fullscreen = false,
    }: Props) {
  const [data, setData] = useState<ImageMedia | null>(null);
  const [loading, setLoading] = useState(true);

  const [views, setViews] = useState<number>(initialViews ?? 0);
  const [likes, setLikes] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [likeLoading, setLikeLoading] = useState(false);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [likeBurstVisible, setLikeBurstVisible] = useState(false);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const hasRegisteredViewRef = useRef(false);

  // ===== heart burst animation =====
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

  // ===== fetch image metadata =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchImageById(mediaId);
        if (!res || cancelled) return;

        setData(res);
        setViews(initialViews ?? res.views ?? 0);
        setLikes(res.likes ?? 0);

        if (res.likedByMe !== undefined) {
          setLiked(!!res.likedByMe);
        } else {
          const hasLiked = await checkHasLikedMedia(mediaId);
          if (!cancelled) setLiked(hasLiked);
        }
      } catch (err) {
        console.error("ImageCard fetchImageById error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId, initialViews]);

  // ===== register a view once per open =====
  useEffect(() => {
    if (!mediaId || Number.isNaN(mediaId)) return;
    if (hasRegisteredViewRef.current) return;

    hasRegisteredViewRef.current = true;
    setViews((prev) => (prev ?? 0) + 1);

    registerView(mediaId).catch((err) =>
      console.error("registerView(image) error", err)
    );
  }, [mediaId]);

  // ===== LIKE toggle (optimistic) =====
  const handleToggleLike = async () => {
    if (!mediaId || Number.isNaN(mediaId)) return;

    const nextLiked = !liked;
    setLikeLoading(true);
    setLiked(nextLiked);
    setLikes((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    if (nextLiked) triggerLikeBurst();

    try {
      const result = await toggleMediaLike(mediaId);
      if (result.liked !== nextLiked) {
        setLiked(result.liked);
        setLikes((prev) =>
          result.liked ? prev + 1 : Math.max(0, prev - 1)
        );
      }
    } catch (err) {
      console.error("toggleMediaLike(image) error", err);
      // revert
      setLiked(!nextLiked);
      setLikes((prev) =>
        !nextLiked ? prev + 1 : Math.max(0, prev - 1)
      );
    } finally {
      setLikeLoading(false);
    }
  };

  const src = data?.src ?? initialSrc ?? "";
  const username = data?.username ?? "Unknown";
  const avatar = data?.avatar ?? "/avatar-placeholder.png";
  const description = data?.description ?? "";
  const hashtags = data?.hashtags ?? [];

  const showSkeleton = !imgLoaded;

  return (
    <div
      className="
        relative lg:h-[100vh]
        h-[80vh]
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      "
    >
      <div
    className={
      fullscreen
        ? "relative w-full h-[85vh] flex items-center justify-center"
        : "relative w-full aspect-[3/4] flex items-center justify-center"
    }
  >
    {showSkeleton && (
      <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
    )}

    {src && (
      <Image
        src={src}
        alt={description || username}
        width={1600}           // just defines aspect ratio
        height={1600}
        sizes={
          fullscreen
            ? "(max-width:768px) 100vw, (max-width:1024px) 70vw, 50vw"
            : "(max-width:768px) 50vw, 33vw"
        }
        className={`
          h-full max-h-full w-auto object-contain
          transition-opacity duration-300
          ${imgLoaded ? "opacity-100" : "opacity-0"}
        `}
        onLoadingComplete={() => {
          setImgLoaded(true);
          // optionally also hide skeleton:
          // setShowSkeleton(false);
        }}
      />
    )}
  </div>

      {/* ❤️ LIKE BURST OVERLAY */}
      {likeBurstVisible && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 like-burst drop-shadow-[0_0_18px_rgba(248,113,113,1)]" />
        </div>
      )}

      {/* right-side actions */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
        <StatBubble label={views.toLocaleString()}>
          <Eye className="h-7 w-7" />
        </StatBubble>

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
      </div>

      {/* bottom info */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
        {/* creator row */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
            <Image
              src={avatar}
              alt={username}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {username}
            </div>
          </div>
        </div>

        {/* description + tags */}
        <div className="text-xs text-white/85">
          <p
            className={`overflow-hidden transition-all ${
              expandedDesc ? "max-h-24" : "max-h-5"
            }`}
          >
            {description}{" "}
            {hashtags.map((tag) => (
              <span key={tag} className="text-white/70">
                #{tag}{" "}
              </span>
            ))}
          </p>
          {description || hashtags.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpandedDesc((p) => !p)}
              className="mt-0.5 text-[11px] text-white/70"
            >
              Show {expandedDesc ? "less" : "more"}
            </button>
          ) : null}
        </div>
      </div>

      {/* gradients */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
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
