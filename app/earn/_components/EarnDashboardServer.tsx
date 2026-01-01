import { getEarnDashboard } from "@/lib/actions/earn";
import EarnDashboardClient from "./EarnDashboardClient";

export default async function EarnDashboardServer() {
  const data = await getEarnDashboard();
  return <EarnDashboardClient initial={data} />;
}
