"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, Download, Play } from "lucide-react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

const ACCENT = "#F1FF5D";

// We keep a singleton ffmpeg instance so it only loads once per tab
const getFfmpeg = (() => {
  let ffmpegInstance: any | null = null;
  return () => {
    if (!ffmpegInstance) {
      ffmpegInstance = createFFmpeg({ log: true });
    }
    return ffmpegInstance;
  };
})();

export default function WatermarkLabClient() {
  const ffmpegRef = useRef<any | null>(null);

  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [username, setUsername] = useState("darknoir");

  // Load ffmpeg.wasm once on mount
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setFfmpegLoading(true);
        setFfmpegError(null);
        setLoadProgress("Loading FFmpeg core…");

        const ffmpeg = getFfmpeg();
        console.log(ffmpeg, "<----- ffmpeg")
        ffmpegRef.current = ffmpeg;
        console.log(ffmpegRef.current, "<---- ffmpegRef.current")


        if (!ffmpeg.isLoaded()) {
          console.log(ffmpeg.isLoaded, "reached ffmpeg.load()")
          await ffmpeg.load();
        }

        if (!cancelled) {
          setFfmpegReady(true);
          setLoadProgress("");
        }
      } catch (err: any) {
        console.error("Failed to load ffmpeg:", err);
        if (!cancelled) {
          setFfmpegError(
            err?.message ??
              "Failed to load ffmpeg. Open console for details."
          );
          setLoadProgress("");
        }
      } finally {
        if (!cancelled) setFfmpegLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // cleanup blob URLs
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [videoUrl, outputUrl]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      e.currentTarget.value = "";
      if (!f) return;

      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
        setOutputUrl(null);
      }

      setFile(f);
      setVideoUrl(URL.createObjectURL(f));
    },
    [videoUrl, outputUrl]
  );

  const handleBurn = useCallback(async () => {
    if (!file) return;

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !ffmpegReady) {
      alert("FFmpeg is not ready yet.");
      return;
    }

    try {
      setProcessing(true);
      setFfmpegError(null);

      // Clean previous files in virtual FS if they exist
      try {
        ffmpeg.FS("unlink", "input.mp4");
      } catch {}
      try {
        ffmpeg.FS("unlink", "output.mp4");
      } catch {}

      // Write input file
      const data = await fetchFile(file);
      ffmpeg.FS("writeFile", "input.mp4", data);

      const safeUser = username || "user";

      // Simple bottom-center watermark
      await ffmpeg.run(
        "-i",
        "input.mp4",
        "-vf",
        `drawtext=fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=10:text='@${safeUser}':x=(w-tw)/2:y=h-(2*lh)`,
        "-c:a",
        "copy",
        "-movflags",
        "faststart",
        "output.mp4"
      );

      const outData = ffmpeg.FS("readFile", "output.mp4");
      if (!outData || outData.length === 0) {
        throw new Error("ffmpeg produced an empty output file.");
      }

      if (outputUrl) URL.revokeObjectURL(outputUrl);
      const blob = new Blob([outData.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
    } catch (err: any) {
      console.error("Error while burning watermark", err);
      setFfmpegError(
        err?.message ??
          "Error while processing video. Check ffmpeg logs in the console."
      );
    } finally {
      setProcessing(false);
    }
  }, [file, ffmpegReady, outputUrl, username]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl rounded-3xl border border-white/15 bg-[#101010] p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Watermark Lab</h1>
          <span className="text-xs text-white/60">
            ffmpeg.wasm (local npm build)
          </span>
        </div>

        {/* FFmpeg status */}
        <div className="text-sm">
          {ffmpegLoading && (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{loadProgress || "Loading FFmpeg…"}</span>
              </div>
              <p className="text-xs text-white/50">
                First load can take a few seconds. It’s ~20–30&nbsp;MB and is
                cached by the browser.
              </p>
            </div>
          )}

          {!ffmpegLoading && ffmpegReady && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                Ready
              </span>
            </div>
          )}

          {ffmpegError && (
            <div className="space-y-2">
              <p className="text-xs text-red-400 whitespace-pre-line">
                {ffmpegError}
              </p>
            </div>
          )}
        </div>

        {/* Upload + username */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/40 bg-white/5 cursor-pointer text-sm font-medium">
            <Upload className="h-4 w-4" />
            <span>Select video (≤ 1 min)</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="text-white/70">Watermark username:</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 max-w-xs bg-black/60 border border-white/25 rounded-full px-3 py-1.5 text-sm outline-none"
            />
          </div>
        </div>

        {/* Main preview area */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-white/80">Original</h2>
            <div className="aspect-video bg-black/60 rounded-xl flex items-center justify-center overflow-hidden border border-white/15">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-xs text-white/60 gap-2">
                  <Play className="h-6 w-6 opacity-60" />
                  <span>Select a video to preview</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80">
                Processed (burnt watermark)
              </h2>
              <button
                type="button"
                disabled={!file || !ffmpegReady || processing}
                onClick={handleBurn}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: ACCENT, color: "#000" }}
              >
                {processing && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>{processing ? "Processing…" : "Burn watermark"}</span>
              </button>
            </div>

            <div className="aspect-video bg-black/60 rounded-xl flex items-center justify-center overflow-hidden border border-white/15">
              {outputUrl ? (
                <video
                  src={outputUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-xs text-white/60 gap-2">
                  <Play className="h-6 w-6 opacity-60" />
                  <span>Run “Burn watermark” to see output</span>
                </div>
              )}
            </div>

            {outputUrl && (
              <div className="flex justify-end">
                <a
                  href={outputUrl}
                  download="watermarked.mp4"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/40 hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Download video
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-white/50">
            If you ever get a 0-byte output, open DevTools and check the ffmpeg
            logs – it usually means the filter chain (like <code>drawtext</code>
            ) failed.
          </p>
          <p className="text-[11px] text-white/50">
            For production you’d probably run FFmpeg on the backend (Supabase
            function / worker) and just use this UI as a client to that API.
          </p>
        </div>
      </div>
    </div>
  );
}
