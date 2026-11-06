"use server";

import { cookies } from "next/headers";
import { verifyAdminJwt } from "@/lib/adminJwt";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) throw new Error("Admin authentication required.");

  try {
    await verifyAdminJwt(token);
  } catch {
    throw new Error("Your admin session has expired. Please sign in again.");
  }
}

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
  paypal_email: string;
  settlement_friday: string | null;
  payment_due_date: string | null;
  paid_at: string | null;
  qualifying_loads: number;
  ledger_usd: number;
  matches_amount: boolean;
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const page = clampPage(args.page);
  const pageSize = Math.min(100, Math.max(5, args.pageSize));

  let q = supabase
    .from("payout_requests")
    .select("id,user_id,username,verified,paypal_email,amount_usd,status,created_at,settlement_friday,payment_due_date,paid_at", { count: "exact" })
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

  const ids = (res.data ?? []).map(row => Number(row.id));
  const summary = ids.length ? await supabase.rpc("get_payout_ledger_summary", { p_ids: ids })
    : { data: [], error: null };
  if (summary.error) throw new Error(summary.error.message);
  const auditMap = new Map(((summary.data ?? []) as Array<{
    payout_id: number; qualifying_loads: number; ledger_usd: number;
    matches_amount: boolean;
  }>).map(item => [String(item.payout_id), item]));
  const rows = (res.data ?? []).map(row => {
    const audit = auditMap.get(String(row.id));
    return {
      ...row,
      qualifying_loads: Number(audit?.qualifying_loads ?? 0),
      ledger_usd: Number(audit?.ledger_usd ?? 0),
      matches_amount: audit?.matches_amount === true,
    };
  }) as PayoutRequestRow[];

  return { rows, total: res.count ?? 0, page, pageSize };
}

export async function adminMarkPayoutPaid(requestId: string) {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const id = String(requestId || "").trim();
  if (!/^[0-9]+$/.test(id)) return { ok: false, error: "Invalid payout request id." };

  const audit = await supabase.rpc("get_payout_ledger_summary", { p_ids: [Number(id)] });
  if (audit.error) return { ok: false, error: audit.error.message };
  if (!audit.data?.[0]?.matches_amount) {
    return { ok: false, error: "Payout cannot be marked paid until the ledger totals reconcile." };
  }

  // A conditional update prevents duplicate "paid" transitions.
  const res = await supabase.from("payout_requests")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (res.error) return { ok: false, error: res.error.message };
  if (!res.data) return { ok: false, error: "Request has already been paid or no longer exists." };

  return { ok: true };
}
