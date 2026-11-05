"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Banknote, CheckCircle2, Clock3, CreditCard, ExternalLink,
  Film, Info, Mail, ShieldCheck, TrendingUp,
} from "lucide-react";
import { requestPayout, savePaypalEmail, type EarnDashboardData } from "@/lib/actions/earn";

const money = (v: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(v);
const date = (value: string | null) => {
  if (!value) return "Pending";
  return new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
    .toLocaleDateString("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" });
};
const duration = (s: number | null) => {
  if (s === null) return "Unknown";
  const sec = Math.floor(s);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
function Metric({ title, value, detail, icon: Icon }: {
  title: string; value: string; detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.035] p-5">
    <div className="flex items-center gap-2 text-xs font-medium text-white/55">
      <Icon size={16}/>{title}
    </div>
    <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">{value}</div>
    <p className="mt-1 text-xs text-white/45">{detail}</p>
  </div>;
}
export default function EarnDashboardClient({ initial }: { initial: EarnDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(initial.paypalEmail ?? "");
  const [confirm, setConfirm] = useState(initial.paypalEmail ?? "");
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const handleSave = () => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await savePaypalEmail(email, confirm);
        if (!res.ok) return setNotice({ error: true, text: res.error || "Could not save email." });
        setNotice({ error: false, text: "PayPal payout email saved." });
        router.refresh();
      } catch {
        setNotice({ error: true, text: "Could not save your PayPal email." });
      }
    });
  };
  const handlePayout = () => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await requestPayout();
        if (!res.ok) return setNotice({ error: true, text: res.error || "Payout request failed." });
        setNotice({
          error: false,
          text: `Requested $${money(res.amountUsd || 0)}. Scheduled manual payment by ${date(res.paymentDueDate || null)}.`,
        });
        router.refresh();
      } catch {
        setNotice({ error: true, text: "Unable to request payout." });
      }
    });
  };

  return <div className="space-y-6 text-white">
    {notice && <div role="status" className={`rounded-xl border p-3 text-sm ${notice.error
      ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
      : "border-white/15 bg-white/[.06] text-white/90"}`}>{notice.text}</div>}

    <section className="rounded-2xl border border-white/10 bg-[#14161b] px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your video earnings</h2>
          <p className="mt-1 text-sm text-white/55">
            All creators qualify. Verification changes your rate, not your eligibility.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75">
          {initial.verified ? <BadgeCheck size={15} className="text-sky-400"/> : <ShieldCheck size={15}/>}
          {initial.verified ? "Verified creator" : "Ordinary creator"}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Available balance" value={`$${money(initial.totalUsd)}`}
          detail="Unpaid eligible Watch loads" icon={Banknote}/>
        <Metric title="Eligible page loads" value={initial.eligibleViews.toLocaleString()}
          detail="After ad-load checks" icon={Film}/>
        <Metric title="Your rate" value={`$${initial.rate.toFixed(2)}`}
          detail="Per 1,000 qualifying loads" icon={TrendingUp}/>
        <Metric title="Pending payment" value={`$${money(initial.pendingUsd)}`}
          detail="Awaiting manual payment" icon={Clock3}/>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-lg bg-white/[.035] p-3 text-xs leading-5 text-white/60">
        <Info size={16} className="mt-0.5 shrink-0"/>
        Only videos at least 30 seconds long qualify. Earnings are estimated from eligible Watch-page ad loads
        and are subject to anti-abuse checks and ad-network reconciliation before payment.
        Profile visits, Reels previews and image views do not earn money.
      </div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#14161b] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Earnings by video</h3>
          <p className="mt-1 text-xs text-white/50">Calculated from individual eligible visits at the creator's rate when each visit was counted.</p>
        </div>
        <span className="text-xs text-white/45">Lifetime: $${money(initial.lifetimeUsd)}</span>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-white/50">
            <tr>
              <th className="py-3 pr-3 font-medium">Video</th>
              <th className="py-3 pr-3 font-medium">Duration</th>
              <th className="py-3 pr-3 text-right font-medium">Eligible loads</th>
              <th className="py-3 pr-3 text-right font-medium">Lifetime earned</th>
              <th className="py-3 text-right font-medium">Available</th>
            </tr>
          </thead>
          <tbody>
            {initial.videos.length ? initial.videos.map(video =>
              <tr key={video.mediaId} className="border-b border-white/[.055]">
                <td className="max-w-[260px] py-3 pr-3">
                  <a href={`/watch/${video.mediaId}`} className="inline-flex max-w-full items-center gap-1.5 font-medium hover:underline">
                    <span className="truncate">{video.title}</span><ExternalLink size={13} className="shrink-0 text-white/40"/>
                  </a>
                  {!video.eligible && <div className="mt-1 text-[11px] text-amber-300/80">Not eligible (under 30s or unknown duration)</div>}
                </td>
                <td className="py-3 pr-3 text-white/65">{duration(video.durationSeconds)}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{video.eligibleViews.toLocaleString()}</td>
                <td className="py-3 pr-3 text-right tabular-nums">$${money(video.earnedUsd)}</td>
                <td className="py-3 text-right font-medium tabular-nums">$${money(video.unpaidUsd)}</td>
              </tr>
            ) : <tr><td colSpan={5} className="py-10 text-center text-sm text-white/50">No videos uploaded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#14161b] p-5 sm:p-6">
        <div className="flex items-center gap-2"><Mail size={19} className="text-white/65"/><h3 className="text-lg font-semibold">PayPal email</h3></div>
        <p className="mt-2 text-xs leading-5 text-white/55">
          Add the PayPal email where you want to receive manual payouts. Your uploads earn even before an email is saved.
          No PayPal account connection is required.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-xs text-white/65">PayPal email
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" maxLength={254}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/35"/>
          </label>
          <label className="block text-xs text-white/65">Confirm PayPal email
            <input type="email" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat email" maxLength={254}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/35"/>
          </label>
          <button type="button" onClick={handleSave} disabled={pending}
            className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50">
            {pending ? "Saving…" : "Save PayPal email"}
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#14161b] p-5 sm:p-6">
        <div className="flex items-center gap-2"><CreditCard size={19} className="text-white/65"/><h3 className="text-lg font-semibold">Request payout</h3></div>
        <div className="mt-5 text-3xl font-semibold tabular-nums">$${money(initial.totalUsd)}</div>
        <p className="mt-1 text-xs text-white/55">Minimum payout: $30.00 USD</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/80"
            style={{ width: `${Math.min(100, initial.totalUsd / 30 * 100)}%` }}/>
        </div>
        <p className="mt-4 text-xs leading-5 text-white/60">
          Manual PayPal payouts are processed within three days after the applicable Friday, no later than Monday.
          Requests submitted Saturday through Thursday are scheduled for the next Friday.
          One request is allowed every seven days. Existing pending requests must be settled first.
        </p>
        {initial.payoutBlockReason && <p className="mt-3 text-xs text-amber-200/80">{initial.payoutBlockReason}</p>}
        <button type="button" onClick={handlePayout} disabled={pending || !initial.canPayout}
          className="mt-5 h-11 w-full rounded-xl bg-pink-500 px-5 text-sm font-semibold text-white hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40">
          {pending ? "Submitting…" : "Request payout"}
        </button>
      </section>
    </div>
    <section className="rounded-2xl border border-white/10 bg-[#14161b] p-5 sm:p-6">
      <h3 className="text-lg font-semibold">Payout history</h3>
      <p className="mt-1 text-xs text-white/50">Requests and payment status, recorded separately from lifetime video earnings.</p>
      <div className="mt-5 space-y-2">
        {initial.payouts.length ? initial.payouts.map(payout =>
          <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3 text-sm">
            <div>
              <p className="font-semibold">$${money(payout.amountUsd)}
                <span className="ml-2 text-xs font-normal text-white/50">{payout.status === "paid" ? "Paid" : "Pending manual payment"}</span>
              </p>
              <p className="mt-1 text-[11px] text-white/45">Requested {date(payout.requestedAt)} · Due {date(payout.paymentDueDate)}</p>
            </div>
            {payout.status === "paid" ? <CheckCircle2 size={18} className="text-emerald-400"/> : <Clock3 size={18} className="text-white/45"/>}
          </div>
        ) : <p className="py-6 text-sm text-white/45">No payout requests yet.</p>}
      </div>
    </section>
  </div>;
}
