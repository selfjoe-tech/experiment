// app/admin/ads/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { renewAdBuyer } from "./actions";
import { AddAdvertiserDialog } from "./AddAdvertiserDialog";

const PAGE_SIZE = 20;

type SearchParams = {
  page?: string;
  status?: "expired" | "renewed" | "all";
  username?: string;
};

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base, "http://dummy");
  Object.entries(params).forEach(([k, v]) => {
    if (v && v.length > 0) url.searchParams.set(k, v);
  });
  return url.pathname + "?" + url.searchParams.toString();
}

export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const status = searchParams.status ?? "all";
  const usernameSearch = searchParams.username?.trim() ?? "";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("ad_buyers")
    .select(
      `
      id,
      user_id,
      advertiser_slot,
      payment_date,
      expires_at,
      status,
      profiles:user_id (
        username
      )
    `,
      { count: "exact" }
    )
    .order("payment_date", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (usernameSearch) {
    query = query.ilike("profiles.username", `%${usernameSearch}%`);
  }

  const { data: buyers = [], count, error } = await query;
  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  const now = Date.now();

  const rows = buyers?.map((b) => {
    const expiresAtMs = b.expires_at ? new Date(b.expires_at).getTime() : now;
    const daysLeft = Math.ceil(
      (expiresAtMs - now) / (24 * 60 * 60 * 1000)
    );
    return { ...b, daysLeft };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold">Ad buyers</h1>

        <div className="flex flex-wrap gap-2">
          <form
            className="flex flex-wrap gap-2"
            method="GET"
            action="/admin/ads"
          >
            <input
              type="text"
              name="username"
              placeholder="Search by username"
              defaultValue={usernameSearch}
              className="h-9 rounded-md bg-black/40 border border-white/20 px-3 text-sm"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md bg-black/40 border border-white/20 px-2 text-sm"
            >
              <option value="all">All</option>
              <option value="renewed">Renewed</option>
              <option value="expired">Expired</option>
            </select>
            <button
              type="submit"
              className="h-9 px-3 rounded-md bg-pink-500 text-black text-sm font-semibold"
            >
              Apply
            </button>
          </form>

          <AddAdvertiserDialog />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400">
          Failed to load advertisers: {error.message}
        </div>
      )}

      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
            <th className="px-3 py-2 text-left">Upload Url</th>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">Slot</th>
              <th className="px-3 py-2 text-left">Payment date</th>
              <th className="px-3 py-2 text-left">Days left</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-xs">
                  {b.profiles?.username ?? "unknown"}
                </td>
                <td>{`/ads/upload/${b.id}`}</td>
                <td className="px-3 py-2 text-xs">{b.user_id}</td>
                <td className="px-3 py-2 text-xs">{b.advertiser_slot}</td>
                <td className="px-3 py-2 text-xs">
                  {b.payment_date
                    ? new Date(b.payment_date).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {b.daysLeft >= 0 ? `${b.daysLeft} days` : "Expired"}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] ${
                      b.status === "renewed"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <form action={renewAdBuyer}>
                    <input type="hidden" name="id" value={b.id} />
                    <button
                      type="submit"
                      className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
                    >
                      Renew (+33 days)
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!rows  && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-xs text-white/60"
                >
                  No advertisers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-white/60">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={buildUrl("/admin/ads", {
                page: String(page - 1),
                status,
                username: usernameSearch,
              })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildUrl("/admin/ads", {
                page: String(page + 1),
                status,
                username: usernameSearch,
              })}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
