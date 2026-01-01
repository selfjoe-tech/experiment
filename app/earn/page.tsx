import { Suspense } from "react";
import EarnDashboardServer from "./_components/EarnDashboardServer";
import EarnDashboardSkeleton from "./_components/EarnDashboardSkeleton";

export default function EarnPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Earn</h1>
        <p className="text-white/70 mt-1">
          Get paid for profile traffic. Add your PayPal email to start tracking earnings.
        </p>
      </div>

      <Suspense fallback={<EarnDashboardSkeleton />}>
        <EarnDashboardServer />
      </Suspense>
    </div>
  );
}
