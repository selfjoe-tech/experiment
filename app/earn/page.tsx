import { Suspense } from "react";
import EarnDashboardServer from "./_components/EarnDashboardServer";
import EarnDashboardSkeleton from "./_components/EarnDashboardSkeleton";

export default function EarnPage() {
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-28 sm:px-6">
    <header className="mb-7">
      <h1 className="text-2xl font-bold tracking-tight text-white">Creator earnings</h1>
      <p className="mt-1 text-sm text-white/60">
        Earn from eligible Watch-page video loads. Verification is optional.
      </p>
    </header>
    <Suspense fallback={<EarnDashboardSkeleton/>}>
      <EarnDashboardServer/>
    </Suspense>
  </main>;
}
