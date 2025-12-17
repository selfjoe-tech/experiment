// app/watermark/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export default function WatermarkPage() {
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const [ready, setReady] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("UpskirtCandy");
  const [username, setUsername] = useState("nano");
  const [position, setPosition] = useState<Position>("bottom-right");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0); // <-- progress state

  // Load ffmpeg once
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ffmpeg = createFFmpeg({ log: true });
        ffmpegRef.current = ffmpeg;

        if (!ffmpeg.isLoaded()) {
          await ffmpeg.load();
        }

        // Hook into ffmpeg progress (ratio 0..1)
        (ffmpeg as any).setProgress?.(
          ({ ratio }: { ratio: number }) => {
            if (!cancelled) {
              setProgress(Math.min(100, Math.round(ratio * 100)));
            }
          }
        );

        if (!cancelled) setReady(true);
      } catch (err: any) {
        console.error("Error loading ffmpeg", err);
        if (!cancelled) setError(err?.message ?? "Failed to load ffmpeg");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setOutputUrl(null);
      setError(null);
      setProgress(0);
    }
  };

  // --- Canvas-based watermark generator (icon + text) ---

 async function createWatermarkPngBytes(
  username: string,
  baseLogoUrl: string
): Promise<Uint8Array> {
  const tag = username.startsWith("@") ? username : `@${username}`;

  // 1) load base logo image
  const img = new Image();
  img.src = baseLogoUrl;
  img.crossOrigin = "anonymous"; // if needed
  await img.decode();

  // 2) decide canvas size
  const paddingX = 10;
  const paddingY = 6;
  const textHeight = 12; // px
  const width = img.width + paddingX * 2;
  const height = img.height + paddingY * 3 + textHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Optional: subtle rounded black backing behind everything
  const radius = 12;
  ctx.fillStyle = "rgba(255, 255, 255, 0)";
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();

  // 3) draw logo centered
  const logoX = (width - img.width) / 2;
  const logoY = paddingY;
  ctx.drawImage(img, logoX, logoY);

  // 4) draw @username text under logo
  ctx.font = "bold 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 4;

  const textY = logoY + img.height + paddingY + textHeight / 2;
  ctx.fillText(tag, width / 2, textY);

  // 5) export as PNG bytes
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

  function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const min = Math.min(w, h) / 2;
  if (r > min) r = min;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
  // Calculate overlay filter string based on position
  function getOverlayFilter(pos: Position) {
    switch (pos) {
      case "top-left":
        return "overlay=16:16";
      case "top-right":
        return "overlay=W-w-16:16";
      case "bottom-left":
        return "overlay=16:H-h-16";
      case "bottom-right":
      default:
        return "overlay=W-w-16:H-h-16";
    }
  }

  const handleProcess = async () => {
    if (!videoFile) {
      setError("Please select a video first.");
      return;
    }
    if (!ffmpegRef.current) {
      setError("FFmpeg not ready yet.");
      return;
    }

    setProcessing(true);
    setError(null);
    setOutputUrl(null);
    setProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;

      // write input video
      ffmpeg.FS("writeFile", "input.mp4", await fetchFile(videoFile));

      // create watermark image (icon + text)
      const wmBytes = await createWatermarkPngBytes(
        username.trim(),
        "/watermark-1.png"
      );

      ffmpeg.FS("writeFile", "wm.png", wmBytes);

      const overlayFilter = getOverlayFilter(position);

      await ffmpeg.run(
  "-i", "input.mp4",
  "-i", "wm.png",
  // 1) Downscale + lower FPS, then overlay watermark
  "-filter_complex", "[0:v]scale=-2:720,fps=30[v0];[v0][1:v]" + overlayFilter,
  // 2) Video codec & quality tweaks
  "-c:v", "libx264",     // H.264
  "-preset", "ultrafast", // faster encode, slightly bigger file / lower quality
  "-crf", "28",          // 23 = default, 28 = lower quality but much faster/smaller
  // 3) Audio handling: keep audio but don’t re-encode
  "-c:a", "copy",
  "output.mp4"
);

      const data = ffmpeg.FS("readFile", "output.mp4");
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setProgress(100);
    } catch (e: any) {
      console.error("Watermark error", e);
      setError(e?.message ?? "Failed to watermark video.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6 border border-white/15 rounded-2xl bg-[#050505]/80 p-6">
        <h1 className="text-xl font-semibold mb-2">Video Watermark</h1>

        {!ready && (
          <p className="text-sm text-white/60">
            Loading video engine… this might take a moment.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Settings */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/70">Website name</span>
            <input
              className="bg-black border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Your site name"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/70">Uploader username</span>
            <input
              className="bg-black border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nano"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/70">Watermark position</span>
            <select
              className="bg-black border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-500"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
            >
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/70">Video file</span>
            <input
              type="file"
              accept="video/*"
              onChange={onVideoChange}
              className="text-xs file:text-xs file:px-3 file:py-1.5 file:rounded-full file:bg-pink-500 file:text-black file:border-0 file:mr-2"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={!ready || !videoFile || processing}
          onClick={handleProcess}
          className="w-full rounded-full bg-pink-500 text-black font-semibold py-3 text-sm hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {processing ? "Adding watermark…" : "Add watermark"}
        </button>

        {/* Progress bar */}
        {(processing || progress > 0) && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-white/60">
              <span>Processing</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-500 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Output preview */}
        {outputUrl && (
          <div className="space-y-3 mt-4">
            <h2 className="text-sm font-semibold">Preview</h2>
            <video
              src={outputUrl}
              controls
              className="w-full max-h-[400px] rounded-lg border border-white/15 bg-black"
            />
            <a
              href={outputUrl}
              download="watermarked.mp4"
              className="inline-block text-sm underline underline-offset-4 text-pink-300"
            >
              Download watermarked video
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
