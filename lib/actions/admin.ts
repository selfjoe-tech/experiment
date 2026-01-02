"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type AffiliateStatus = "pending" | "accepted" | "rejected";
type AffiliateFilter = "all" | AffiliateStatus;

type PayoutStatus = "pending" | "paid";
type PayoutFilter = "all" | "paid" | "not_paid";

export type AffiliateRequestRow = {
  id: string;
  user_id: string;
  username: string;
  status: AffiliateStatus;
  created_at: string;
};

export type PayoutRequestRow = {
  id: string;
  user_id: string;
  username: string;
  verified: boolean;
  amount_usd: number;
  status: PayoutStatus;
  created_at: string;
};

function clampPage(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export async function adminGetAffiliateRequests(args: {
  filter: AffiliateFilter;
  page: number;
  pageSize: number;
}): Promise<{ rows: AffiliateRequestRow[]; total: number; page: number; pageSize: number }> {
  const supabase = getSupabaseAdmin();
  const page = clampPage(args.page);
  const pageSize = Math.min(100, Math.max(5, args.pageSize));

  let q = supabase
    .from("affiliate_requests")
    .select("id,user_id,username,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (args.filter !== "all") q = q.eq("status", args.filter);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const res = await q.range(from, to);
  if (res.error) throw new Error(res.error.message);

  return {
    rows: (res.data ?? []) as AffiliateRequestRow[],
    total: res.count ?? 0,
    page,
    pageSize,
  };
}

export async function adminAcceptAffiliateRequest(requestId: string) {
  const supabase = getSupabaseAdmin();
  const id = String(requestId || "").trim();
  if (!id) return { ok: false, error: "Missing request id." };

  // Load request (we need user_id + username)
  const reqRes = await supabase
    .from("affiliate_requests")
    .select("id,user_id,username,status")
    .eq("id", id)
    .single();

  if (reqRes.error) return { ok: false, error: reqRes.error.message };
  const req = reqRes.data as { user_id: string; username: string; status: AffiliateStatus };

  // 1) Mark request accepted
  const upReq = await supabase.from("affiliate_requests").update({ status: "accepted" }).eq("id", id);
  if (upReq.error) return { ok: false, error: upReq.error.message };

  // 2) Upgrade earnings row (rate is PER 1,000 views)
  const upEarn = await supabase
    .from("creator_earnings")
    .upsert(
      {
        user_id: req.user_id,
        username: req.username,
        user_type: "affiliate",
        rate: 0.21,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upEarn.error) return { ok: false, error: upEarn.error.message };

  return { ok: true };
}

export async function adminRejectAffiliateRequest(requestId: string) {
  const supabase = getSupabaseAdmin();
  const id = String(requestId || "").trim();
  if (!id) return { ok: false, error: "Missing request id." };

  const res = await supabase.from("affiliate_requests").update({ status: "rejected" }).eq("id", id);
  if (res.error) return { ok: false, error: res.error.message };

  return { ok: true };
}

export async function adminGetPayoutRequests(args: {
  filter: PayoutFilter;
  page: number;
  pageSize: number;
}): Promise<{ rows: PayoutRequestRow[]; total: number; page: number; pageSize: number }> {
  const supabase = getSupabaseAdmin();
  const page = clampPage(args.page);
  const pageSize = Math.min(100, Math.max(5, args.pageSize));

  let q = supabase
    .from("payout_requests")
    .select("id,user_id,username,verified,amount_usd,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (args.filter === "paid") q = q.eq("status", "paid");
  if (args.filter === "not_paid") {
    // status != paid OR status is null (if you ever had nulls)
    q = q.or("status.is.null,status.neq.paid");
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const res = await q.range(from, to);
  if (res.error) throw new Error(res.error.message);

  return {
    rows: (res.data ?? []) as PayoutRequestRow[],
    total: res.count ?? 0,
    page,
    pageSize,
  };
}

export async function adminMarkPayoutPaid(requestId: string) {
  const supabase = getSupabaseAdmin();
  const id = String(requestId || "").trim();
  if (!id) return { ok: false, error: "Missing request id." };

  const res = await supabase.from("payout_requests").update({ status: "paid" }).eq("id", id);
  if (res.error) return { ok: false, error: res.error.message };

  return { ok: true };
}
