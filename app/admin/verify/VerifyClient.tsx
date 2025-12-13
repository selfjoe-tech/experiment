// app/admin/verify/VerifyClient.tsx
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { buildPublicUrl } from "@/lib/actions/mediaFeed";
import { approveVerification, rejectVerification } from "./actions";
import type { VerifyRequestRow, StatusFilter } from "./page";

type Props = {
  requests: VerifyRequestRow[];
  page: number;
  totalPages: number;
  status: StatusFilter;
  userIdSearch: string;
  errorMessage: string | null;
};

function buildPageHref(opts: {
  page: number;
  status: StatusFilter;
  userIdSearch: string;
}) {
  const params = new URLSearchParams();

  if (opts.page > 1) params.set("page", String(opts.page));
  if (opts.status !== "all") params.set("status", opts.status);
  if (opts.userIdSearch) params.set("userId", opts.userIdSearch);

  const qs = params.toString();
  return qs ? `/admin/verify?${qs}` : `/admin/verify`;
}

function parseLinks(
  raw: VerifyRequestRow["links"]
): Record<string, string> | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw as Record<string, string>;
  }

  return null;
}

export default function VerifyClient({
  requests,
  page,
  totalPages,
  status,
  userIdSearch,
  errorMessage,
}: Props) {
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  const activeRequest =
    activeRequestId != null
      ? requests?.find((r) => r.id === activeRequestId) ?? null
      : null;

  const linksObj = activeRequest ? parseLinks(activeRequest.links) : null;

  const buttonsBusy = approveLoading || rejectLoading;

  const handleApproveSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeRequest) return;

    try {
      setApproveLoading(true);
      const formData = new FormData(e.currentTarget);
      console.log(formData)
      const data = await approveVerification(formData);
        console.log(data)
      // on success: close modal
      setActiveRequestId(null);
    } catch (err) {
      console.error("Failed to approve verification", err);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeRequest) return;

    try {
      setRejectLoading(true);
      const formData = new FormData(e.currentTarget);
      await rejectVerification(formData);
      // on success: close modal
      setActiveRequestId(null);
    } catch (err) {
      console.error("Failed to reject verification", err);
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold">Verification requests</h1>

        <form
          className="flex flex-wrap gap-2"
          method="GET"
          action="/admin/verify"
        >
          <input
            type="text"
            name="userId"
            placeholder="Search by user id"
            defaultValue={userIdSearch}
            className="h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-md bg-black/40 border border-white/20 px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
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
          Failed to load requests: {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-xs">{r.id}</td>
                <td className="px-3 py-2 text-xs">
                  {r.profiles?.username ?? "unknown"}
                </td>
                <td className="px-3 py-2 text-xs">{r.creator_id}</td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      r.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : r.status === "accepted"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setActiveRequestId(r.id)}
                    className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}

            {!requests && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-xs text-white/60"
                >
                  No verification requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-white/60">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={buildPageHref({
                page: page - 1,
                status,
                userIdSearch,
              })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildPageHref({
                page: page + 1,
                status,
                userIdSearch,
              })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      {/* Modal: fully client-controlled (no URL changes) */}
      {activeRequest && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur flex items-center justify-center px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#111] border border-white/10 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Verify{" "}
                {activeRequest.profiles?.username ?? activeRequest.creator_id}
              </div>
              <button
                type="button"
                onClick={() => setActiveRequestId(null)}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-black/50 rounded-xl p-2 flex items-center justify-center">
                {activeRequest.selfie_path ? (
                  <img
                    src={buildPublicUrl(activeRequest.selfie_path)}
                    alt="Verification selfie"
                    className="max-h-[60vh] max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-xs text-white/50">
                    No selfie uploaded.
                  </div>
                )}
              </div>

              <div className="md:w-64 space-y-3 text-xs">
                <div>
                  <div className="font-semibold mb-1">User</div>
                  <div>{activeRequest.profiles?.username}</div>
                  <div className="text-white/60">
                    {activeRequest.creator_id}
                  </div>
                </div>

                {linksObj && (
                  <div>
                    <div className="font-semibold mb-1">Links</div>
                    <div className="space-y-1">
                      {Object.entries(linksObj).map(([k, v]) =>
                        v ? (
                          <a
                            key={k}
                            href={v}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[11px] text-pink-300 underline break-all"
                          >
                            {k}: {v}
                          </a>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleApproveSubmit}>
                  <input
                    type="hidden"
                    name="requestId"
                    value={activeRequest.id}
                  />
                  <input
                    type="hidden"
                    name="userId"
                    value={activeRequest.creator_id}
                  />
                  <button
                    type="submit"
                    disabled={buttonsBusy}
                    className={`w-full h-9 rounded-full text-xs font-semibold text-black transition ${
                      buttonsBusy
                        ? "bg-emerald-500/60 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-400"
                    }`}
                  >
                    {approveLoading ? "Accepting..." : "Accept"}
                  </button>
                </form>

                <form onSubmit={handleRejectSubmit} className="space-y-2">
                  <input
                    type="hidden"
                    name="requestId"
                    value={activeRequest.id}
                  />
                  <textarea
                    name="reason"
                    placeholder="Reason for rejection"
                    className="w-full h-16 rounded-md bg-black/40 border border-white/20 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={buttonsBusy}
                    className={`w-full h-9 rounded-full text-xs font-semibold transition ${
                      buttonsBusy
                        ? "bg-red-500/60 cursor-not-allowed"
                        : "bg-red-500 hover:bg-red-400"
                    }`}
                  >
                    {rejectLoading ? "Rejecting..." : "Reject"}
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
