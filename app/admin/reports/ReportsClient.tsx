// app/admin/reports/ReportsClient.tsx
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { removeMediaFromReport, ignoreReport } from "./actions";
import type { ReportRow } from "./page";
import { buildPublicUrl } from "@/lib/actions/mediaFeed";

type StatusFilter = "all" | "pending" | "ignored" | "media removed";

type Props = {
  reports: ReportRow[];
  page: number;
  totalPages: number;
  status: StatusFilter;
  q: string;
  errorMessage: string | null;
};

function buildPageHref(opts: {
  page: number;
  status: StatusFilter;
  q: string;
}) {
  const params = new URLSearchParams();

  if (opts.page > 1) params.set("page", String(opts.page));
  if (opts.status !== "all") params.set("status", opts.status);
  if (opts.q) params.set("q", opts.q);

  const qs = params.toString();
  return qs ? `/admin/reports?${qs}` : `/admin/reports`;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300",
  ignored: "bg-slate-500/30 text-slate-200",
  "media removed": "bg-red-500/20 text-red-300",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  ignored: "Ignored",
  "media removed": "Media removed",
};

export default function ReportsClient({
  reports,
  page,
  totalPages,
  status,
  q,
  errorMessage,
}: Props) {
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [ignoreLoading, setIgnoreLoading] = useState(false);

  const activeReport =
    activeReportId != null
      ? reports.find((r) => r.id === activeReportId) ?? null
      : null;

  // Build media URL for the active report (video or image)
  const mediaUrl =
    activeReport && activeReport.media?.storage_path
      ? buildPublicUrl(activeReport.media.storage_path)
      : null;

  if (activeReport?.media) {
    console.log("[ReportsClient] Active report media:", {
      reportId: activeReport.id,
      mediaId: activeReport.media.id,
      storage_path: activeReport.media.storage_path,
      media_type: activeReport.media.media_type,
      mediaUrl,
    });
  }

  const handleRemoveSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeReport) return;

    try {
      setRemoveLoading(true);
      const formData = new FormData(e.currentTarget);
      await removeMediaFromReport(formData);
      // If it didn't throw, assume success and close modal
      setActiveReportId(null);
    } catch (err) {
      console.error("Failed to remove media from report", err);
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleIgnoreSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeReport) return;

    try {
      setIgnoreLoading(true);
      const formData = new FormData(e.currentTarget);
      await ignoreReport(formData);
      // If it didn't throw, assume success and close modal
      setActiveReportId(null);
    } catch (err) {
      console.error("Failed to ignore report", err);
    } finally {
      setIgnoreLoading(false);
    }
  };

  const buttonsBusy = removeLoading || ignoreLoading;

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>

        <form
          className="flex flex-wrap gap-2"
          method="GET"
          action="/admin/reports"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by report id or reason"
            className="h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-md bg-black/40 border border-white/20 px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="ignored">Ignored</option>
            <option value="media removed">Media removed</option>
          </select>
          <button
            type="submit"
            className="h-9 px-3 rounded-md bg-pink-500 text-black text-sm font-semibold"
          >
            Apply
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="text-xs text-red-400">
          Failed to load reports: {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Reporter</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-xs">{r.id}</td>
                <td className="px-3 py-2 max-w-xs truncate">{r.reason}</td>
                <td className="px-3 py-2 text-xs">{r.reporter_id}</td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      statusStyles[r.status] ??
                      "bg-white/10 text-white/70"
                    }`}
                  >
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status !== "media removed" && (
                    <button
                      type="button"
                      onClick={() => setActiveReportId(r.id)}
                      className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {reports.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-xs text-white/60"
                >
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (URL-based) */}
      <div className="flex items-center justify-between text-xs text-white/60">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={buildPageHref({ page: page - 1, status, q })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildPageHref({ page: page + 1, status, q })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      {/* Modal, controlled fully in client state (no URL changes) */}
      {activeReport && activeReport.media && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#111] border border-white/10 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Report #{activeReport.id}
              </div>
              <button
                type="button"
                onClick={() => setActiveReportId(null)}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-white/60">
              Reason: {activeReport.reason}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-black/50 rounded-xl p-2 flex items-center justify-center">
                {mediaUrl ? (
                  activeReport.media.media_type === "video" ? (
                    <video
                      key={activeReport.media.id}
                      controls
                      src={mediaUrl}
                      className="max-h-[60vh] max-w-full rounded-lg"
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt="Reported media"
                      className="max-h-[60vh] max-w-full rounded-lg object-contain"
                    />
                  )
                ) : (
                  <p className="text-xs text-red-400">
                    Could not determine media URL for this report.
                  </p>
                )}
              </div>

              <div className="md:w-56 space-y-3 text-xs">
                <div>
                  <div className="font-semibold mb-1">Reporter</div>
                  <div>{activeReport.reporter_id}</div>
                </div>
                <div>
                  <div className="font-semibold mb-1">Status</div>
                  <div>{statusLabel[activeReport.status] ?? activeReport.status}</div>
                </div>

                <form onSubmit={handleRemoveSubmit} className="space-y-2">
                  <input
                    type="hidden"
                    name="reportId"
                    value={activeReport.id}
                  />
                  <input
                    type="hidden"
                    name="mediaId"
                    value={activeReport.media.id}
                  />
                  <button
                    type="submit"
                    disabled={buttonsBusy}
                    className={`w-full h-9 rounded-full text-xs font-semibold text-black transition ${
                      buttonsBusy
                        ? "bg-red-500/60 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-400"
                    }`}
                  >
                    {removeLoading ? "Removing..." : "Remove media"}
                  </button>
                </form>

                <form onSubmit={handleIgnoreSubmit}>
                  <input
                    type="hidden"
                    name="reportId"
                    value={activeReport.id}
                  />
                  <button
                    type="submit"
                    disabled={buttonsBusy}
                    className={`w-full h-9 rounded-full text-xs font-semibold transition ${
                      buttonsBusy
                        ? "bg-white/10 opacity-60 cursor-not-allowed"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {ignoreLoading ? "Ignoring..." : "Ignore"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
