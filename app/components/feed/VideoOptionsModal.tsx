"use client";

import React, { useEffect, useState } from "react";
import {
  X as XIcon,
  Share2,
  Code2,
  MessageSquareWarning,
  Check,
  Download,
  Link2,
} from "lucide-react";
import {
  REPORT_REASONS,
  ReportReason,
  submitReportClient,
} from "@/lib/actions/reports";

import { Portal } from "@/components/ui/Portal"; // adjust path

type Props = {
  open: boolean;
  onClose: () => void;
  mediaId: number | string;
  videoUrl: string; // ✅ supabase public URL
};

type Mode = "options" | "share" | "report-step1" | "report-step2" | "report-done";

function getSupabasePublicFilename(url: string, fallback: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const clean = decodeURIComponent(last);
    return clean || fallback;
  } catch {
    const last = (url.split("?")[0] || "").split("/").pop() || "";
    return last || fallback;
  }
}

/**
 * Force download via fetch -> blob -> <a download>
 * Notes:
 * - This will use memory proportional to file size (big videos = big RAM).
 * - Requires CORS to allow GET from your origin (Supabase public URLs usually do).
 */
async function forceDownload(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(blobUrl);
}

export default function VideoOptionsModal({
  open,
  onClose,
  mediaId,
  videoUrl,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"embed" | "share" | null>(null);

  const [mode, setMode] = useState<Mode>("options");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // download UX
  const [dlLoading, setDlLoading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  // share UX
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Reset internal state whenever the modal opens/closes
  useEffect(() => {
    if (!open) {
      setMode("options");
      setSelectedReason(null);
      setNote("");
      setCopied(null);
      setSubmitting(false);
      setSubmitError(null);

      setDlLoading(false);
      setDlError(null);

      setShowEmbedCode(false);
    }
  }, [open]);

  // Reset share panel when entering share mode
  useEffect(() => {
    if (mode !== "share") return;
    setShowEmbedCode(false);
  }, [mode]);

  if (!open) return null;

  const idStr = String(mediaId);
  const shareUrl = origin !== "" ? `${origin}/watch/${idStr}` : `/watch/${idStr}`;
  const embedUrl = origin !== "" ? `${origin}/embed/${idStr}` : `/embed/${idStr}`;

  const iframeSnippet = `<iframe src="${embedUrl}" width="360" height="640" style="border:0;overflow:hidden" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;

  const fallbackName = `upskirtcandy_${idStr}.mp4`;
  const downloadName = getSupabasePublicFilename(videoUrl, fallbackName);

  const copyText = async (text: string, kind: "embed" | "share") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error("clipboard error", err);
    }
  };

  const openExternal = (url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("openExternal error", e);
    }
  };

  const redditShareUrl = `https://www.reddit.com/submit?type=LINK&url=${encodeURIComponent(
    shareUrl
  )}`;

  const xShareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`;

  const handleDownload = async () => {
    if (!videoUrl) return;

    setDlError(null);
    setDlLoading(true);
    try {
      await forceDownload(videoUrl, downloadName);
    } catch (e: any) {
      console.error("download error", e);
      setDlError(
        "Download failed. If this keeps happening, try opening the media URL in a new tab and downloading from there."
      );
    } finally {
      setDlLoading(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedReason) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitReportClient({
        mediaId,
        reason: selectedReason,
        note: note.trim() || undefined,
      });
      setMode("report-done");
    } catch (err: any) {
      console.error("submitReport error", err);
      setSubmitError(err.message ?? "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const baseCardClass =
    "w-full max-w-sm rounded-2xl bg-[#090909] border border-white/15 text-sm text-white shadow-2xl overflow-hidden";

  const rowClass =
    "w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 hover:bg-white/5 transition";

  const iconBubble = "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10";

  return (
    <Portal>
      <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3">
        <div className={baseCardClass}>
          <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-yellow-400 to-purple-500" />

          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-semibold">
              {mode === "share"
                ? "Share"
                : mode.startsWith("report")
                ? "Report Content"
                : "Options"}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* ===================== OPTIONS ===================== */}
          {mode === "options" && (
            <div className="px-5 pb-5 space-y-4">
              {/* Share -> opens the Share screen (instead of copying) */}
              <button
                type="button"
                onClick={() => setMode("share")}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Share2 className="h-4 w-4" />
                  </span>
                  <span>Share</span>
                </div>
                <span className="text-[11px] text-white/60">Open</span>
              </button>

              {/* Report CTA */}
              <button
                type="button"
                onClick={() => setMode("report-step1")}
                className="w-full flex items-center gap-2 rounded-xl border border-red-500/50 text-red-400 px-3 py-2.5 hover:bg-red-500/10 text-left transition"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
                  <MessageSquareWarning className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Report content</span>
                  <span className="text-[11px] text-red-300/80">
                    Flag this upload for review
                  </span>
                </div>
              </button>

              {/* Download */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={dlLoading}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:bg-white/5 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                      <Download className="h-4 w-4" />
                    </span>
                    <span>{dlLoading ? "Downloading…" : "Download"}</span>
                  </div>
                </button>

                {dlError && <p className="text-[11px] text-red-400">{dlError}</p>}

                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] text-pink-500 underline underline-offset-2 hover:text-white/80"
                >
                  Click here if download fails
                </a>
              </div>
            </div>
          )}

          {/* ===================== SHARE ===================== */}
          {mode === "share" && (
            <div className="px-5 pb-5 space-y-4">
              {/* Copy Link */}
              <button
                type="button"
                onClick={() => copyText(shareUrl, "share")}
                className={rowClass}
              >
                <div className="flex items-center gap-3">
                  <span className={iconBubble}>
                    <Link2 className="h-4 w-4" />
                  </span>
                  <span>Copy Link</span>
                </div>

                <span className="text-[11px] text-white/70 flex items-center gap-1">
                  {copied === "share" && <Check className="h-3 w-3" />}
                  {copied === "share" ? "Copied" : "Copy"}
                </span>
              </button>

              {/* Embed (toggle showing code) */}
              <button
                type="button"
                onClick={() => setShowEmbedCode((v) => !v)}
                className={rowClass}
              >
                <div className="flex items-center gap-3">
                  <span className={iconBubble}>
                    <Code2 className="h-4 w-4" />
                  </span>
                  <span>Embed</span>
                </div>

                <span className="text-[11px] text-white/60">
                  {showEmbedCode ? "Hide" : "Show"}
                </span>
              </button>

              {showEmbedCode && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => copyText(iframeSnippet, "embed")}
                    className="w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:bg-white/5 transition"
                  >
                    <span className="text-[12px] text-white/80">Copy embed code</span>
                    <span className="text-[11px] text-white/70 flex items-center gap-1">
                      {copied === "embed" && <Check className="h-3 w-3" />}
                      {copied === "embed" ? "Copied" : "Copy"}
                    </span>
                  </button>

                  <textarea
                    readOnly
                    rows={3}
                    className="w-full text-[11px] bg-black/70 border border-white/10 rounded-lg px-2 py-1.5 font-mono resize-none"
                    value={iframeSnippet}
                  />
                </div>
              )}

              {/* Social Share */}
              <div className="pt-1">
                <div className="text-[12px] text-white/70 mb-2">Social Share</div>

                <div className="space-y-2">
                  {/* Reddit */}
                  <button
                    type="button"
                    onClick={() => openExternal(redditShareUrl)}
                    className={rowClass}
                  >
                    <div className="flex items-center gap-3">
                      <span className={iconBubble}>
                        <span className="text-[px] font-semibold"><svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-reddit" viewBox="0 0 16 16">
                          <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"></path>
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"></path>
                        </svg></span>
                      </span>
                      <span>Reddit</span>
                    </div>
                  </button>

                  {/* X */}
                  <button
                    type="button"
                    onClick={() => openExternal(xShareUrl)}
                    className={rowClass}
                  >
                    <div className="flex items-center gap-3">
                      <span className={iconBubble}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-twitter-x" viewBox="0 0 16 16">
  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"></path>
</svg>
                      </span>
                      <span>X</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Back */}
              <button
                type="button"
                onClick={() => setMode("options")}
                className="w-full h-10 rounded-full border border-white/20 text-xs font-semibold text-white/80 hover:bg-white/5 transition"
              >
                Back
              </button>

              {/* (optional) show URL for debugging */}
              
            </div>
          )}

          {/* ===================== REPORT STEP 1 ===================== */}
          {mode === "report-step1" && (
            <div className="px-5 pb-5 space-y-4">
              <p className="text-xs text-white/70">
                Why are you reporting this upload?
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {REPORT_REASONS.map((reason) => {
                  const active = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-white/10 border border-yellow-400/80"
                          : "bg-white/[0.02] border border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <span className="text-sm">{reason}</span>
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          active
                            ? "bg-yellow-300 border-yellow-300"
                            : "border-white/40"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("options")}
                  className="flex-1 h-10 rounded-full border border-white/20 text-xs font-semibold text-white/80 hover:bg-white/5 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!selectedReason}
                  onClick={() => selectedReason && setMode("report-step2")}
                  className="flex-1 h-10 rounded-full bg-pink-500 text-black text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ===================== REPORT STEP 2 ===================== */}
          {mode === "report-step2" && (
            <div className="px-5 pb-5 space-y-4">
              <p className="text-xs text-white/70">
                Is there anything else you&apos;d like to add?
              </p>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                placeholder="Please add your comment here (optional)"
                className="w-full text-sm bg-black/70 border border-white/15 rounded-xl px-3 py-2 resize-none placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-yellow-300"
              />

              {submitError && <p className="text-[11px] text-red-400">{submitError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("report-step1")}
                  className="flex-1 h-10 rounded-full border border-white/20 text-xs font-semibold text-white/80 hover:bg-white/5 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={submitting || !selectedReason}
                  className="flex-1 h-10 rounded-full bg-pink-500 text-black text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* ===================== REPORT DONE ===================== */}
          {mode === "report-done" && (
            <div className="px-5 pb-5 space-y-4">
              <p className="text-sm text-white">
                Thank you for letting us know. Our team will review this content as soon as
                possible.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-full bg-pink-500 text-black text-xs font-semibold hover:brightness-95 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
