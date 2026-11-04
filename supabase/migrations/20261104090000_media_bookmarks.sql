-- User-owned saved posts, separate from Likes.
create table if not exists public.media_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id bigint not null references public.media(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create index if not exists media_bookmarks_recent_idx
  on public.media_bookmarks (user_id, created_at desc);

alter table public.media_bookmarks enable row level security;

-- Safe when the table was initialized ahead of the app release.
drop policy if exists "bookmark_owner_read" on public.media_bookmarks;
drop policy if exists "bookmark_owner_insert" on public.media_bookmarks;
drop policy if exists "bookmark_owner_delete" on public.media_bookmarks;

create policy "bookmark_owner_read"
  on public.media_bookmarks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "bookmark_owner_insert"
  on public.media_bookmarks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "bookmark_owner_delete"
  on public.media_bookmarks for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.media_bookmarks to authenticated;
revoke all on public.media_bookmarks from anon;
