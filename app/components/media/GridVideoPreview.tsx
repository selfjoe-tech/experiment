"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "@/app/components/media/useInView";

/* -------------------- Device tuning (lazy) -------------------- */

type DeviceTuning = {
  mem: number;
  saveData: boolean;
  effectiveType: string;
  lowEnd: boolean;
  maxThumbs: number;
  concurrency: number;
  defaultThumbSize: number;
  scrollIdleMs: number;
};

let TUNING: DeviceTuning | null = null;

function getTuning(): DeviceTuning {
  if (TUNING) return TUNING;

  const mem = (typeof navigator !== "undefined" && (navigator as any).deviceMemory) ? (navigator as any).deviceMemory : 4;
  const conn = (typeof navigator !== "undefined" && (navigator as any).connection) ? (navigator as any).connection : null;
  const saveData = !!conn?.saveData;
  const effectiveType = String(conn?.effectiveType ?? "");

  const lowEnd = mem <= 2 || saveData || /2g|slow-2g/i.test(effectiveType);

  // Keep cache smaller on mobile/low-end to reduce memory spikes
  const maxThumbs = lowEnd ? 60 : mem >= 8 ? 200 : mem >= 4 ? 130 : 90;

  // Concurrency is a big source of OOM on mobile: keep conservative
  const concurrency = lowEnd ? 1 : mem >= 8 ? 3 : mem >= 4 ? 2 : 1;

  // Smaller thumbs = much faster canvas + blob encode
  const defaultThumbSize = lowEnd ? 160 : 192;

  TUNING = {
    mem,
    saveData,
    effectiveType,
    lowEnd,
    maxThumbs,
    concurrency,
    defaultThumbSize,
    scrollIdleMs: 140,
  };

  return TUNING;
}

/* -------------------- Thumb cache (Map = LRU by insertion order) -------------------- */

const THUMB_CACHE = new Map<string, string>(); // key -> objectURL
const THUMB_FAIL = new Set<string>(); // permanent failures (CORS / tainted canvas etc.)

function cacheGet(key: string) {
  const url = THUMB_CACHE.get(key);
  if (!url) return null;

  // bump: delete+set keeps it "most recent"
  THUMB_CACHE.delete(key);
  THUMB_CACHE.set(key, url);
  return url;
}

function cacheSet(key: string, url: string) {
  if (THUMB_CACHE.has(key)) return;

  THUMB_CACHE.set(key, url);

  const { maxThumbs } = getTuning();

  // evict oldest
  while (THUMB_CACHE.size > maxThumbs) {
    const oldestKey = THUMB_CACHE.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const u = THUMB_CACHE.get(oldestKey);
    if (u) URL.revokeObjectURL(u);
    THUMB_CACHE.delete(oldestKey);
  }
}

/* -------------------- Global scroll-idle monitor (one listener) -------------------- */

let SCROLL_INIT = false;
let SCROLL_IDLE = true;
let SCROLL_TIMER: number | null = null;
const SCROLL_SUBS = new Set<(idle: boolean) => void>();

function notifyScroll(idle: boolean) {
  for (const fn of SCROLL_SUBS) fn(idle);
}

function ensureScrollMonitor() {
  if (SCROLL_INIT) return;
  if (typeof window === "undefined") return;

  SCROLL_INIT = true;
  const { scrollIdleMs } = getTuning();

  const onScroll = () => {
    if (SCROLL_IDLE) {
      SCROLL_IDLE = false;
      notifyScroll(false);
    }
    if (SCROLL_TIMER) window.clearTimeout(SCROLL_TIMER);
    SCROLL_TIMER = window.setTimeout(() => {
      SCROLL_IDLE = true;
      notifyScroll(true);
    }, scrollIdleMs);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
}

function subscribeScrollIdle(fn: (idle: boolean) => void) {
  ensureScrollMonitor();
  SCROLL_SUBS.add(fn);
  fn(SCROLL_IDLE);
  return () => SCROLL_SUBS.delete(fn);
}

/* -------------------- Helpers (abortable once) -------------------- */

function once(
  el: EventTarget,
  event: string,
  opts?: { timeoutMs?: number; signal?: AbortSignal }
) {
  const timeoutMs = opts?.timeoutMs ?? 3500;
  const signal = opts?.signal;

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const t = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      window.clearTimeout(t);
      el.removeEventListener(event, onEvent as any);
      if (signal) signal.removeEventListener("abort", onAbort as any);
    };

    el.addEventListener(event, onEvent as any, { once: true });
    if (signal) signal.addEventListener("abort", onAbort as any, { once: true });
  });
}

function drawCoverSquare(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  size: number
) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;

  const side = Math.min(vw, vh);
  const sx = Math.floor((vw - side) / 2);
  const sy = Math.floor((vh - side) / 2);

  ctx.imageSmoothingEnabled = true;
  // faster on mobile; "high" looks nicer but costs more
  // @ts-ignore
  ctx.imageSmoothingQuality = "low";

  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
}

async function blobFromCanvas(canvas: HTMLCanvasElement, quality = 0.7) {
  // WebP first (smaller + often faster). Fallback to JPEG.
  try {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/webp",
        quality
      );
    });
  } catch {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality
      );
    });
  }
}

/* -------------------- Worker pool (reuses video + canvas) -------------------- */

type ThumbTask = {
  key: string;
  src: string;
  thumbSize: number;
  seekSeconds: number;
  signal: AbortSignal;
  resolve: (url: string) => void;
  reject: (err: any) => void;
};

type Worker = {
  busy: boolean;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

const WORKERS: Worker[] = [];
const QUEUE: ThumbTask[] = [];
const PENDING_KEYS = new Set<string>();
let PUMPING = false;

function ensureWorkers(count: number) {
  if (typeof document === "undefined") return;
  while (WORKERS.length < count) {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    // @ts-ignore
    v.setAttribute("webkit-playsinline", "true");
    v.preload = "metadata";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) break;

    WORKERS.push({ busy: false, video: v, canvas, ctx });
  }
}

function currentLimit() {
  const { concurrency } = getTuning();
  return Math.max(1, concurrency);
}

async function runTask(worker: Worker, task: ThumbTask) {
  const { src, thumbSize, seekSeconds, signal } = task;
  const v = worker.video;
  const canvas = worker.canvas;
  const ctx = worker.ctx;

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // reset canvas to desired size (reused element)
  canvas.width = thumbSize;
  canvas.height = thumbSize;

  // load src
  v.pause();
  v.removeAttribute("src");
  v.load();

  v.src = src;
  v.load();

  await once(v, "loadedmetadata", { timeoutMs: 3500, signal });

  const dur = Number.isFinite(v.duration) ? v.duration : 0;
  const safeT =
    dur > 0 ? Math.min(Math.max(seekSeconds, 0), Math.max(0, dur - 0.08)) : 0;

  // If near zero, don't force an expensive seek on some devices
  if (safeT > 0.01) {
    try {
      v.currentTime = safeT;
    } catch {
      const p = v.play();
      if (p) await p.catch(() => {});
      v.pause();
      v.currentTime = safeT;
    }
  }

  const anyV = v as any;
  if (typeof anyV.requestVideoFrameCallback === "function") {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      anyV.requestVideoFrameCallback(() => resolve());
    });
  } else {
    // fallback
    await once(v, safeT > 0.01 ? "seeked" : "loadeddata", { timeoutMs: 3500, signal })
      .catch(async () => {
        // last resort: play/pause to force a frame
        const p = v.play();
        if (p) await p.catch(() => {});
        v.pause();
      });
  }

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // draw frame
  ctx.clearRect(0, 0, thumbSize, thumbSize);
  drawCoverSquare(ctx, v, thumbSize);

  // encode blob
  const blob = await blobFromCanvas(canvas, 0.68);

  // cleanup video resource ASAP
  v.pause();
  v.removeAttribute("src");
  v.load();

  return URL.createObjectURL(blob);
}

function pumpQueue() {
  if (PUMPING) return;
  PUMPING = true;

  queueMicrotask(async () => {
    try {
      while (true) {
        const limit = currentLimit();
        ensureWorkers(limit);

        const worker = WORKERS.find((w) => !w.busy);
        if (!worker) break;

        const task = QUEUE.shift();
        if (!task) break;

        PENDING_KEYS.delete(task.key);

        // skip if aborted before starting
        if (task.signal.aborted) {
          task.reject(new DOMException("Aborted", "AbortError"));
          continue;
        }

        worker.busy = true;

        runTask(worker, task)
          .then((url) => task.resolve(url))
          .catch((err) => task.reject(err))
          .finally(() => {
            worker.busy = false;
            pumpQueue(); // continue draining
          });
      }
    } finally {
      PUMPING = false;
    }
  });
}

function enqueueThumb(task: Omit<ThumbTask, "resolve" | "reject">) {
  return new Promise<string>((resolve, reject) => {
    if (THUMB_CACHE.has(task.key)) {
      resolve(cacheGet(task.key)!);
      return;
    }
    if (THUMB_FAIL.has(task.key)) {
      reject(new Error("Thumb previously failed"));
      return;
    }
    if (PENDING_KEYS.has(task.key)) {
      // Another tile already queued it; poll cache soon-ish
      const t = window.setTimeout(() => {
        const cached = cacheGet(task.key);
        if (cached) resolve(cached);
        else reject(new Error("Queued elsewhere"));
      }, 250);
      task.signal.addEventListener("abort", () => window.clearTimeout(t), { once: true });
      return;
    }

    PENDING_KEYS.add(task.key);
    QUEUE.push({
      ...task,
      resolve,
      reject,
    });
    pumpQueue();
  });
}

/* -------------------- requestIdleCallback helper -------------------- */

function scheduleWhenIdle(fn: () => void) {
  if (typeof window === "undefined") return { cancel: () => {} };

  const w = window as any;

  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(fn, { timeout: 900 });
    return { cancel: () => w.cancelIdleCallback?.(id) };
  }

  const t = window.setTimeout(fn, 120);
  return { cancel: () => window.clearTimeout(t) };
}

/* -------------------- Component -------------------- */

type Props = {
  src: string;
  className?: string;

  /** play the real video on hover */
  hoverPlay?: boolean;

  /** stable key for caching/budgeting */
  cacheKey?: string;

  /** thumbnail options */
  thumbSize?: number;   // if omitted, device-tuned default
  seekSeconds?: number; // default 0.05

  /** optional fallback image if thumb fails */
  fallbackPoster?: string;
};

export default function GridVideoPreview({
  src,
  className = "",
  hoverPlay = true,
  cacheKey,
  thumbSize,
  seekSeconds = 0.05,
  fallbackPoster,
}: Props) {
  const key = useMemo(() => cacheKey ?? src, [cacheKey, src]);
  const tuning = getTuning();

  const finalThumbSize = thumbSize ?? tuning.defaultThumbSize;

  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // stricter in-view so we don’t generate for barely-visible tiles
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });

  const [isScrollIdle, setIsScrollIdle] = useState(true);
  useEffect(() => subscribeScrollIdle(setIsScrollIdle), []);

  const [hovering, setHovering] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => cacheGet(key));
  const [thumbFailed, setThumbFailed] = useState<boolean>(() => THUMB_FAIL.has(key));

  // Generate thumbnail ONLY when:
  // - tile is in view
  // - scroll is idle
  // - not already cached
  useEffect(() => {
    let cancelled = false;
    if (!src) return;
    if (!inView) return;
    if (!isScrollIdle) return;
    if (thumbUrl) return;
    if (thumbFailed) return;

    // if it was cached by another tile meanwhile
    const cached = cacheGet(key);
    if (cached) {
      setThumbUrl(cached);
      return;
    }
    if (THUMB_FAIL.has(key)) {
      setThumbFailed(true);
      return;
    }

    // Don’t burn CPU in background tabs
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const ac = new AbortController();

    const scheduled = scheduleWhenIdle(() => {
      enqueueThumb({
        key,
        src,
        thumbSize: finalThumbSize,
        seekSeconds,
        signal: ac.signal,
      })
        .then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          cacheSet(key, url);
          setThumbUrl(url);
        })
        .catch((e) => {
          if (cancelled) return;

          // Only mark permanent failures for CORS/taint issues.
          const msg = String(e?.message ?? "");
          const name = String(e?.name ?? "");

          const isAbort = name === "AbortError";
          const looksLikeCors =
            name === "SecurityError" ||
            /tainted|cross-origin|SecurityError/i.test(msg);

          if (!isAbort && looksLikeCors) {
            THUMB_FAIL.add(key);
            setThumbFailed(true);
          } else if (!isAbort) {
            // transient errors: do NOT permanently fail, just leave placeholder
            console.warn("thumb generation transient failure", e);
          }
        });
    });

    return () => {
      cancelled = true;
      ac.abort();
      scheduled.cancel();
    };
  }, [src, key, inView, isScrollIdle, thumbUrl, thumbFailed, finalThumbSize, seekSeconds]);

  // Real hover video element (only mounted when hovering)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!canHover) return;
    if (!hoverPlay) return;

    const el = videoRef.current;
    if (!el) return;

    if (hovering) {
      const p = el.play();
      p?.catch(() => {});
    } else {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {}
    }
  }, [hovering, canHover, hoverPlay]);

  const showVideo = canHover && hovering;

  return (
    <div
      ref={ref}
      className={`relative w-full h-full ${className}`}
      onMouseEnter={canHover ? () => setHovering(true) : undefined}
      onMouseLeave={canHover ? () => setHovering(false) : undefined}
    >
      {/* Off-hover thumbnail */}
      {!showVideo && (
        <>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : fallbackPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackPoster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
        </>
      )}

      {/* On-hover real video */}
      {showVideo && (
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          loop
        />
      )}
    </div>
  );
}
