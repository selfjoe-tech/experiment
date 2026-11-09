// app/admin/verify/page.tsx
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/server/requireAdmin";
import VerifyClient from "./VerifyClient";
import { presignR2 } from "@/lib/server/r2";

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
  id: number;
  creator_id: string;
  status: VerifyStatus;
  selfie_path: string | null;
  selfie_url: string | null;
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
  await requireAdmin();
  const supabase = getSupabaseAdmin();
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
      storage_path,
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

  const { data: rawRequests = [], count, error } = await query;

  const requests: VerifyRequestRow[] = await Promise.all(
    rawRequests.map(async (request) => {
      const path = request.storage_path ?? request.selfie_path ?? null;
      let selfieUrl: string | null = null;

      if (path?.startsWith("r2-private:")) {
        selfieUrl = presignR2({ key: path.slice("r2-private:".length), method: "GET", isPrivate: true, expires: 600 });
      } else if (path) {
        const { data: privateUrl, error: privateError } = await supabase.storage
          .from("verification")
          .createSignedUrl(path, 60 * 10);

        if (!privateError && privateUrl?.signedUrl) {
          selfieUrl = privateUrl.signedUrl;
        } else {
          // Older verification selfies were stored in the public media bucket.
          const { data: publicUrl } = supabase.storage
            .from("media")
            .getPublicUrl(path);
          selfieUrl = publicUrl.publicUrl ?? null;
        }
      }

      return { ...request, selfie_url: selfieUrl } as VerifyRequestRow;
    })
  );

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
