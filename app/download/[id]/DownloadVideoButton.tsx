"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, LoaderCircle } from "lucide-react";

type Props = {
  sourceUrl: string;
  directDownloadUrl: string | null;
  filename: string;
};

export default function DownloadVideoButton({ sourceUrl, directDownloadUrl, filename }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const blobUrl = useRef<string | null>(null);

  useEffect(() => () => {
    abort.current?.abort();
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }, []);

  async function download() {
    if (loading) return;
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch(sourceUrl, { signal: controller.signal, mode: "cors" });
      if (!response.ok) throw new Error("Unable to retrieve video");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty video");
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl.current;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(true);
    } finally {
      abort.current = null;
      setLoading(false);
    }
  }

  return <div className="space-y-3">
    {directDownloadUrl
      ? <a href={directDownloadUrl} download={filename}
          className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-lg bg-pink-500 px-6 text-[13px] font-semibold text-white transition hover:bg-pink-400">
          <Download size={18}/> Download video
        </a>
      : <button type="button" onClick={() => { void download(); }} disabled={loading}
          className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-lg bg-pink-500 px-6 text-[13px] font-semibold text-white transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle size={18} className="animate-spin"/> : <Download size={18}/>}
          {loading ? "Preparing download…" : "Download video"}
        </button>}
    <p className="text-[11px] leading-5 text-white/40">Video file · {filename}</p>
    {error && <div role="alert" className="max-w-md rounded-lg border border-rose-400/20 bg-rose-500/[.08] p-3 text-xs leading-5 text-rose-200">
      Your browser could not save this file directly. You can open the video file in a new tab and save it from there.
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
        className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">Open file <ExternalLink size={12}/></a>
    </div>}
  </div>;
}
