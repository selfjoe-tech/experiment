// app/admin/users/UsersClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserRow } from "./page";
import { deleteUser } from "./actions";

type Props = {
  users: UserRow[];
  page: number;
  totalPages: number;
  errorMessage: string | null;
};

function buildPageHref(page: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default function UsersClient({
  users,
  page,
  totalPages,
  errorMessage,
}: Props) {
  const [rows, setRows] = useState<UserRow[]>(users);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [confirmUsername, setConfirmUsername] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openConfirm = (user: UserRow) => {
    setConfirmUserId(user.id);
    setConfirmUsername(user.username ?? user.id);
    setDeleteError(null);
  };

  const closeConfirm = () => {
    setConfirmUserId(null);
    setConfirmUsername(null);
    setDeletingId(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!confirmUserId) return;
    try {
      setDeletingId(confirmUserId);
      setDeleteError(null);
      await deleteUser(confirmUserId);

      // Optimistically update local UI
      setRows((prev) => prev.filter((u) => u.id !== confirmUserId));
      closeConfirm();
    } catch (err) {
      console.error("Failed to delete user", err);
      setDeleteError("Failed to delete user. Please try again.");
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-xs text-white/50 mt-1">
            Manage user accounts and see how much they&apos;ve uploaded.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="text-xs text-red-400">
          Failed to load users: {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left hidden sm:table-cell">
                User ID
              </th>
              <th className="px-4 py-2 text-left">Uploads</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                className="border-t border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] uppercase">
                      {(u.username ?? u.id).slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {u.username ?? "Unknown"}
                      </span>
                      <span className="text-[11px] text-white/40 sm:hidden break-all">
                        {u.id}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[11px] text-white/60 hidden sm:table-cell break-all">
                  {u.id}
                </td>
                <td className="px-4 py-3 text-xs sm:text-sm">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                    {u.uploads} upload{u.uploads === 1 ? "" : "s"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openConfirm(u)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20 hover:text-red-100 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-xs text-white/60"
                >
                  No users found.
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
              href={buildPageHref(page - 1)}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildPageHref(page + 1)}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmUserId && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#111] border border-white/10 p-4 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Delete user</div>
              <button
                type="button"
                onClick={closeConfirm}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-white/70">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {confirmUsername ?? "this user"}
              </span>
              ? This will remove the user and their uploads.
            </p>

            {deleteError && (
              <div className="text-[11px] text-red-400">{deleteError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeConfirm}
                className="h-9 px-3 rounded-full bg-white/10 text-xs hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmUserId}
                className={`h-9 px-4 rounded-full text-xs font-semibold ${
                  deletingId === confirmUserId
                    ? "bg-red-500/60 text-black cursor-wait"
                    : "bg-red-500 text-black hover:bg-red-400"
                }`}
              >
                {deletingId === confirmUserId ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
