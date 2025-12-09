// lib/client/watermarkVideo.ts
"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFfmpeg(
  onProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance) {
    if (onProgress && (ffmpegInstance as any).setProgress) {
      (ffmpegInstance as any).setProgress(({ ratio }: { ratio: number }) => {
        onProgress(ratio);
      });
    }
    return ffmpegInstance;
  }

  if (!ffmpegLoading) {
    const ff = createFFmpeg({ log: true });
    ffmpegLoading = (async () => {
      if (!ff.isLoaded()) {
        await ff.load();
      }
      if (onProgress && (ff as any).setProgress) {
        (ff as any).setProgress(({ ratio }: { ratio: number }) => {
          onProgress(ratio);
        });
      }
      ffmpegInstance = ff;
      return ff;
    })();
  }

  return ffmpegLoading;
}

// ---- same canvas logic you liked on /watermark ------------------

async function createWatermarkPngBytes(
  username: string,
  baseLogoUrl: string
): Promise<Uint8Array> {
  const tag = username.startsWith("@") ? username : `@${username}`;

  const img = new Image();
  img.src = baseLogoUrl;
  img.crossOrigin = "anonymous";
  await img.decode();

  const paddingX = 10;
  const paddingY = 6;
  const gapLogoText = 4; // ← controls distance between logo + username
  const textHeight = 12;

  const width = img.width + paddingX * 2;
  const height = img.height + paddingY * 2 + gapLogoText + textHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  ctx.clearRect(0, 0, width, height);

  const radius = 12;
  ctx.fillStyle = "rgba(255, 255, 255, 0)";
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();

  const logoX = (width - img.width) / 2;
  const logoY = paddingY;
  ctx.drawImage(img, logoX, logoY);

  ctx.font =
    "bold 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 4;

  const textY = logoY + img.height + gapLogoText + textHeight / 2;
  ctx.fillText(tag, width / 2, textY);

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

function getOverlayFilter(pos: WatermarkPosition) {
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

// Main helper: takes a File, returns a *new* File with watermark
export async function watermarkVideoFile(
  file: File,
  username: string,
  opts?: {
    position?: WatermarkPosition;
    logoUrl?: string;
    onProgress?: (ratio: number) => void; // 0..1
  }
): Promise<File> {
  const ffmpeg = await getFfmpeg(opts?.onProgress);
  const position = opts?.position ?? "bottom-right";
  const logoUrl = opts?.logoUrl ?? "/watermark-1.png";

  // Clean up old files if they exist
  ["input.mp4", "wm.png", "output.mp4"].forEach((name) => {
    try {
      ffmpeg.FS("unlink", name);
    } catch {
      // ignore
    }
  });

  ffmpeg.FS("writeFile", "input.mp4", await fetchFile(file));
  const wmBytes = await createWatermarkPngBytes(username.trim(), logoUrl);
  ffmpeg.FS("writeFile", "wm.png", wmBytes);

  const overlayFilter = getOverlayFilter(position);

  await ffmpeg.run(
    "-i",
    "input.mp4",
    "-i",
    "wm.png",
    "-filter_complex",
    "[0:v]scale=-2:720,fps=30[v0];[v0][1:v]" + overlayFilter,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-c:a",
    "copy",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");
  const outName =
    file.name.replace(/\.[^.]+$/, "") + "-wm" + (file.name.match(/\.[^.]+$/) ?? [".mp4"])[0];

  return new File([data.buffer], outName, { type: "video/mp4" });
}
