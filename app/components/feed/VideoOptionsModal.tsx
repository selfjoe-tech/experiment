// app/components/feed/VideoOptionsModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  X as XIcon,
  Share2,
  Code2,
  MessageSquareWarning,
  Copy,
  Check,
} from "lucide-react";
import {
  REPORT_REASONS,
  ReportReason,
  submitReportClient,
} from "@/lib/actions/reports";

type Props = {
  open: boolean;
  onClose: () => void;
  mediaId: number | string;
};

type Mode = "options" | "report-step1" | "report-step2" | "report-done";

export default function VideoOptionsModal({ open, onClose, mediaId }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"embed" | "share" | null>(null);

  const [mode, setMode] = useState<Mode>("options");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
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
    }
  }, [open]);

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

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-3">
      <div className={baseCardClass}>
        {/* gradient edge */}
        <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-yellow-400 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-semibold">
            {mode.startsWith("report") ? "Report Content" : "Options"}
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

        {/* CONTENT MODES */}
        {mode === "options" && (
          <div className="px-5 pb-5 space-y-4">
            {/* Embed */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => copyText(iframeSnippet, "embed")}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Code2 className="h-4 w-4" />
                  </span>
                  <span>Embed</span>
                </div>
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

            {/* Share */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => copyText(shareUrl, "share")}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Share2 className="h-4 w-4" />
                  </span>
                  <span>Share link</span>
                </div>
                <span className="text-[11px] text-white/70 flex items-center gap-1">
                  {copied === "share" && <Check className="h-3 w-3" />}
                  {copied === "share" ? "Copied" : "Copy"}
                </span>
              </button>
              <input
                readOnly
                className="w-full text-[11px] bg-black/70 border border-white/10 rounded-lg px-2 py-1.5 font-mono"
                value={shareUrl}
              />
            </div>

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
          </div>
        )}

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
                className="flex-1 h-10 rounded-full bg-[#F7FF3C] text-black text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}

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

            {submitError && (
              <p className="text-[11px] text-red-400">{submitError}</p>
            )}

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
                className="flex-1 h-10 rounded-full bg-[#F7FF3C] text-black text-xs font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        )}

        {mode === "report-done" && (
          <div className="px-5 pb-5 space-y-4">
            <p className="text-sm text-white">
              Thank you for letting us know. Our team will review this content
              as soon as possible.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 rounded-full bg-[#F7FF3C] text-black text-xs font-semibold hover:brightness-95 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
