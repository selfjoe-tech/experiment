-- Grants required by the new authenticated client and private per-user settings.

begin;

-- Preferences and inferred interests should not live on a publicly readable profile.
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences text[] not null default '{}'::text[],
  recs text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

insert into public.user_preferences (user_id, preferences, recs)
select
  p.id,
  coalesce(p.preferences, '{}'::text[]),
  coalesce(p.recs, '{}'::text[])
from public.profiles p
on conflict (user_id) do nothing;

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create own preferences" on public.user_preferences;
create policy "Users can create own preferences"
on public.user_preferences
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update on table public.user_preferences to authenticated;

-- Newly-created Auth users receive a private preferences row as well as a profile.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_email text;
begin
  v_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_email := lower(trim(coalesce(new.email, '')));

  if v_username !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'A valid username is required to create a profile.';
  end if;

  if v_email = '' then
    raise exception 'An email address is required to create a profile.';
  end if;

  insert into public.profiles (id, username, email)
  values (new.id, v_username, v_email)
  on conflict (id) do update
    set username = excluded.username,
        email = excluded.email;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

-- Profile reads remain column-limited. Authenticated users may edit only
-- ordinary profile fields; email changes are handled by Supabase Auth.
grant update (username, bio, avatar_url, links)
on public.profiles to authenticated;

-- User-owned media: keep client writes limited to fields the upload/editor UI uses.
grant insert (
  owner_id, media_type, audience, title, description,
  storage_path, duration_seconds, width, height, tags
) on public.media to authenticated;
grant update (description, tags)
on public.media to authenticated;
grant delete on public.media to authenticated;

-- Social graph and likes: public reads, authenticated owner writes.
grant select on public.follows to anon, authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

grant select on public.media_likes to anon, authenticated;
grant insert (media_id, user_id) on public.media_likes to authenticated;
grant delete on public.media_likes to authenticated;

grant select on public.ad_likes to anon, authenticated;
grant insert (ad_id, user_id) on public.ad_likes to authenticated;
grant delete on public.ad_likes to authenticated;

-- Ad buyer and ad ownership policies require corresponding SQL privileges.
grant select on public.ad_buyers to authenticated;
grant insert (
  owner_id, media_type, storage_path, landing_url, description
) on public.ads to authenticated;
grant update (description, tags, landing_url) on public.ads to authenticated;
grant delete on public.ads to authenticated;

-- Verification owners can read their own submission and create a pending one.
-- They cannot set the review status or review notes.
grant select on public.verify to authenticated;
grant insert (creator_id, links, selfie_path, storage_path)
on public.verify to authenticated;

-- Reports are only created by submit_media_report(), which derives reporter_id
-- from auth.uid() and enforces validation/rate limits.
revoke all on table public.reports from anon, authenticated;
revoke all (
  created_at, id, media_id, note, reason, reporter_id, status
) on table public.reports from anon, authenticated;

-- Ensure authenticated inserts using serial IDs can invoke their sequences.
grant usage, select on sequence
  public.media_id_seq,
  public.media_likes_id_seq,
  public.follows_id_seq,
  public.ad_likes_id_seq,
  public.ads_id_seq,
  public.verify_id_seq
to authenticated;

commit;
