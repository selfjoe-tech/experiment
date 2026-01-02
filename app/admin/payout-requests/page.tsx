import PayoutRequestsClient from "../_components/PayoutRequestsClient";
import { adminGetPayoutRequests } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

function getParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PayoutRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const status = (getParam(searchParams.status) ?? "all").toLowerCase();
  const filter = (["all", "paid", "not_paid"].includes(status) ? status : "all") as "all" | "paid" | "not_paid";

  const rawPage = getParam(searchParams.page) ?? "1";
  const parsed = Number.parseInt(rawPage, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const pageSize = 25;

  const data = await adminGetPayoutRequests({ filter, page, pageSize });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Payout requests</h1>
        <p className="text-white/70 mt-1">Mark requests as paid once you’ve completed the payout.</p>
      </div>

      <PayoutRequestsClient initial={data} filter={filter} />
    </div>
  );
}
