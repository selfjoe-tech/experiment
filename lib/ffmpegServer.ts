// lib/ffmpegServer.ts
import fs from "fs";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

/**
 * Resolve a usable ffmpeg binary path for the current runtime.
 * Works locally *and* in production (different machines, same code).
 */
export function getFfmpegPath(): string {
  const candidates: string[] = [];

  // 1) Highest priority: env var (per-env override)
  if (process.env.FFMPEG_PATH) {
    candidates.push(process.env.FFMPEG_PATH);
  }

  // 2) Next: ffmpeg-static's path, if it looks real
  if (typeof ffmpegStatic === "string") {
    candidates.push(ffmpegStatic);
  }

  // 3) Fallback: derive from current working dir + node_modules
  const localFromCwd = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  candidates.push(localFromCwd);

  // 4) Last resort: rely on "ffmpeg" in PATH
  candidates.push("ffmpeg");

  // Pick the first candidate that actually exists (or is "ffmpeg")
  for (const cand of candidates) {
    if (!cand) continue;

    // "ffmpeg" itself may not be checkable via fs, but is fine as final fallback
    if (cand === "ffmpeg") {
      return cand;
    }

    try {
      if (fs.existsSync(cand)) {
        return cand;
      }
    } catch {
      // ignore and keep trying
    }
  }

  // If all else somehow fails, still return "ffmpeg"
  return "ffmpeg";
}
