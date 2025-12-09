// lib/actions/reports.ts
"use client";

export const REPORT_REASONS = [
  "Underaged",
  "Racist / Hate-Based Language Or Actions",
  "Animals / Acts Of Bestiality",
  "Rape / Sexual Assault",
  "Violence / Death / Disturbing Content",
  "Copyright / I Own This Content",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export async function submitReportClient(opts: {
  mediaId: number | string;
  reason: ReportReason;
  note?: string;
}) {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Failed to submit report");
  }

  return json as { success: true };
}
