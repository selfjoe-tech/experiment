// app/admin/dashboard/page.tsx
import { supabase } from "@/lib/supabaseClient"; // adjust import

async function getCounts() {

  const [profilesRes, adsRes, mediaRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("ads").select("*", { count: "exact", head: true }),
    supabase.from("media").select("*", { count: "exact", head: true }),
  ]);

  return {
    users: profilesRes.count ?? 0,
    ads: adsRes.count ?? 0,
    media: mediaRes.count ?? 0,
  };
}

export default async function AdminDashboardPage() {
  const { users, ads, media } = await getCounts();

  const cardCls =
    "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 flex flex-col gap-1";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cardCls}>
          <div className="text-xs text-white/60 uppercase">Users</div>
          <div className="text-3xl font-semibold">{users}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs text-white/60 uppercase">Ads</div>
          <div className="text-3xl font-semibold">{ads}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs text-white/60 uppercase">Media</div>
          <div className="text-3xl font-semibold">{media}</div>
        </div>
      </div>
    </div>
  );
}
