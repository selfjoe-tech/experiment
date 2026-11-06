"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Clock3, Copy, ExternalLink, Play, X } from "lucide-react";
import { requestPayout, savePaypalEmail, type EarnDashboardData } from "@/lib/actions/earn";

const money = (value: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
function localDate(value: string | null) {
  if (!value) return "Not scheduled";
  const dateValue = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(dateValue.getTime())
    ? value
    : dateValue.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" });
}
function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export default function EarnDashboardClient({ initial }: { initial: EarnDashboardData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"videos" | "payouts">("videos");
  const [email, setEmail] = useState(initial.paypalEmail ?? "");
  const [confirm, setConfirm] = useState(initial.paypalEmail ?? "");
  const [showEmailForm, setShowEmailForm] = useState(!initial.paypalEmail);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  const earningVideo = initial.videos.find(video => video.eligible);
  const watchUrl = earningVideo ? `https://goongram.com/watch/${earningVideo.mediaId}` : null;

  function handleSave() {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await savePaypalEmail(email, confirm);
        if (!result.ok) {
          setNotice({ error: true, text: result.error || "Could not save PayPal email." });
          return;
        }
        setNotice({ error: false, text: "Your PayPal email has been saved." });
        setShowEmailForm(false);
        router.refresh();
      } catch {
        setNotice({ error: true, text: "Could not save PayPal email." });
      }
    });
  }

  function handlePayout() {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await requestPayout();
        if (!result.ok) {
          setNotice({ error: true, text: result.error || "Could not request payout." });
          return;
        }
        setNotice({
          error: false,
          text: `Payout requested: USD ${money(result.amountUsd || 0)}. Scheduled by ${localDate(result.paymentDueDate || null)}.`,
        });
        setView("payouts");
        router.refresh();
      } catch {
        setNotice({ error: true, text: "Could not request payout." });
      }
    });
  }

  async function copyLink() {
    if (!watchUrl) return;
    try {
      await navigator.clipboard.writeText(watchUrl);
      setCopied(true);
    } catch {
      setNotice({ error: true, text: "Your browser could not copy this link. You can select the address instead." });
    }
  }

  return <div className="text-white">
    {notice && <div role="status" className={`mb-7 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${notice.error
      ? "border-rose-500/30 bg-rose-500/[.08] text-rose-200"
      : "border-white/15 bg-white/[.04] text-white/80"}`}>
      <span>{notice.text}</span>
      <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={16}/></button>
    </div>}

    {/* One clear balance hierarchy, not a grid of dashboard cards. */}
    <section className="border-b border-white/10 pb-8 sm:pb-10">
      <p className="text-xs font-medium text-white/50">Available balance</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-white/45">USD</span>
        <strong className="text-[clamp(3.5rem,8vw,5.5rem)] font-semibold leading-none tracking-[-0.07em] tabular-nums">
          {money(initial.totalUsd)}
        </strong>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/55">
        Earnings from eligible visits to the full video page only.
      </p>
      <div className="mt-8 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6">
        <div className="min-w-0 pr-3">
          <p className="text-lg font-semibold tabular-nums sm:text-2xl">{number(initial.eligibleViews)}</p>
          <p className="mt-1 text-[11px] leading-4 text-white/50">Eligible loads</p>
        </div>
        <div className="min-w-0 px-3 sm:px-6">
          <p className="text-lg font-semibold tabular-nums sm:text-2xl">{money(initial.lifetimeUsd)}</p>
          <p className="mt-1 text-[11px] leading-4 text-white/50">Lifetime USD</p>
        </div>
        <div className="min-w-0 pl-3 sm:pl-6">
          <p className="text-lg font-semibold tabular-nums sm:text-2xl">{money(initial.pendingUsd)}</p>
          <p className="mt-1 text-[11px] leading-4 text-white/50">Pending USD</p>
        </div>
      </div>
    </section>

    {/* Make the revenue-generating URL unmistakable. */}
    <section className="border-b border-white/10 py-8 sm:py-10">
      <div className="flex items-start justify-between gap-5">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">The link that earns</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/55">
            Only visits to your video's full <span className="font-mono text-white">goongram.com/watch/ID</span> page
            can earn. Send viewers this link, not your profile or the Reels preview.
            An eligible video must be at least 30 seconds long, and the Watch-page ads must finish loading.
          </p>
        </div>
        <a href="/monetization" className="shrink-0 text-xs font-semibold text-white/70 underline underline-offset-4 hover:text-white">
          How it works
        </a>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/[.035] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] text-white/45">{watchUrl ? "Example from one of your eligible videos" : "Your video link format"}</p>
          <p className="break-all font-mono text-[13px] font-semibold text-white">
            {watchUrl || "https://goongram.com/watch/VIDEO_ID"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {watchUrl && <a href={watchUrl} aria-label="Open example Watch video"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs hover:bg-white/[.06]">
            Open <ExternalLink size={14}/>
          </a>}
          <button type="button" onClick={copyLink} disabled={!watchUrl}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs hover:bg-white/[.06] disabled:opacity-40">
            {copied ? <Check size={14}/> : <Copy size={14}/>}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {!watchUrl && <a href="/upload" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white">
        Upload an eligible video to get your own link <ArrowUpRight size={14}/>
      </a>}
    </section>

    <section className="py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[20px] font-semibold tracking-tight">Activity</h2>
        <span className="text-xs text-white/50">{initial.verified ? "Verified" : "Ordinary"} rate · USD {initial.rate.toFixed(2)} / 1,000</span>
      </div>
      <div role="tablist" aria-label="Earnings activity" className="mt-5 flex gap-7 border-b border-white/10">
        <button type="button" role="tab" aria-selected={view === "videos"} onClick={() => setView("videos")}
          className={`border-b-2 pb-3 text-[13px] font-semibold ${view === "videos" ? "border-white text-white" : "border-transparent text-white/45"}`}>
          Videos <span className="ml-1 text-white/40">{initial.videos.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={view === "payouts"} onClick={() => setView("payouts")}
          className={`border-b-2 pb-3 text-[13px] font-semibold ${view === "payouts" ? "border-white text-white" : "border-transparent text-white/45"}`}>
          Payouts <span className="ml-1 text-white/40">{initial.payouts.length}</span>
        </button>
      </div>
      {view === "videos" ? <div>
        <div className="hidden grid-cols-[minmax(0,1fr)_125px_120px_105px] gap-3 border-b border-white/[.07] py-3 text-[11px] font-medium text-white/40 sm:grid">
          <span>Video</span><span className="text-right">Eligible loads</span>
          <span className="text-right">Earned · USD</span><span className="text-right">Available · USD</span>
        </div>
        {initial.videos.length ? <div className="divide-y divide-white/[.075]">
          {initial.videos.map(video => <a href={`/watch/${video.mediaId}`} key={video.mediaId}
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 hover:bg-white/[.025] sm:grid-cols-[minmax(0,1fr)_125px_120px_105px]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-[56px] w-[48px] shrink-0 place-items-center rounded-md border border-white/10 bg-white/[.06]">
                <Play size={18} fill="currentColor" className="text-white/60"/>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white group-hover:underline">{video.title}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {formatDuration(video.durationSeconds)} · {video.eligible ? "Eligible" : "Not eligible: under 30s"}
                </p>
                <p className="mt-1 text-[11px] text-white/45 sm:hidden">
                  {number(video.eligibleViews)} loads · USD {money(video.earnedUsd)} earned
                </p>
              </div>
            </div>
            <span className="hidden text-right text-[13px] tabular-nums text-white/70 sm:block">{number(video.eligibleViews)}</span>
            <span className="hidden text-right text-[13px] tabular-nums text-white/70 sm:block">{money(video.earnedUsd)}</span>
            <span className="text-right text-[13px] font-semibold tabular-nums">{money(video.unpaidUsd)}<span className="ml-1 text-[10px] font-normal text-white/40 sm:hidden">USD</span></span>
          </a>)}
        </div> : <div className="py-12 text-center">
          <p className="text-sm font-medium">No videos yet</p>
          <p className="mt-2 text-xs text-white/45">Upload a video 30 seconds or longer to begin.</p>
          <a href="/upload" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold underline underline-offset-4">Upload video <ArrowUpRight size={14}/></a>
        </div>}
      </div> : <div className="divide-y divide-white/[.08]">
        {initial.payouts.length ? initial.payouts.map(payout => <div key={payout.id} className="flex items-center justify-between gap-4 py-5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{payout.status === "paid" ? "Paid" : "Pending payment"}</p>
            <p className="mt-1 text-xs text-white/45">Requested {localDate(payout.requestedAt)} · Due {localDate(payout.paymentDueDate)}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">USD {money(payout.amountUsd)}</span>
        </div>) : <div className="py-12 text-center text-sm text-white/45">You haven't requested a payout yet.</div>}
      </div>}
    </section>

    <section className="grid gap-8 border-t border-white/10 py-8 sm:py-10 lg:grid-cols-2 lg:gap-12">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight">PayPal payout details</h2>
        <p className="mt-2 max-w-sm text-[13px] leading-6 text-white/55">
          Your earnings accrue without PayPal. Add an email only when you're ready to request payment.
          Payments are sent manually; no account connection is needed.
        </p>
        {initial.paypalEmail && !showEmailForm ? <div className="mt-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <p className="text-xs text-white/45">Payout email</p>
            <p className="mt-1 truncate text-[13px] font-semibold">{initial.paypalEmail}</p>
          </div>
          <button type="button" onClick={() => setShowEmailForm(true)} className="text-xs font-semibold underline underline-offset-4">Edit</button>
        </div> : <div className="mt-5 space-y-4">
          <label className="block text-xs font-medium text-white/65">PayPal email
            <input type="email" autoComplete="email" value={email} maxLength={254} onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-transparent px-3 text-sm text-white outline-none focus:border-white/60"/>
          </label>
          <label className="block text-xs font-medium text-white/65">Confirm email
            <input type="email" value={confirm} maxLength={254} onChange={event => setConfirm(event.target.value)}
              placeholder="Repeat your email"
              className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-transparent px-3 text-sm text-white outline-none focus:border-white/60"/>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" disabled={pending || !email || !confirm || email !== confirm}
              onClick={handleSave}
              className="h-10 rounded-lg bg-white px-5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-40">
              {pending ? "Saving…" : "Save email"}
            </button>
            {initial.paypalEmail && <button type="button" onClick={() => setShowEmailForm(false)}
              className="text-xs text-white/55 hover:text-white">Cancel</button>}
          </div>
        </div>}
      </div>
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight">Request payment</h2>
        <p className="mt-2 text-[13px] leading-6 text-white/55">
          Minimum balance <span className="font-semibold text-white">USD {money(initial.minPayout)}</span>.
          Only one request every seven days. An existing pending payout must be paid first.
        </p>
        <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white/80" style={{ width: `${Math.max(0,Math.min(100, initial.totalUsd / initial.minPayout * 100))}%` }}/>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-white/50">
          <Clock3 size={14}/> Paid manually within three days after your scheduled Friday (by Monday).
        </p>
        <p className="mt-2 text-xs leading-5 text-white/50">
          Friday requests use that Friday. Requests made Saturday–Thursday are scheduled for the next Friday.
        </p>
        {initial.payoutBlockReason && <p className="mt-4 text-xs text-white/65">{initial.payoutBlockReason}</p>}
        <button type="button" onClick={handlePayout} disabled={pending || !initial.canPayout}
          className="mt-6 inline-flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-lg bg-pink-500 px-6 text-sm font-semibold hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40">
          {pending ? "Submitting…" : "Request payout"} <ArrowRight size={16}/>
        </button>
      </div>
    </section>

    <p className="border-t border-white/10 py-6 text-xs leading-5 text-white/45">
      Video visits earn only after qualifying ad-load checks and anti-abuse validation.
      Figures are estimates until reconciled with advertising reports.
      <a href="/monetization" className="ml-1 text-white/80 underline underline-offset-2">Read the monetization rules.</a>
    </p>
  </div>;
}
