// app/admin/users/page.tsx
import { supabase } from "@/lib/supabaseClient";
import UsersClient from "./UsersClient";

const PAGE_SIZE = 20;

type SearchParams = {
  page?: string;
};

export type UserRow = {
  id: string;
  username: string | null;
  uploads: number;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1"));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const {
    data: users = [],
    count,
    error,
  } = await supabase
    .from("profiles")
    .select("id, username", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  // simple N+1 for 20 users is fine
  const uploadsByUser: Record<string, number> = {};
  await Promise.all(
    (users as { id: string }[]).map(async (u) => {
      const { count: mediaCount } = await supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", u.id);

      uploadsByUser[u.id] = mediaCount ?? 0;
    })
  );

  const rows: UserRow[] = (users as { id: string; username: string | null }[]).map(
    (u) => ({
      id: u.id,
      username: u.username,
      uploads: uploadsByUser[u.id] ?? 0,
    })
  );

  const errorMessage = error?.message ?? null;

  return (
    <UsersClient
      users={rows}
      page={page}
      totalPages={totalPages}
      errorMessage={errorMessage}
    />
  );
}
