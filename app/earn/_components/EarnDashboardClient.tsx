"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAffiliate, requestPayout, savePaypalEmail, type EarnDashboardData } from "@/lib/actions/earn";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EarnDashboardClient({ initial }: { initial: EarnDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState(initial.paypalEmail ?? "");
  const [confirm, setConfirm] = useState(initial.paypalEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    const entries = Object.entries(initial.visitsPerDay ?? {})
      .map(([date, visits]) => ({ date, visits: Number(visits ?? 0) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Only show earnings "since PayPal email set" (your requirement)
    const since = initial.paypalEmailSetAt ? initial.paypalEmailSetAt.slice(0, 10) : null;
    return since ? entries.filter((r) => r.date >= since) : [];
  }, [initial.visitsPerDay, initial.paypalEmailSetAt]);

  const totalUsd = initial.totalUsd;
  const canPayout = totalUsd >= 50 && !!initial.paypalEmail;

  const isAffiliate = initial.userType === "affiliate";
  const rateLabel = isAffiliate ? "Affiliate" : "Ordinary";
  const rateText = isAffiliate ? "100% cut" : "70% cut";

  const onSaveEmail = () => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      const res = await savePaypalEmail(email, confirm);
      if (!res.ok) {
        setError(res.error ?? "Failed to save email.");
        return;
      }
      setToast("PayPal email saved.");
      router.refresh();
    });
  };

  const onApplyAffiliate = () => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      const res = await applyAffiliate();
      if (!res.ok) {
        setError(res.error ?? "Failed to apply.");
        return;
      }
      setToast("Affiliate request sent. Check back in a week for rate changes.");
      router.refresh();
    });
  };

  const onPayout = () => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      const res = await requestPayout();
      if (!res.ok) {
        setError(res.error ?? "Payout request failed.");
        return;
      }
      setToast(`Payout requested: $${money(res.amountUsd ?? totalUsd)}. Processing by Saturday.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* PayPal email card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-white font-semibold">PayPal email</div>
            <div className="text-white/70 text-sm mt-1">
              {initial.paypalEmail ? (
                <>
                  Currently set to <span className="text-white">{initial.paypalEmail}</span>. You can change it anytime.
                </>
              ) : (
                <>Add your PayPal email to start tracking earnings.</>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="PayPal email"
            className="h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-white placeholder:text-white/40"
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm PayPal email"
            className="h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-white placeholder:text-white/40"
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={onSaveEmail}
            disabled={pending}
            className="h-11 px-4 rounded-xl bg-white text-black font-semibold disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save email"}
          </button>

          <div className="text-xs text-white/60">
            Requests must be submitted before <b>Thursday</b>. Payouts run every <b>Saturday</b>. Miss the deadline and you’ll be paid the following Saturday.
          </div>
        </div>
      </div>

      {/* Rate + affiliate card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-white font-semibold">Your rate</div>
            <div className="text-white/70 text-sm mt-1">
              Status: <span className="text-white">{rateLabel}</span> • Rate:{" "}
              <span className="text-white">${initial.rate}</span> per visit • You’re currently on a <span className="text-white">{rateText}</span> from our ad revenue.
              <div className="mt-1 text-white/50">
                Rate may increase as we get more ad purchases.
              </div>
            </div>
          </div>

          <button
            onClick={onApplyAffiliate}
            disabled={pending || initial.hasAffiliateRequest || isAffiliate}
            className="h-11 px-4 rounded-xl border border-white/15 bg-black/40 text-white font-semibold disabled:opacity-60"
            title={isAffiliate ? "You are already an affiliate." : initial.hasAffiliateRequest ? "Request already submitted." : ""}
          >
            {isAffiliate ? "Affiliate ✅" : initial.hasAffiliateRequest ? "Affiliate request sent" : "Apply to be an affiliate (100% cut)"}
          </button>
        </div>

        {!isAffiliate && (
          <div className="mt-3 text-xs text-white/60">
            If your rate hasn’t changed after a week, your affiliate request was rejected.
          </div>
        )}
      </div>

      {/* Earnings table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Daily earnings</div>
            <div className="text-white/60 text-sm mt-1">
              Earnings are calculated as <b>visits × rate</b> (USD), starting from when you added your PayPal email.
            </div>
          </div>

          <button
            onClick={onPayout}
            disabled={pending || !canPayout}
            className="h-11 px-4 rounded-xl bg-emerald-400/90 text-black font-semibold disabled:opacity-60"
          >
            {pending ? "Requesting..." : "Payout"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="text-left py-2">Date</th>
                <th className="text-right py-2">Visits</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Earnings (USD)</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-white/50">
                    No earnings yet. Make sure your PayPal email is saved, then share your profile link.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const earned = r.visits * initial.rate;
                  return (
                    <tr key={r.date} className="border-b border-white/5">
                      <td className="py-2">{r.date}</td>
                      <td className="py-2 text-right">{r.visits}</td>
                      <td className="py-2 text-right">${initial.rate}</td>
                      <td className="py-2 text-right">${money(earned)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot>
              <tr className="border-t border-white/10">
                <td className="py-3 font-semibold">Total</td>
                <td />
                <td />
                <td className="py-3 text-right font-semibold">${money(totalUsd)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-white/60">
          <div>Minimum payout: <b>$50</b>.</div>
          {!canPayout ? (
            <div className="text-white/50">
              {!initial.paypalEmail ? "Add your PayPal email to enable payouts." : `You need $${money(50 - totalUsd)} more to request a payout.`}
            </div>
          ) : (
            <div className="text-white/50">Ready to request payout.</div>
          )}
        </div>

        {initial.lastPayout ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
            Last request: <b>${money(initial.lastPayout.amountUsd)}</b> • Submitted{" "}
            <span className="text-white/60">{new Date(initial.lastPayout.requestedAt).toLocaleString()}</span> • Processing by Saturday.
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
        {toast ? <div className="mt-3 text-sm text-emerald-300">{toast}</div> : null}
      </div>
    </div>
  );
}
