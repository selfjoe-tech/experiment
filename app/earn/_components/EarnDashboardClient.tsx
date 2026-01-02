"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAffiliate, requestPayout, savePaypalEmail, type EarnDashboardData } from "@/lib/actions/earn";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crown,
  Info,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rateFmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function fmtDate(isoOrYmd: string) {
  // Accepts "YYYY-MM-DD" or full ISO
  const d = new Date(isoOrYmd.length === 10 ? `${isoOrYmd}T00:00:00Z` : isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const safeName = name.length <= 2 ? `${name[0] ?? ""}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${safeName}@${domain}`;
}

function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : tone === "info"
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : "border-white/15 bg-white/5 text-white/80";

  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${cls}`}>{children}</span>;
}

function InlineNotice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  title: string;
  children: React.ReactNode;
}) {
  const palette =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
      : tone === "bad"
      ? "border-red-400/20 bg-red-400/10 text-red-100"
      : "border-sky-400/20 bg-sky-400/10 text-sky-100";

  return (
    <div className={`rounded-2xl border p-3 ${palette}`}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-sm opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Toast({
  tone = "good",
  children,
  onClose,
}: {
  tone?: "good" | "bad" | "info";
  children: React.ReactNode;
  onClose: () => void;
}) {
  const palette =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : tone === "bad"
      ? "border-red-400/20 bg-red-400/10 text-red-100"
      : "border-sky-400/20 bg-sky-400/10 text-sky-100";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-4 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${palette}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">{children}</div>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/80 hover:bg-black/30"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function EarnDashboardClient({ initial }: { initial: EarnDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState(initial.paypalEmail ?? "");
  const [confirm, setConfirm] = useState(initial.paypalEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "good" | "bad" | "info"; msg: string } | null>(null);

  const sinceYmd = initial.paypalEmailSetAt ? initial.paypalEmailSetAt.slice(0, 10) : null;

  const rows = useMemo(() => {
    const entries = Object.entries(initial.visitsPerDay ?? {})
      .map(([date, visits]) => ({ date, views: Number(visits ?? 0) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return sinceYmd ? entries.filter((r) => r.date >= sinceYmd) : [];
  }, [initial.visitsPerDay, sinceYmd]);

  const totalUsd = initial.totalUsd;
  const minPayout = 50;
  const remaining = Math.max(0, minPayout - totalUsd);
  const progress = clamp01(totalUsd / minPayout);
  const canPayout = totalUsd >= minPayout && !!initial.paypalEmail;

  const isAffiliate = initial.userType === "affiliate";
  const rateLabel = isAffiliate ? "Affiliate" : "Ordinary";
  const rateText = isAffiliate ? "100% cut" : "70% cut";

  const totalViewsSince = useMemo(() => rows.reduce((acc, r) => acc + (r.views ?? 0), 0), [rows]);

  const onSaveEmail = () => {
    setError(null);
    setToast(null);

    startTransition(async () => {
      const res = await savePaypalEmail(email, confirm);
      if (!res.ok) {
        setError(res.error ?? "Failed to save email.");
        setToast({ tone: "bad", msg: res.error ?? "Failed to save email." });
        return;
      }
      setToast({ tone: "good", msg: "PayPal email saved." });
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
        setToast({ tone: "bad", msg: res.error ?? "Failed to apply." });
        return;
      }
      setToast({ tone: "info", msg: "Affiliate request sent. Check back in a week for rate changes." });
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
        setToast({ tone: "bad", msg: res.error ?? "Payout request failed." });
        return;
      }
      setToast({ tone: "good", msg: `Payout requested: $${money(res.amountUsd ?? totalUsd)}. Processing by Saturday.` });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <Toast tone={toast.tone} onClose={() => setToast(null)}>
          {toast.msg}
        </Toast>
      ) : null}

      {/* Header strip */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/7 to-white/3 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white/70" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Earnings</h2>
              {initial.verified ? (
                <Pill tone="good">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified
                </Pill>
              ) : (
                <Pill tone="neutral">Unverified</Pill>
              )}
            </div>
            <div className="mt-1 text-sm text-white/60">
              Your rate is <b className="text-white">${rateFmt(initial.rate)}</b> per <b className="text-white">1,000 views</b>.
              {sinceYmd ? (
                <>
                  {" "}
                  Tracking since <b className="text-white">{fmtDate(sinceYmd)}</b>.
                </>
              ) : (
                <> Add your PayPal email to start tracking.</>
              )}
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={onPayout}
              disabled={pending || !canPayout}
              className="h-11 px-4 rounded-2xl bg-emerald-400/90 text-black font-semibold disabled:opacity-60 hover:brightness-105 active:brightness-95"
            >
              {pending ? "Requesting..." : "Request payout"}
            </button>
          </div>
        </div>
      </div>

      {/* Top grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance / payout */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <Banknote className="h-4 w-4" />
                Balance
              </div>
              <div className="mt-2 text-3xl font-bold text-white">${money(totalUsd)}</div>
              <div className="mt-1 text-sm text-white/60">
                Minimum payout: <b className="text-white">${minPayout}</b>
              </div>
            </div>

            {canPayout ? (
              <Pill tone="good">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready
              </Pill>
            ) : (
              <Pill tone="warn">
                <TrendingUp className="h-3.5 w-3.5" />
                In progress
              </Pill>
            )}
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
              <div className="h-full bg-white/70" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>{Math.round(progress * 100)}%</span>
              {!canPayout ? (
                <span className="text-white/70">
                  Need <b className="text-white">${money(remaining)}</b> more
                </span>
              ) : (
                <span className="text-white/70">You can request now</span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
              <div>
                <div className="text-white font-semibold">Payout schedule</div>
                <div className="mt-0.5 text-white/70">
                  Submit before <b className="text-white">Thursday</b>. Paid every <b className="text-white">Saturday</b>.
                </div>
              </div>
            </div>
          </div>

          {initial.lastPayout ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              Last request: <b>${money(initial.lastPayout.amountUsd)}</b>
              <div className="mt-1 text-xs text-white/60">
                Submitted {new Date(initial.lastPayout.requestedAt).toLocaleString()} • Processing by Saturday
              </div>
            </div>
          ) : null}
        </div>

        {/* Rate / affiliate */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <Crown className="h-4 w-4" />
                Your rate
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone={isAffiliate ? "good" : "neutral"}>
                  {isAffiliate ? <BadgeCheck className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {rateLabel}
                </Pill>
                <Pill tone="info">
                  ${rateFmt(initial.rate)} / 1,000
                </Pill>
                <Pill tone="neutral">{rateText}</Pill>
              </div>

              <div className="mt-3 text-sm text-white/60">
                Rate may increase as ad purchases grow. Higher engagement = better deals for everyone.
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={onApplyAffiliate}
              disabled={pending || initial.hasAffiliateRequest || isAffiliate}
              className="w-full h-11 px-4 rounded-2xl border border-white/15 bg-black/40 text-white font-semibold disabled:opacity-60 hover:bg-black/50"
              title={isAffiliate ? "You are already an affiliate." : initial.hasAffiliateRequest ? "Request already submitted." : ""}
            >
              {isAffiliate ? "Affiliate ✅" : initial.hasAffiliateRequest ? "Affiliate request sent" : "Apply to be an affiliate (100% cut)"}
            </button>

            {!isAffiliate && (
              <div className="mt-2 text-xs text-white/60">
                If your rate hasn’t changed after a week, your affiliate request was rejected.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/70">Views since tracking started</div>
              <div className="text-sm font-semibold text-white">{totalViewsSince.toLocaleString()}</div>
            </div>
            <div className="mt-1 text-xs text-white/50">This is the total used to compute your earnings.</div>
          </div>
        </div>

        {/* PayPal card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <Mail className="h-4 w-4" />
                PayPal email
              </div>

              <div className="mt-2 text-sm text-white/70">
                {initial.paypalEmail ? (
                  <>
                    Currently set to <b className="text-white">{maskEmail(initial.paypalEmail)}</b>
                    <div className="mt-1 text-xs text-white/50">You can change it anytime. Tracking continues from your original start date.</div>
                  </>
                ) : (
                  <>Add your PayPal email to begin tracking earnings.</>
                )}
              </div>
            </div>

            {initial.paypalEmail ? (
              <Pill tone="good">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Set
              </Pill>
            ) : (
              <Pill tone="warn">Not set</Pill>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="PayPal email"
              className="h-11 rounded-2xl bg-black/40 border border-white/10 px-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/15"
            />
            <input
              type="email"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm email"
              className="h-11 rounded-2xl bg-black/40 border border-white/10 px-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/15"
            />
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              onClick={onSaveEmail}
              disabled={pending}
              className="h-11 px-4 rounded-2xl bg-white text-black font-semibold disabled:opacity-60 hover:brightness-105 active:brightness-95"
            >
              {pending ? "Saving..." : "Save email"}
            </button>

            <div className="text-xs text-white/60">
              Tip: Use the same email you want payouts sent to.
            </div>
          </div>
        </div>
      </div>

      {/* Notices */}
      {!initial.paypalEmail ? (
        <InlineNotice tone="info" title="You’re not tracking yet">
          Add your PayPal email above. After that, we’ll start counting views and calculating earnings automatically.
        </InlineNotice>
      ) : rows.length === 0 ? (
        <InlineNotice tone="warn" title="No earnings yet">
          Share your profile link and start getting views. We’ll populate your daily breakdown here.
        </InlineNotice>
      ) : null}

      {error ? (
        <InlineNotice tone="bad" title="Something went wrong">
          {error}
        </InlineNotice>
      ) : null}

      {/* History */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-white font-semibold text-lg">Daily breakdown</div>
            <div className="text-white/60 text-sm mt-1">
              Earnings = <b className="text-white">(views ÷ 1,000) × rate</b> (USD)
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60">
            <ChevronRight className="h-4 w-4 opacity-60" />
            <span className="hidden sm:inline">Desktop shows a table. Mobile shows cards.</span>
            <span className="sm:hidden">Swipe-friendly cards below.</span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="mt-4 space-y-3 md:hidden">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-white/60">
              No rows yet.
            </div>
          ) : (
            rows.map((r) => {
              const earned = (r.views / 1000) * initial.rate;
              return (
                <div key={r.date} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white font-semibold">{fmtDate(r.date)}</div>
                      <div className="mt-1 text-xs text-white/60">
                        Views: <b className="text-white">{r.views.toLocaleString()}</b> • Rate:{" "}
                        <b className="text-white">${rateFmt(initial.rate)}</b>/1,000
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">Earned</div>
                      <div className="text-white font-semibold">${money(earned)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center justify-between">
            <div className="text-white/70 text-sm">Total</div>
            <div className="text-white font-semibold">${money(totalUsd)}</div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="mt-4 hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="text-left py-3">Date</th>
                <th className="text-right py-3">Views</th>
                <th className="text-right py-3">Rate (per 1,000)</th>
                <th className="text-right py-3">Earned (USD)</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-white/50">
                    No earnings yet.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const earned = (r.views / 1000) * initial.rate;
                  const zebra = idx % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent";
                  return (
                    <tr key={r.date} className={`border-b border-white/5 ${zebra}`}>
                      <td className="py-3">{fmtDate(r.date)}</td>
                      <td className="py-3 text-right">{r.views.toLocaleString()}</td>
                      <td className="py-3 text-right">${rateFmt(initial.rate)}</td>
                      <td className="py-3 text-right font-semibold">${money(earned)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot>
              <tr className="border-t border-white/10">
                <td className="py-4 font-semibold">Total</td>
                <td />
                <td />
                <td className="py-4 text-right font-bold">${money(totalUsd)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer hint */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/60">
          <div>
            {canPayout ? (
              <span className="text-white/70">✅ You’re eligible to request payout.</span>
            ) : (
              <span className="text-white/70">Keep going: you need ${money(remaining)} more to hit ${minPayout}.</span>
            )}
          </div>
          <div className="text-white/50">Numbers may lag by a few minutes as views sync.</div>
        </div>
      </div>

      {/* Sticky mobile payout bar */}
      <div className="sm:hidden sticky bottom-3 z-40">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur px-3 py-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-white/60">Balance</div>
                <div className="text-white font-semibold truncate">${money(totalUsd)}</div>
              </div>
              <button
                onClick={onPayout}
                disabled={pending || !canPayout}
                className="h-11 shrink-0 px-4 rounded-2xl bg-emerald-400/90 text-black font-semibold disabled:opacity-60 hover:brightness-105 active:brightness-95"
              >
                {pending ? "..." : "Payout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
