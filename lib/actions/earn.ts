"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "../supabaseAdmin";
import { getUserIdFromCookies } from "./auth";

type UserType = "ordinary" | "affiliate";

export type EarnDashboardData = {
  userId: string;
  username: string;
  verified: boolean;
  paypalEmail: string | null;
  paypalEmailSetAt: string | null;
  userType: UserType;
  rate: number;
  visitsPerDay: Record<string, number>;
  totalUsd: number;
  lastPayout: { amountUsd: number; requestedAt: string } | null;
  hasAffiliateRequest: boolean;
};

type RpcResult = {
  ok?: boolean;
  error?: string;
  amountUsd?: number;
  requestedAt?: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function computeTotal(
  visitsPerDay: Record<string, number>,
  ratePer1k: number,
  since?: string | null
) {
  const cutoff = since ? since.slice(0, 10) : null;
  let total = 0;

  for (const [day, rawVisits] of Object.entries(visitsPerDay)) {
    if (cutoff && day < cutoff) continue;
    const visits = Number(rawVisits) || 0;
    total += (visits / 1000) * ratePer1k;
  }

  return round2(total);
}

async function requireUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated.");
  }

  return { supabase, user };
}

export async function getEarnDashboard(): Promise<EarnDashboardData> {
  const { supabase, user } = await requireUserClient();

  const [profileRes, earnRes, payoutRes, affiliateRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, verified")
      .eq("id", user.id)
      .single(),
    supabase
      .from("creator_earnings")
      .select(
        "user_id, username, paypal_email, paypal_email_set_at, user_type, rate, visits_per_day, last_payout_amount_usd, last_payout_requested_at"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("payout_requests")
      .select("amount_usd, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("affiliate_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (earnRes.error) throw new Error(earnRes.error.message);
  if (payoutRes.error) throw new Error(payoutRes.error.message);
  if (affiliateRes.error) throw new Error(affiliateRes.error.message);

  const profile = profileRes.data;
  const earn = earnRes.data;
  const visitsPerDay = (earn?.visits_per_day ?? {}) as Record<string, number>;
  const userType = (earn?.user_type ?? "ordinary") as UserType;
  const defaultRate = userType === "affiliate" ? 0.21 : 0.147;
  const rate = Number(earn?.rate ?? defaultRate);
  const paypalEmail = earn?.paypal_email ?? null;
  const paypalEmailSetAt = earn?.paypal_email_set_at ?? null;
  const totalUsd = computeTotal(visitsPerDay, rate, paypalEmailSetAt);

  const lastPayout =
    payoutRes.data?.amount_usd != null
      ? {
          amountUsd: Number(payoutRes.data.amount_usd),
          requestedAt: payoutRes.data.created_at,
        }
      : earn?.last_payout_amount_usd != null
      ? {
          amountUsd: Number(earn.last_payout_amount_usd),
          requestedAt:
            earn.last_payout_requested_at ?? new Date().toISOString(),
        }
      : null;

  return {
    userId: user.id,
    username: profile.username,
    verified: Boolean(profile.verified),
    paypalEmail,
    paypalEmailSetAt,
    userType,
    rate,
    visitsPerDay,
    totalUsd,
    lastPayout,
    hasAffiliateRequest: Boolean(affiliateRes.data),
  };
}

export async function savePaypalEmail(email: string, confirmEmail: string) {
  const { supabase } = await requireUserClient();

  const { data, error } = await supabase.rpc("save_creator_paypal_email", {
    p_email: email,
    p_confirm_email: confirmEmail,
  });

  if (error) {
    console.error("savePaypalEmail RPC error", error);
    return { ok: false, error: error.message };
  }

  const result = data as RpcResult;
  return result?.ok
    ? { ok: true }
    : { ok: false, error: result?.error ?? "Could not save PayPal email." };
}

export async function requestPayout() {
  const { supabase } = await requireUserClient();

  const { data, error } = await supabase.rpc("request_creator_payout");

  if (error) {
    console.error("requestPayout RPC error", error);
    return { ok: false, error: error.message };
  }

  const result = data as RpcResult;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "Could not submit payout request." };
  }

  return {
    ok: true,
    amountUsd: Number(result.amountUsd ?? 0),
    requestedAt: String(result.requestedAt ?? new Date().toISOString()),
  };
}

export async function applyAffiliate() {
  const { supabase } = await requireUserClient();

  const { data, error } = await supabase.rpc("apply_for_affiliate");

  if (error) {
    console.error("applyAffiliate RPC error", error);
    return { ok: false, error: error.message };
  }

  const result = data as RpcResult;
  return result?.ok
    ? { ok: true }
    : { ok: false, error: result?.error ?? "Could not submit affiliate request." };
}

/**
 * Public profile visit accounting remains server-side because it updates
 * another creator's private earning counters. The RPC itself is restricted
 * to service_role; ordinary user operations above do not use the Admin client.
 */
export async function trackProfileVisitByUsername(viewedUsername: string) {
  const username = String(viewedUsername ?? "").trim();
  if (!username) return { ok: false, error: "Missing username." };

  const admin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (!profile?.id) {
    return { ok: true, skipped: true, reason: "not_found" };
  }

  const viewerId = await getUserIdFromCookies().catch(() => null);
  if (viewerId && viewerId === profile.id) {
    return { ok: true, skipped: true, reason: "self" };
  }

  const { data: earnings, error: earningsError } = await admin
    .from("creator_earnings")
    .select("paypal_email_set_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (earningsError) {
    return { ok: false, error: earningsError.message };
  }
  if (!earnings?.paypal_email_set_at) {
    return { ok: true, skipped: true, reason: "not_tracking" };
  }

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { error: incrementError } = await admin.rpc(
    "increment_creator_daily_visit",
    {
      p_user_id: profile.id,
      p_day: day,
    }
  );

  if (incrementError) {
    return { ok: false, error: incrementError.message };
  }

  return { ok: true };
}
