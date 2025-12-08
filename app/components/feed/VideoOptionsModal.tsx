"use client";

import React, { useEffect, useState } from "react";
import { X as XIcon } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  mediaId: number | string;
};

export default function VideoOptionsModal({ open, onClose, mediaId }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"embed" | "share" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!open) return null;

  const idStr = String(mediaId);
  const shareUrl =
    origin !== "" ? `${origin}/watch/${idStr}` : `/watch/${idStr}`;
  const embedUrl =
    origin !== "" ? `${origin}/embed/${idStr}` : `/embed/${idStr}`;

  const iframeSnippet = `<iframe src="${embedUrl}" width="360" height="640" style="border:0;overflow:hidden" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;

  const copyText = async (text: string, kind: "embed" | "share") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error("clipboard error", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-[#111] border border-white/15 p-4 space-y-4 text-sm text-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Options</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Embed */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => copyText(iframeSnippet, "embed")}
            className="w-full flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
          >
            <span>Embed</span>
            <span className="text-[11px] text-white/60">
              {copied === "embed" ? "Copied!" : "Copy code"}
            </span>
          </button>
          <textarea
            readOnly
            rows={3}
            className="w-full text-[11px] bg-black/60 border border-white/10 rounded-md px-2 py-1 font-mono resize-none"
            value={iframeSnippet}
          />
        </div>

        {/* Share */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => copyText(shareUrl, "share")}
            className="w-full flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
          >
            <span>Share</span>
            <span className="text-[11px] text-white/60">
              {copied === "share" ? "Copied!" : "Copy link"}
            </span>
          </button>
          <input
            readOnly
            className="w-full text-[11px] bg-black/60 border border-white/10 rounded-md px-2 py-1 font-mono"
            value={shareUrl}
          />
        </div>

        {/* Report */}
        <button
          type="button"
          onClick={() => {
            // TODO: hook this into your real report flow
            console.log("Report clicked for media", idStr);
            onClose();
          }}
          className="w-full rounded-lg border border-red-500/40 text-red-400 px-3 py-2 hover:bg-red-500/10 text-left"
        >
          Report
        </button>
      </div>
    </div>
  );
}
