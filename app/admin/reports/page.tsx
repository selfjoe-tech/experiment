// app/admin/reports/page.tsx
import { supabase } from "@/lib/supabaseClient";
import ReportsClient from "./ReportsClient";

const PAGE_SIZE = 20;

// Next.js style search params (can be string or string[]).
type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function getParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export type ReportStatus = "pending" | "ignored" | "media removed";
export type StatusFilter = "all" | ReportStatus;

export type ReportRow = {
  id: number;
  reason: string | null;
  status: ReportStatus;
  reporter_id: string;
  media_id: number | null;
  media: {
    id: number;
    media_type: string;
    storage_path: string;
  } | null;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // --- pagination / filters ---
  const rawPage = getParam(searchParams, "page") ?? "1";
  const parsedPage = Number.parseInt(rawPage, 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const rawStatus = getParam(searchParams, "status");
  const status: StatusFilter =
    rawStatus === "pending" ||
    rawStatus === "ignored" ||
    rawStatus === "media removed"
      ? rawStatus
      : "all";

  const q = (getParam(searchParams, "q") ?? "").trim();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // --- 1) fetch reports (only media_id) ---
  let reportsQuery = supabase
    .from("reports")
    .select(
      `
      id,
      reason,
      status,
      reporter_id,
      media_id
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    reportsQuery = reportsQuery.eq("status", status);
  }

  if (q) {
    const idNum = Number(q);
    if (!Number.isNaN(idNum)) {
      reportsQuery = reportsQuery.eq("id", idNum);
    } else {
      reportsQuery = reportsQuery.ilike("reason", `%${q}%`);
    }
  }

  const {
    data: rawReports,
    count,
    error: reportsError,
  } = await reportsQuery;

  if (reportsError) {
    console.error("AdminReportsPage reports error", reportsError);
  }

  const reportsBase = (rawReports ?? []) as {
    id: number;
    reason: string | null;
    status: ReportStatus;
    reporter_id: string;
    media_id: number | null;
  }[];

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  // --- 2) fetch media rows for those media_ids ---
  const mediaIds = Array.from(
    new Set(
      reportsBase
        .map((r) => r.media_id)
        .filter((id): id is number => id != null)
    )
  );

  let mediaById: Record<
    number,
    { id: number; media_type: string; storage_path: string }
  > = {};

  if (mediaIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from("media")
      .select("id, media_type, storage_path")
      .in("id", mediaIds);

    if (mediaError) {
      console.error("AdminReportsPage media error", mediaError);
    } else {
      mediaById = Object.fromEntries(
        (mediaRows ?? []).map((m) => [m.id, m as any])
      );
    }
  }

  // --- 3) enrich reports with media object ---
  const reports: ReportRow[] = reportsBase.map((r) => ({
    ...r,
    media: r.media_id ? mediaById[r.media_id] ?? null : null,
  }));

  const errorMessage = reportsError?.message ?? null;

  return (
    <ReportsClient
      reports={reports}
      page={page}
      totalPages={totalPages}
      status={status}
      q={q}
      errorMessage={errorMessage}
    />
  );
}
