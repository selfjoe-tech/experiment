// app/components/embed/EmbedVideoCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { Eye, Play, Volume2, VolumeX, EllipsisIcon } from "lucide-react";
import type { Video } from "@/app/components/feed/types";
import VideoOptionsModal from "@/app/components/feed/VideoOptionsModal";

type Props = {
  video: Video;
  isMuted?: boolean;
  toggleMute?: () => void;
};

export default function EmbedVideoCard({
  video,
  isMuted = true,
  toggleMute,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [isVertical, setIsVertical] = useState<boolean | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const mediaIdNum = Number(video.mediaId ?? video.id);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  };

  // keep muted state in sync
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = isMuted;
  }, [isMuted]);

  // autoplay once mounted
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const maybePlay = el.play();
    if (maybePlay) maybePlay.catch(() => setIsPlaying(false));
  }, []);

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

  // single vs double-click: double-click does nothing here (no likes)
  const handleOverlayClick = () => {
    if (clickTimeoutRef.current !== null) {
      // swallow double-click – in main feed this would like, but in embed we ignore
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      return;
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      togglePlay();
      clickTimeoutRef.current = null;
    }, 250);
  };

  const showSkeleton = !metadataLoaded;

  return (
    <Link
    href={`/watch/${encodeURIComponent(mediaIdNum)}`}
    
    >
    <div
      className="
        relative lg:h-[100vh]
        h-[80vh]
        flex items-center justify-center
        bg-neutral-900 shadow-5xl overflow-hidden
      "
    >
      <div className="relative h-full flex items-center justify-center text-white">
        {showSkeleton && (
          <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
        )}

        <video
          ref={videoRef}
          src={video.src}
          preload="metadata"
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

      {/* click overlay: play/pause only */}
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

      {/* right-side actions: views, ellipsis, mute (NO fullscreen, NO likes) */}
      <div className="absolute text-white right-3 bottom-24 z-30 flex flex-col items-center gap-4">
        <StatBubble label={video.views.toLocaleString()}>
          <Eye className="h-7 w-7" />
        </StatBubble>

        <IconCircleButton
          onClick={() => setOptionsOpen(true)}
          label="More options"
        >
          <EllipsisIcon className="h-7 w-7" />
        </IconCircleButton>

        <IconCircleButton onClick={toggleMute ?? (() => {})} label="Mute">
          {isMuted ? (
            <VolumeX className="h-7 w-7" />
          ) : (
            <Volume2 className="h-7 w-7" />
          )}
        </IconCircleButton>
      </div>

      {/* bottom info + scrubber */}
      <div className="absolute inset-x-3 bottom-3 z-30 space-y-2">
        {/* creator row */}
        <div className="flex items-center gap-3 text-white">
          <Link href={`/${video.username}`}>
            <div className="h-10 w-10 rounded-full bg-white/60 overflow-hidden">
              <Image
                src={video.avatar}
                alt={video.username}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </Link>

          <Link href={`/${video.username}`}>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {video.username}
              </div>
            </div>
          </Link>
        </div>

        {/* description */}
        <div className="text-xs text-white/85">
          <p
            className={`overflow-hidden transition-all ${
              expandedDesc ? "max-h-24" : "max-h-5"
            }`}
          >
            {video.description}{" "}
            {video.hashtags.map((tag) => (
              <span key={tag} className="text-pink-500">
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
          <span className="text-[11px] text-white tabular-nums min-w-[70px] text-right">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* gradients */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

      {/* Options modal (Embed / Share / Report) */}
      <VideoOptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        mediaId={mediaIdNum || video.id}
      />
    </div>    

    </Link>

  );
}

type IconCircleButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
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
