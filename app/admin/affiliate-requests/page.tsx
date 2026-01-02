import AffiliateRequestsClient from "../_components/AffiliateRequestsClient";
import { adminGetAffiliateRequests } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

function getParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AffiliateRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const status = (getParam(searchParams?.status) ?? "all").toLowerCase();
  const filter = (["all", "pending", "accepted", "rejected"].includes(status) ? status : "all") as
    | "all"
    | "pending"
    | "accepted"
    | "rejected";

  const rawPage = getParam(searchParams?.page) ?? "1";
  const parsed = Number.parseInt(rawPage, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const pageSize = 25;

  const data = await adminGetAffiliateRequests({ filter, page, pageSize });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Affiliate requests</h1>
        <p className="text-white/70 mt-1">Accepting upgrades a creator to Affiliate ($0.21 / 1,000 views).</p>
      </div>

      <AffiliateRequestsClient initial={data} filter={filter} />
    </div>
  );
}
