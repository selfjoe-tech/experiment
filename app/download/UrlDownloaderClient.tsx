"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownToLine, Check, CircleAlert, ClipboardPaste, LoaderCircle, Link2, ShieldCheck } from "lucide-react";
import {
  EXTERNAL_VIDEO_PLATFORMS,
  parseExternalVideoUrl,
  type ExternalVideoInfo,
  type VideoQuality,
} from "@/lib/external-download";

function timeLabel(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function platformLabel(key: ExternalVideoInfo["platform"]): string {
  return EXTERNAL_VIDEO_PLATFORMS.find((item) => item.key === key)?.name || key;
}

async function postJson(path: string, value: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to process that video link.");
  return data;
}

export default function UrlDownloaderClient() {
  const [url, setUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [info, setInfo] = useState<ExternalVideoInfo | null>(null);
  const [quality, setQuality] = useState<VideoQuality>("best");
  const [status, setStatus] = useState<"idle" | "inspecting" | "preparing">("idle");
  const [error, setError] = useState("");
  const [downloadStarted, setDownloadStarted] = useState(false);

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    setInfo(null);
    setError("");
    setDownloadStarted(false);
    const parsed = parseExternalVideoUrl(url);
    if (!parsed) {
      setError("Enter a direct link to a public video post from X, Instagram, Pornhub or Redgifs.");
      return;
    }

    setStatus("inspecting");
    try {
      const data = await postJson("/api/external-download/inspect", { url: parsed.url }) as ExternalVideoInfo;
      setInfo(data);
      setSubmittedUrl(parsed.url);
      setQuality("best");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to inspect this video.");
    } finally {
      setStatus("idle");
    }
  }

  async function startDownload() {
    if (!info || !submittedUrl || status !== "idle") return;
    setError("");
    setDownloadStarted(false);
    setStatus("preparing");
    try {
      const data = await postJson("/api/external-download/link", {
        url: submittedUrl,
        quality,
      }) as { downloadUrl: string };
      if (!data.downloadUrl) throw new Error("No downloadable video was returned.");

      // The worker sends Content-Disposition: attachment, so the video
      // travels directly from the worker to the user, not through Vercel.
      const anchor = document.createElement("a");
      anchor.href = data.downloadUrl;
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setDownloadStarted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the download.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => { void inspect(event); }} className="rounded-2xl border border-white/10 bg-[#14151a] p-5 shadow-[0_16px_60px_rgba(0,0,0,.28)] sm:p-7">
        <label htmlFor="external-video-url" className="block text-[14px] font-semibold text-white">
          Video link
        </label>
        <p className="mt-1 text-[13px] leading-6 text-white/50">
          Copy a link to a public video post and paste it below.
        </p>

        <div className="mt-5 flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-[#0b0d10] px-3.5 focus-within:border-pink-400/70">
          <Link2 className="shrink-0 text-white/45" size={19} />
          <input
            id="external-video-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(event) => { setUrl(event.target.value); setInfo(null); setSubmittedUrl(""); setError(""); setDownloadStarted(false); }}
            placeholder="https://x.com/username/status/..."
            required
            className="h-14 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35 sm:text-[14px]"
          />
          {url.length === 0 && (
            <ClipboardPaste size={17} className="shrink-0 text-white/30" aria-hidden="true" />
          )}
          {url && (
            <button type="button" onClick={() => { setUrl(""); setInfo(null); setSubmittedUrl(""); setError(""); setDownloadStarted(false); }}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white">
              Clear
            </button>
          )}
        </div>

        <button type="submit" disabled={status !== "idle"}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 text-[14px] font-semibold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">
          {status === "inspecting" ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
          {status === "inspecting" ? "Finding video..." : "Get video"}
        </button>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {EXTERNAL_VIDEO_PLATFORMS.map((site) => {
            const selected = parseExternalVideoUrl(url)?.platform === site.key;
            return (
              <span key={site.key} className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${selected
                ? "border-pink-400/50 bg-pink-500/10 text-pink-200"
                : "border-white/10 bg-white/[.035] text-white/55"}`}>
                {site.name}
              </span>
            );
          })}
        </div>
      </form>

      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[.08] p-4 text-[13px] leading-6 text-rose-100">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {info && (
        <section aria-label="Video download options" className="overflow-hidden rounded-2xl border border-white/10 bg-[#14151a]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
            {info.thumbnail ? (
              <div className="h-[190px] shrink-0 overflow-hidden rounded-xl bg-black sm:h-[170px] sm:w-[185px]">
                {/* External thumbnails cannot be optimized without an open image-domain allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={info.thumbnail} alt="" referrerPolicy="no-referrer"
                  className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-pink-300">
                <Check size={14} /> Video found
              </span>
              <h2 className="mt-2 break-words text-[18px] font-semibold leading-7 tracking-tight text-white sm:text-xl">
                {info.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/50">
                <span>{platformLabel(info.platform)}</span>
                {info.uploader && <span>{info.uploader}</span>}
                {timeLabel(info.duration) && <span>{timeLabel(info.duration)}</span>}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 p-5 sm:p-6">
            <label htmlFor="download-quality" className="mb-2 block text-[13px] font-medium text-white">
              Video quality
            </label>
            <select id="download-quality" value={String(quality)}
              onChange={(event) => setQuality(event.target.value === "best" ? "best" : Number(event.target.value) as VideoQuality)}
              className="h-12 w-full rounded-xl border border-white/15 bg-[#0b0d10] px-3 text-[13px] text-white outline-none focus:border-pink-400/70">
              {info.qualities.map((q) => <option key={q} value={q}>{q === "best" ? "Best available" : `Up to ${q}p`}</option>)}
            </select>
            <button type="button" onClick={() => { void startDownload(); }} disabled={status !== "idle"}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">
              {status === "preparing" ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
              {status === "preparing" ? "Preparing download..." : "Download video"}
            </button>
            {downloadStarted && (
              <div role="status" className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/65">
                <Check size={15} className="mt-0.5 shrink-0 text-pink-300"/>
                Your download request has been sent. Processing may take a moment; your browser will save the file when it is ready.
              </div>
            )}
            <p className="mt-3 text-[11px] leading-5 text-white/40">
              File format depends on the source. Private, protected or unavailable videos cannot be downloaded.
            </p>
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-4 py-4 text-[12px] leading-6 text-white/45">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-white/50" />
        Download only videos you own or are authorized to save. Content must be publicly accessible; this tool does not bypass account restrictions or DRM.
      </div>
    </div>
  );
}
