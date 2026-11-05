"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type VideoEarning = {
  mediaId: number;
  title: string;
  durationSeconds: number | null;
  eligible: boolean;
  eligibleViews: number;
  earnedUsd: number;
  unpaidUsd: number;
};
export type PayoutHistoryEntry = {
  id: number;
  amountUsd: number;
  status: string;
  requestedAt: string;
  settlementFriday: string | null;
  paymentDueDate: string | null;
  paidAt: string | null;
};
export type EarnDashboardData = {
  username: string;
  verified: boolean;
  rate: number;
  paypalEmail: string | null;
  videos: VideoEarning[];
  totalUsd: number;
  lifetimeUsd: number;
  pendingUsd: number;
  eligibleViews: number;
  minPayout: number;
  canPayout: boolean;
  payoutBlockReason: string | null;
  payouts: PayoutHistoryEntry[];
};

async function authenticatedUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (!user || error) redirect("/auth/login?redirect=%2Fearn");
  return { client, user };
}
const amount = (value: unknown) => Number(value ?? 0) || 0;

export async function getEarnDashboard(): Promise<EarnDashboardData> {
  const { user } = await authenticatedUser();
  const admin = getSupabaseAdmin();

  const [profileResult, settingsResult, videosResult, payoutsResult] = await Promise.all([
    admin.from("profiles").select("id,username,verified").eq("id", user.id).single(),
    admin.from("creator_earnings").select("paypal_email").eq("user_id", user.id).maybeSingle(),
    admin.rpc("get_creator_video_earnings", { p_creator_id: user.id }),
    admin.from("payout_requests")
      .select("id,amount_usd,status,created_at,settlement_friday,payment_due_date,paid_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (videosResult.error) throw new Error(videosResult.error.message);
  if (payoutsResult.error) throw new Error(payoutsResult.error.message);

  const verified = Boolean(profileResult.data?.verified);
  const rate = verified ? 0.37 : 0.25;
  const videos: VideoEarning[] = ((videosResult.data ?? []) as Array<{
    media_id: number; title: string; duration_seconds: number | null;
    qualified_views: number; earned_usd: number; unpaid_usd: number;
  }>).map(row => ({
    mediaId: Number(row.media_id),
    title: row.title || "Untitled video",
    durationSeconds: row.duration_seconds === null ? null : amount(row.duration_seconds),
    eligible: row.duration_seconds !== null && Number(row.duration_seconds) >= 30,
    eligibleViews: amount(row.qualified_views),
    earnedUsd: amount(row.earned_usd),
    unpaidUsd: amount(row.unpaid_usd),
  }));

  const payouts: PayoutHistoryEntry[] = (payoutsResult.data ?? []).map(row => ({
    id: Number(row.id), amountUsd: amount(row.amount_usd),
    status: String(row.status ?? "pending"),
    requestedAt: String(row.created_at),
    settlementFriday: row.settlement_friday ?? null,
    paymentDueDate: row.payment_due_date ?? null,
    paidAt: row.paid_at ?? null,
  }));
  const totalUsd = videos.reduce((sum, video) => sum + video.unpaidUsd, 0);
  const lifetimeUsd = videos.reduce((sum, video) => sum + video.earnedUsd, 0);
  const pendingUsd = payouts.filter(p => p.status === "pending")
    .reduce((sum, payout) => sum + payout.amountUsd, 0);
  const recent = payouts[0];
  const nextRequestTime = recent
    ? new Date(new Date(recent.requestedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const paypalEmail = settingsResult.data?.paypal_email ?? null;
  const payoutBlockReason =
    !paypalEmail ? "Add your PayPal email to request a payout." :
    pendingUsd > 0 ? "Your previous payout request is awaiting manual payment." :
    nextRequestTime && nextRequestTime.getTime() > Date.now()
      ? `You can request again from ${nextRequestTime.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}.` :
    Math.round(totalUsd * 100) / 100 < 30 ? "The minimum payout balance is $30." : null;

  return {
    username: profileResult.data?.username ?? "",
    verified, rate, paypalEmail, videos,
    totalUsd, lifetimeUsd, pendingUsd,
    eligibleViews: videos.reduce((sum, v) => sum + v.eligibleViews, 0),
    minPayout: 30,
    canPayout: payoutBlockReason === null,
    payoutBlockReason,
    payouts,
  };
}

type RpcResult = {
  ok?: boolean;
  error?: string;
  amountUsd?: number;
  requestedAt?: string;
  paymentDueDate?: string;
};

export async function savePaypalEmail(email: string, confirmEmail: string) {
  const { client } = await authenticatedUser();
  const { data, error } = await client.rpc("save_creator_paypal_email", {
    p_email: email, p_confirm_email: confirmEmail,
  });
  if (error) return { ok: false, error: "Could not save PayPal email." };
  const response = data as RpcResult;
  return response?.ok
    ? { ok: true }
    : { ok: false, error: response?.error ?? "Could not save PayPal email." };
}

export async function requestPayout() {
  const { client } = await authenticatedUser();
  const { data, error } = await client.rpc("request_creator_payout");
  if (error) return { ok: false, error: "Could not submit a payout request." };
  const response = data as RpcResult;
  return response?.ok
    ? {
        ok: true, amountUsd: amount(response.amountUsd),
        requestedAt: String(response.requestedAt || ""),
        paymentDueDate: String(response.paymentDueDate || ""),
      }
    : { ok: false, error: response?.error ?? "Payout request was declined." };
}
