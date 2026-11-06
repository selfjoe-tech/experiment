"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export default function WatchLinkExample({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);
  const value = url || "https://goongram.com/watch/VIDEO_ID";
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return <div className="mt-6 overflow-hidden rounded-xl border border-white/15 bg-[#15161b]">
    <div className="flex items-center gap-2 border-b border-white/[.08] px-4 py-3 text-[11px] text-white/45">
      <span className="h-2 w-2 rounded-full bg-pink-400"/>
      {url ? "Example of a real full-video URL" : "Full-video link format"}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <span className="min-w-0 break-all font-mono text-[13px] font-medium text-white sm:text-base">
        {value}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {url && <a href={url} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-medium hover:bg-white/[.06]">
          Open <ExternalLink size={14}/>
        </a>}
        <button type="button" onClick={copy} disabled={!url}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-medium hover:bg-white/[.06] disabled:cursor-not-allowed disabled:opacity-40">
          {copied ? <Check size={14}/> : <Copy size={14}/>}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  </div>;
}
