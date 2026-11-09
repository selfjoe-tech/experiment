"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, Check, CircleAlert, ExternalLink, Link2, LoaderCircle, ShieldCheck,
} from "lucide-react";
import {
  EXTERNAL_VIDEO_PLATFORMS,
  parseExternalVideoUrl,
  type ExternalVideoInfo,
  type VideoQuality,
} from "@/lib/external-download";

const MAX_BROWSER_FILE_BYTES = 200 * 1024 * 1024;

type Target =
  | { kind: "goongram"; id: number; url: string }
  | { kind: "direct"; url: string; filename: string }
  | { kind: "external"; url: string; info: ExternalVideoInfo };

function classifyUrl(input: string): Target | { kind: "social"; url: string } | null {
  if (input.length > 2048) return null;
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const normalized = url.toString();

  if (host === "goongram.com" || host === "www.goongram.com") {
    const match = url.pathname.match(/^\/(?:watch|download)\/([1-9][0-9]*)(?:\/)?$/);
    if (match && Number.isSafeInteger(Number(match[1]))) {
      return { kind: "goongram", id: Number(match[1]), url: normalized };
    }
  }

  const social = parseExternalVideoUrl(normalized);
  if (social) return { kind: "social", url: social.url };

  // A social post's HTML page is not a video file. Never pretend otherwise.
  // Direct R2 videos, and HTTPS media files from CORS-enabled hosts, are supported.
  if (host !== "media.goongram.com" && !/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return null;
  let basename = "video.mp4";
  try {
    basename = decodeURIComponent(url.pathname.split("/").pop() || "video.mp4");
  } catch {}
  basename = basename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^\.+/, "").slice(0, 100) || "video.mp4";
  if (!/\.(mp4|webm|mov|m4v)$/i.test(basename)) basename += ".mp4";
  return { kind: "direct", url: normalized, filename: basename };
}

function readableSize(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function postJson(path: string, value: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error("Social-media post links need an extraction backend because those sites restrict browser access. Goongram links and direct video-file URLs work without one.");
    }
    throw new Error(data?.error || "Unable to process that video link.");
  }
  return data;
}

async function downloadInBrowser(
  url: string,
  filename: string,
  signal: AbortSignal,
  onProgress: (percent: number | null) => void,
) {
  // Video bytes go straight from the media host to this visitor's device.
  // No Vercel proxy, VPS, third-party extraction service or uploaded user data.
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("The video host returned HTTP " + response.status + ".");
  const mime = (response.headers.get("content-type") || "").toLowerCase();
  if (mime.includes("text/html") || mime.includes("application/json") || mime.includes("text/xml")) {
    throw new Error("This link returned a web page instead of a video file.");
  }
  const total = Number(response.headers.get("content-length") || "0");
  if (total > MAX_BROWSER_FILE_BYTES) {
    await response.body?.cancel();
    throw new Error("This file exceeds the 200 MB browser download limit.");
  }

  let blob: Blob;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        received += part.value.byteLength;
        if (received > MAX_BROWSER_FILE_BYTES) {
          await reader.cancel();
          throw new Error("This file exceeds the 200 MB browser download limit.");
        }
        chunks.push(part.value as BlobPart);
        onProgress(total > 0 ? Math.min(100, Math.round(received / total * 100)) : null);
      }
    } finally {
      reader.releaseLock();
    }
    blob = new Blob(chunks, { type: mime || "application/octet-stream" });
  } else {
    blob = await response.blob();
  }
  if (!blob.size) throw new Error("The video file was empty.");

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export default function UrlDownloaderClient() {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [quality, setQuality] = useState<VideoQuality>("best");
  const [status, setStatus] = useState<"idle" | "inspecting" | "downloading">("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [downloadStarted, setDownloadStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function resetInput(next: string) {
    abortRef.current?.abort();
    setUrl(next);
    setTarget(null);
    setError("");
    setProgress(null);
    setDownloadStarted(false);
  }

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    setError("");
    setTarget(null);
    setDownloadStarted(false);
    const parsed = classifyUrl(url);
    if (!parsed) {
      setError("Enter a Goongram video link, a direct HTTPS video-file URL (.mp4, .webm, .mov or .m4v), or a supported social-media post link.");
      return;
    }
    if (parsed.kind !== "social") {
      setTarget(parsed);
      return;
    }

    setStatus("inspecting");
    try {
      const info = await postJson("/api/external-download/inspect", { url: parsed.url }) as ExternalVideoInfo;
      setTarget({ kind: "external", url: parsed.url, info });
      setQuality("best");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to inspect that link.");
    } finally {
      setStatus("idle");
    }
  }

  async function startDownload() {
    if (!target || status !== "idle") return;
    setError("");
    setDownloadStarted(false);

    if (target.kind === "goongram") {
      window.location.assign("/download/" + target.id);
      return;
    }

    setStatus("downloading");
    setProgress(null);
    try {
      if (target.kind === "direct") {
        const controller = new AbortController();
        abortRef.current = controller;
        await downloadInBrowser(target.url, target.filename, controller.signal, setProgress);
      } else {
        // Optional legacy backend for post pages that browsers cannot extract.
        // This is never called for a Goongram or direct-file URL.
        const data = await postJson("/api/external-download/link", {
          url: target.url, quality,
        }) as { downloadUrl?: string };
        if (!data.downloadUrl) throw new Error("No downloadable video was returned.");
        const anchor = document.createElement("a");
        anchor.href = data.downloadUrl;
        anchor.rel = "noopener noreferrer";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setDownloadStarted(true);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        const message = cause instanceof Error ? cause.message : "The download failed.";
        setError(target.kind === "direct" && message === "Failed to fetch"
          ? "The video host blocked cross-origin browser downloads (CORS), or the file is unavailable. Goongram R2 media supports this flow."
          : message);
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  }

  const title = target?.kind === "external"
    ? target.info.title
    : target?.kind === "goongram"
      ? "Goongram video #" + target.id
      : target?.filename || "";

  return (
    <div className="space-y-6">
      <form onSubmit={(event) => { void inspect(event); }}
        className="rounded-2xl border border-white/10 bg-[#14151a] p-5 shadow-[0_16px_60px_rgba(0,0,0,.28)] sm:p-7">
        <label htmlFor="external-video-url" className="block text-[14px] font-semibold text-white">Video link</label>
        <p className="mt-1 text-[13px] leading-6 text-white/50">
          Paste a Goongram video link or a direct video-file URL. The download uses your browser and device.
        </p>
        <div className="mt-5 flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-[#0b0d10] px-3.5 focus-within:border-pink-400/70">
          <Link2 className="shrink-0 text-white/45" size={19} />
          <input
            id="external-video-url" type="url" inputMode="url" autoCapitalize="none"
            autoComplete="off" spellCheck={false} value={url}
            onChange={(event) => resetInput(event.target.value)}
            placeholder="https://media.goongram.com/videos/video.mp4"
            required
            className="h-14 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35 sm:text-[14px]"
          />
          {!!url && <button type="button" onClick={() => resetInput("")}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white">
            Clear
          </button>}
        </div>
        <button type="submit" disabled={status !== "idle"}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 text-[14px] font-semibold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">
          {status === "inspecting" ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
          {status === "inspecting" ? "Checking link..." : "Get video"}
        </button>
        <p className="mt-4 text-[11px] leading-5 text-white/40">
          Direct video URLs and Goongram links work without a server. X, Instagram, Pornhub and Redgifs post pages require an optional extractor backend because browsers cannot reliably access their media streams.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTERNAL_VIDEO_PLATFORMS.map((site) => (
            <span key={site.key} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/45">
              {site.name} · extractor required
            </span>
          ))}
        </div>
      </form>

      {!!error && <div role="alert"
        className="flex gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[.08] p-4 text-[13px] leading-6 text-rose-100">
        <CircleAlert size={18} className="mt-0.5 shrink-0" /><p>{error}</p>
      </div>}

      {!!target && <section aria-label="Video download options"
        className="overflow-hidden rounded-2xl border border-white/10 bg-[#14151a]">
        <div className="flex gap-4 p-5 sm:p-6">
          {target.kind === "external" && target.info.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.info.thumbnail} alt="" referrerPolicy="no-referrer"
              className="h-24 w-24 shrink-0 rounded-lg object-cover"
              onError={(event) => { event.currentTarget.style.display = "none"; }}/>
          )}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-pink-300">
              <Check size={14}/>
              {target.kind === "direct" ? "Direct video file" : target.kind === "goongram" ? "Goongram video" : "Video found"}
            </span>
            <h2 className="mt-2 break-words text-[18px] font-semibold leading-7 tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-xs leading-5 text-white/50">
              {target.kind === "goongram" ? "Open the video's download page to save the original file."
                : target.kind === "direct" ? "Original quality. File bytes are fetched by your browser, not by Goongram's servers."
                : "Select the quality offered by the extraction service."}
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 p-5 sm:p-6">
          {target.kind === "external" && <>
            <label htmlFor="download-quality" className="mb-2 block text-[13px] font-medium text-white">Video quality</label>
            <select id="download-quality" value={String(quality)}
              onChange={(event) => setQuality(event.target.value === "best" ? "best" : Number(event.target.value) as VideoQuality)}
              className="mb-4 h-12 w-full rounded-xl border border-white/15 bg-[#0b0d10] px-3 text-[13px] text-white outline-none focus:border-pink-400/70">
              {target.info.qualities.map((q) => <option key={q} value={q}>{q === "best" ? "Best available" : "Up to " + q + "p"}</option>)}
            </select>
          </>}
          <button type="button" disabled={status !== "idle"} onClick={() => { void startDownload(); }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">
            {status === "downloading" ? <LoaderCircle size={18} className="animate-spin"/> : <ArrowDownToLine size={18}/>}
            {status === "downloading" ? "Downloading..." : target.kind === "goongram" ? "Open download page" : "Download video"}
          </button>
          {status === "downloading" && target.kind === "direct" && (
            <p role="status" className="mt-3 text-center text-xs text-white/65">
              {progress !== null ? "Downloaded " + progress + "%" : "Transferring video to your device..."}
            </p>
          )}
          {downloadStarted && <p role="status" className="mt-3 text-xs leading-5 text-white/65">
            Download request sent to your browser.
          </p>}
          {target.kind === "direct" && <a href={target.url} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/60 underline underline-offset-2 hover:text-white">
            Open original video <ExternalLink size={13}/>
          </a>}
          {target.kind === "direct" && <p className="mt-2 text-[11px] leading-5 text-white/40">
            Maximum 200 MB per browser download. Other media hosts must allow cross-origin requests.
          </p>}
        </div>
      </section>}

      <div className="flex items-start gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-4 py-4 text-[12px] leading-6 text-white/45">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-white/50"/>
        Download only content you own or have permission to save. This tool does not bypass DRM, login restrictions or private accounts.
      </div>
    </div>
  );
}
