"use server";


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



function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTotal(visitsPerDay: Record<string, number>, rate: number, since?: string | null) {
  const keys = Object.keys(visitsPerDay);
  const filtered = since
    ? keys.filter((k) => k >= since.slice(0, 10)) // compare YYYY-MM-DD strings
    : keys;

  let total = 0;
  for (const day of filtered) {
    total += (visitsPerDay[day] ?? 0) * rate;
  }
  return round2(total);
}

export async function getEarnDashboard(): Promise<EarnDashboardData> {
  const supabase = getSupabaseAdmin();

  const id = await getUserIdFromCookies();
  if (!id) throw new Error("Not authenticated");

  const userId = id;

  // Fetch profile + earnings + last payout + affiliate request in parallel (no waterfall after auth)
  const [profileRes, earnRes, payoutRes, affRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, verified")
      .eq("id", userId)
      .single(),
    supabase
      .from("creator_earnings")
      .select(
        "user_id, username, paypal_email, paypal_email_set_at, user_type, rate, visits_per_day, last_payout_amount_usd, last_payout_requested_at"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("payout_requests")
      .select("amount_usd, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("affiliate_requests")
      .select("id, status")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  const profile = profileRes.data;

  const earn = earnRes.data;

  const visitsPerDay: Record<string, number> = (earn?.visits_per_day ?? {}) as any;

  const userType = (earn?.user_type ?? "ordinary") as UserType;
  const rate = Number(earn?.rate ?? 0.147);

  const paypalEmail = earn?.paypal_email ?? null;
  const paypalEmailSetAt = earn?.paypal_email_set_at ?? null;

  const totalUsd = computeTotal(visitsPerDay, rate, paypalEmailSetAt);

  const lastPayout =
    payoutRes.data?.amount_usd != null
      ? {
          amountUsd: Number(payoutRes.data.amount_usd),
          requestedAt: payoutRes.data.created_at as string,
        }
      : earn?.last_payout_amount_usd != null
      ? {
          amountUsd: Number(earn.last_payout_amount_usd),
          requestedAt: (earn.last_payout_requested_at ?? new Date().toISOString()) as string,
        }
      : null;

  return {
    userId,
    username: profile.username,
    verified: !!profile.verified,
    paypalEmail,
    paypalEmailSetAt,
    userType,
    rate,
    visitsPerDay,
    totalUsd,
    lastPayout,
    hasAffiliateRequest: !!affRes.data,
  };
}

export async function savePaypalEmail(email: string, confirmEmail: string) {
  const supabase = getSupabaseAdmin();

  const id = await getUserIdFromCookies();
  if (!id) return { ok: false, error: "Not authenticated" };

  const clean = email.trim().toLowerCase();
  const clean2 = confirmEmail.trim().toLowerCase();

  if (!clean || !clean2) return { ok: false, error: "Please enter and confirm your PayPal email." };
  if (clean !== clean2) return { ok: false, error: "Emails do not match." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "Invalid email." };

  const profileRes = await supabase.from("profiles").select("id, username").eq("id", id).single();
  if (profileRes.error) return { ok: false, error: profileRes.error.message };

  const { username } = profileRes.data;

  // Upsert creator_earnings row. Default rate stays 0.147 unless you change it later.
  const upsertRes = await supabase
    .from("creator_earnings")
    .upsert(
      {
        user_id: id,
        username,
        paypal_email: clean,
        paypal_email_set_at: new Date().toISOString(),
        user_type: "ordinary",
        rate: 0.147,
      },
      { onConflict: "user_id" }
    );

  if (upsertRes.error) return { ok: false, error: upsertRes.error.message };

  return { ok: true };
}

export async function requestPayout() {
  const supabase = getSupabaseAdmin();

  const id = await getUserIdFromCookies();
  if (!id) return { ok: false, error: "Not authenticated" };

  // Fetch everything needed in parallel
  const [profileRes, earnRes] = await Promise.all([
    supabase.from("profiles").select("id, username, verified").eq("id", id).single(),
    supabase
      .from("creator_earnings")
      .select("paypal_email, paypal_email_set_at, rate, visits_per_day")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  if (profileRes.error) return { ok: false, error: profileRes.error.message };
  const profile = profileRes.data;

  const earn = earnRes.data;
  const paypalEmail = earn?.paypal_email ?? null;
  if (!paypalEmail) return { ok: false, error: "Add your PayPal email first." };

  const rate = Number(earn?.rate ?? 0.147);
  const visitsPerDay: Record<string, number> = (earn?.visits_per_day ?? {}) as any;

  const totalUsd = computeTotal(visitsPerDay, rate, earn?.paypal_email_set_at ?? null);

  if (totalUsd < 50) return { ok: false, error: "Minimum payout is $50." };

  // Insert payout request + reset table
  const nowIso = new Date().toISOString();

  const insertReq = supabase.from("payout_requests").insert({
    user_id: id,
    username: profile.username,
    verified: !!profile.verified,
    paypal_email: paypalEmail,
    amount_usd: totalUsd,
    status: "pending",
  });

  const resetEarn = supabase
    .from("creator_earnings")
    .update({
      visits_per_day: {},
      last_payout_amount_usd: totalUsd,
      last_payout_requested_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", id);

  const [insRes, resetRes] = await Promise.all([insertReq, resetEarn]);

  if (insRes.error) return { ok: false, error: insRes.error.message };
  if (resetRes.error) return { ok: false, error: resetRes.error.message };

  return { ok: true, amountUsd: totalUsd, requestedAt: nowIso };
}

export async function applyAffiliate() {
  const supabase = getSupabaseAdmin();

  
  const id = await getUserIdFromCookies();
  if (!id) return { ok: false, error: "Not authenticated" };

  const profileRes = await supabase.from("profiles").select("id, username").eq("id", id).single();
  if (profileRes.error) return { ok: false, error: profileRes.error.message };

  const { username } = profileRes.data;

  const res = await supabase
    .from("affiliate_requests")
    .insert({ user_id: id, username, status: "pending" })
    .throwOnError();

  // If already exists, just treat as ok
  if ((res as any)?.error?.code === "23505") return { ok: true };

  return { ok: true };
}
