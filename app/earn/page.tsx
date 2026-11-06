import type { Metadata } from "next";
import { Suspense } from "react";
import EarnDashboardServer from "./_components/EarnDashboardServer";
import EarnDashboardSkeleton from "./_components/EarnDashboardSkeleton";

export const metadata: Metadata = {
  title: "My earnings",
  description: "Private creator balance, video earnings and PayPal payout settings on Goongram.",
  robots: { index: false, follow: false },
};

export default function EarnPage() {
  return <main className="mx-auto w-full max-w-[1120px] px-5 pb-32 pt-[88px] sm:px-8 lg:pl-[106px] lg:pr-8 lg:pt-14">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-6">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-0.04em]">Monetization</h1>
        <p className="mt-1 text-[13px] text-white/50">Track your videos, earnings and payments.</p>
      </div>
      <a href="/monetization" className="text-[13px] font-semibold text-white/70 underline underline-offset-4 hover:text-white">
        Program guide
      </a>
    </header>
    <Suspense fallback={<EarnDashboardSkeleton/>}>
      <EarnDashboardServer/>
    </Suspense>
  </main>;
}
