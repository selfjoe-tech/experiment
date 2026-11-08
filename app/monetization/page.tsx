import type { Metadata } from "next";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import WatchLinkExample from "./WatchLinkExample";

export const metadata: Metadata = {
  title: "Creator monetization",
  description: "How Goongram creators earn from eligible video watch links, including rates, ad-loaded views and manual PayPal payouts.",
  alternates: { canonical: "https://goongram.com/monetization" },
  openGraph: {
    title: "Creator monetization | Goongram",
    description: "Learn how video monetization works before joining Goongram.",
    url: "https://goongram.com/monetization",
  },
};

export const dynamic = "force-dynamic";

async function getVideoExample(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("media")
      .select("id")
      .eq("media_type", "video")
      .gte("duration_seconds", 30)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    const id = Number(data?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

const steps = [
  {
    number: "01",
    title: "Upload a video",
    description: "Post a video that is at least 30 seconds long. Images and shorter videos are not eligible.",
  },
  {
    number: "02",
    title: "Share the Watch link",
    description: "Open the full video and copy its goongram.com/watch/… address. This exact page is where eligible revenue is generated. Your videos will also been seen on reels to direct traffic to your videos, so we help out too",
  },
  {
    number: "03",
    title: "Qualifying loads earn",
    description: "A visit can count only after the traffic passes validation. A visitor simply viewing a video on reels does not count.",
  },
  {
    number: "04",
    title: "Request a payout",
    description: "View earnings per video, add a PayPal email and payout after you reach the minimum payout which is $30.",
  },
];

export default async function MonetizationInfoPage() {
  const exampleId = await getVideoExample();
  const exampleUrl = exampleId ? `https://goongram.com/watch/${exampleId}` : null;

  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell />
    <MobileChrome />
    <main className="mx-auto w-full max-w-[1200px] px-5 pb-32 pt-[94px] sm:px-9 lg:pl-[106px] lg:pr-8 lg:pt-16">
      <div className="mx-auto max-w-[920px]">
        <header className="border-b border-white/10 pb-10 sm:pb-12">
          <h1 className="max-w-3xl text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[1.02] tracking-[-0.065em]">
            Get paid for your videos.
          </h1>
          <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-white/60 sm:text-[17px]">
            Publish a video. Earn when visitors watch your videos.
            Every user can participate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/earn" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#0b0d10] hover:bg-white/90">
              My earnings <ArrowRight size={17}/>
            </a>
            <a href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-medium hover:bg-white/[.06]">
              Upload a video <ArrowUpRight size={16}/>
            </a>
          </div>
        </header>

        <section className="border-b border-white/10 py-9 sm:py-12" aria-labelledby="share-heading">
          
          <h2 id="share-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Share the video.
          </h2>
          <p className="mt-3 max-w-[640px] text-sm leading-6 text-white/60">
            Your monetizable link begins with <span className="font-mono text-white">goongram.com/watch/</span> followed by
            your video ID. An example of what it looks like:
          </p>
          <WatchLinkExample url={exampleUrl}/>
          
        </section>

        <section className="border-b border-white/10 py-10 sm:py-14" aria-labelledby="rates-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="rates-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Your earning rate</h2>
            <span className="text-xs text-white/45">USD per 1,000 page views</span>
          </div>
          <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="bg-[#111317] p-6 sm:p-8">
              <p className="text-sm text-white/55">All creators</p>
              <div className="mt-2 text-[46px] font-semibold tracking-[-0.06em]">$0.25</div>
              <p className="mt-1 text-xs text-white/45">No verification needed</p>
            </div>
            <div className="bg-[#111317] p-6 sm:p-8">
              <p className="text-sm text-white/55">Verified creators</p>
              <div className="mt-2 text-[46px] font-semibold tracking-[-0.06em]">$0.37</div>
              <p className="mt-1 text-xs text-white/45">Verification is an optional higher rate</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/50">
            These are rates for qualifying visits, not a guarantee for every click or video view.
            Estimates are reviewed against advertising reports before manual payment.
          </p>
        </section>

        <section className="border-b border-white/10 py-10 sm:py-14" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-6 divide-y divide-white/10 border-t border-white/10">
            {steps.map(step => <div key={step.number} className="grid gap-3 py-6 sm:grid-cols-[52px_225px_1fr] sm:gap-6">
              <span className="font-mono text-sm text-white/40">{step.number}</span>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="text-sm leading-6 text-white/55">{step.description}</p>
            </div>)}
          </div>
        </section>

        <section className="grid gap-8 border-b border-white/10 py-10 sm:grid-cols-[1fr_1fr] sm:gap-12 sm:py-14" aria-labelledby="qualifying-heading">
          <div>
            <h2 id="qualifying-heading" className="text-xl font-semibold tracking-tight">What counts</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
              <li>A video that lasts at least 30 seconds</li>
              <li>A visit to that video's individual <span className="font-mono text-white">/watch/ID</span> page</li>
              <li>A completed ad-load signal that passes our traffic checks</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">What doesn't count</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
              <li>Profile visits, image views or short videos</li>
              <li>Reels and Explore previews without opening the full Watch page</li>
              <li>Blocked, incomplete, duplicate or suspicious activity</li>
            </ul>
          </div>
        </section>

        <section className="border-b border-white/10 py-10 sm:py-14" aria-labelledby="payout-heading">
          <h2 id="payout-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Getting paid</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
            <div>
              <div className="text-[32px] font-semibold tracking-tight">$30</div>
              <h3 className="mt-1 text-sm font-medium">Minimum balance</h3>
              <p className="mt-2 text-xs leading-5 text-white/55">Reach 30 USD in available eligible earnings to request a payout.</p>
            </div>
            <div>
              <div className="text-[32px] font-semibold tracking-tight">Friday</div>
              <h3 className="mt-1 text-sm font-medium">Weekly processing</h3>
              <p className="mt-2 text-xs leading-5 text-white/55">Requests submitted on Friday are processed for that same Friday. Requests submitted from Saturday to Thursday are scheduled for the following Friday.</p>
            </div>
            <div>
              <div className="text-[32px] font-semibold tracking-tight">3 days</div>
              <h3 className="mt-1 text-sm font-medium">Payment window</h3>
              <p className="mt-2 text-xs leading-5 text-white/55">Payment is due in 2-3 business days. If there are any issues with payment, contact us at contact@goongram.com</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-white/60">
            Save your PayPal email in <a href="/earn" className="font-medium text-white underline underline-offset-4">My earnings</a> before
            requesting payment. You can request once every seven days, and a previous pending request must be settled first.
            
          </p>
        </section>

        <section className="py-10 sm:py-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-5 text-2xl font-semibold tracking-tight">FAQs</h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            <details className="group py-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">Do I have to be verified?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">No. Any creator can earn at the ordinary rate. Verification is optional and increases your rate for future eligible Watch loads.</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">Will sharing my profile or Reels link earn money?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Not directly. Viewers must open your specific full-video URL, such as goongram.com/watch/5</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">Does a page load always earn?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">No. Ads may not fill, may be blocked or may fail to finish loading. Duplicate and suspicious visits are excluded. Earnings are provisional until reconciled with ad-network reporting.</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">Can I earn before saving my PayPal email?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Yes. Your eligible video earnings accrue automatically. You only need a PayPal email when you request a manual payout.</p>
            </details>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href="/earn" className="inline-flex items-center gap-2 border-b border-white pb-1 text-sm font-semibold hover:text-pink-300">View my earnings <ArrowUpRight size={16}/></a>
            <a href="/auth/signup" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white">Create a creator account <ArrowRight size={16}/></a>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
