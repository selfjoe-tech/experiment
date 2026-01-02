"use client";

import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminMarkPayoutPaid, type PayoutRequestRow } from "@/lib/actions/admin";
import { BadgeCheck, CheckCircle2, DollarSign } from "lucide-react";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Badge({ tone, children }: { tone: "neutral" | "good" | "warn"; children: React.ReactNode }) {
  const cls =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-white/15 bg-white/5 text-white/80";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${cls}`}>{children}</span>;
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <div className="text-xs text-white/60">
        Page <b className="text-white">{page}</b> of <b className="text-white">{totalPages}</b> • {total} results
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={!canPrev}
          onClick={() => onPage(page - 1)}
          className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white disabled:opacity-50"
        >
          Prev
        </button>
        <button
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function PayoutRequestsClient({
  initial,
  filter,
}: {
  initial: { rows: PayoutRequestRow[]; total: number; page: number; pageSize: number };
  filter: "all" | "paid" | "not_paid";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: "All" },
      { key: "not_paid" as const, label: "Not paid" },
      { key: "paid" as const, label: "Paid" },
    ],
    []
  );

  const setQuery = (next: { status?: string; page?: string }) => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (next.status != null) params.set("status", next.status);
    if (next.page != null) params.set("page", next.page);
    router.push(`?${params.toString()}`);
  };

  const onPaid = (id: string) => {
    startTransition(async () => {
      const res = await adminMarkPayoutPaid(id);
      if (!res.ok) return;
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setQuery({ status: t.key, page: "1" })}
            className={`h-10 rounded-2xl px-4 text-sm border ${
              filter === t.key ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/70 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4">Username</th>
              <th className="text-left py-3 px-4">Verified</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Requested at</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-right py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-white/50">
                  No payout requests found.
                </td>
              </tr>
            ) : (
              initial.rows.map((r, idx) => {
                const zebra = idx % 2 === 0 ? "bg-white/[0.03]" : "";
                const isPaid = r.status === "paid";
                return (
                  <tr key={r.id} className={`border-b border-white/5 ${zebra}`}>
                    <td className="py-3 px-4 font-semibold">{r.username}</td>
                    <td className="py-3 px-4">
                      {r.verified ? (
                        <Badge tone="good">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Not verified</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={isPaid ? "good" : "warn"}>{isPaid ? "paid" : "not paid"}</Badge>
                    </td>
                    <td className="py-3 px-4 text-white/70">{fmtDateTime(r.created_at)}</td>
                    <td className="py-3 px-4 text-right font-semibold">${money(Number(r.amount_usd ?? 0))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => onPaid(r.id)}
                          disabled={pending || isPaid}
                          className="h-9 rounded-xl bg-emerald-400/90 text-black px-3 font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Paid out
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="px-4">
          <Pager page={initial.page} pageSize={initial.pageSize} total={initial.total} onPage={(p) => setQuery({ page: String(p) })} />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {initial.rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/60">No payout requests found.</div>
        ) : (
          initial.rows.map((r) => {
            const isPaid = r.status === "paid";
            return (
              <div key={r.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold">{r.username}</div>
                    <div className="mt-1 text-xs text-white/60">{fmtDateTime(r.created_at)}</div>
                  </div>
                  <Badge tone={isPaid ? "good" : "warn"}>{isPaid ? "paid" : "not paid"}</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-sm text-white/70 inline-flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-white/60" />
                    Amount
                  </div>
                  <div className="text-white font-semibold">${money(Number(r.amount_usd ?? 0))}</div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    {r.verified ? (
                      <Badge tone="good">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Not verified</Badge>
                    )}
                  </div>

                  <button
                    onClick={() => onPaid(r.id)}
                    disabled={pending || isPaid}
                    className="h-11 rounded-2xl bg-emerald-400/90 text-black px-4 font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Paid out
                  </button>
                </div>
              </div>
            );
          })
        )}

        <Pager
          page={initial.page}
          pageSize={initial.pageSize}
          total={initial.total}
          onPage={(p) => {
            const params = new URLSearchParams(sp?.toString() ?? "");
            params.set("page", String(p));
            router.push(`?${params.toString()}`);
          }}
        />
      </div>
    </div>
  );
}
