// app/admin/verify/page.tsx
import { supabase } from "@/lib/supabaseClient";
import VerifyClient from "./VerifyClient";

const PAGE_SIZE = 20;

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function getParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export type VerifyStatus = "pending" | "accepted" | "rejected";
export type StatusFilter = "all" | VerifyStatus;

export type VerifyRequestRow = {
  id: string;
  creator_id: string;
  status: VerifyStatus;
  selfie_path: string | null;
  links: any; // string | json | null from supabase
  created_at: string;
  profiles: {
    username: string | null;
  } | null;
};

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawPage = getParam(searchParams, "page") ?? "1";
  const parsedPage = Number.parseInt(rawPage, 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const rawStatus = getParam(searchParams, "status");
  let status: StatusFilter = "pending";
  if (
    rawStatus === "all" ||
    rawStatus === "pending" ||
    rawStatus === "accepted" ||
    rawStatus === "rejected"
  ) {
    status = rawStatus;
  }

  const userIdSearch = (getParam(searchParams, "userId") ?? "").trim();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("verify")
    .select(
      `
      id,
      creator_id,
      status,
      selfie_path,
      links,
      created_at,
      profiles:creator_id (
        username
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (userIdSearch) {
    query = query.eq("creator_id", userIdSearch);
  }

  const { data: requests = [], count, error } = await query;

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const errorMessage = error?.message ?? null;

  return (
    <VerifyClient
      requests={requests}
      page={page}
      totalPages={totalPages}
      status={status}
      userIdSearch={userIdSearch}
      errorMessage={errorMessage}
    />
  );
}
