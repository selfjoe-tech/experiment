-- Preserve canonical profile URLs across username changes.
-- Only server processes read redirects; public users see a redirect only
-- after the replacement public profile is confirmed eligible.
-- Rollback: drop trigger if exists remember_profile_username on public.profiles;
-- drop function if exists public.remember_profile_username();
-- drop table if exists public.profile_username_redirects;
create table if not exists public.profile_username_redirects (
 old_username text primary key,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 changed_at timestamptz not null default now()
);
alter table public.profile_username_redirects enable row level security;
revoke all on public.profile_username_redirects from public,anon,authenticated;
grant select,insert,update,delete on public.profile_username_redirects to service_role;

create or replace function public.remember_profile_username()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if old.username is distinct from new.username
   and old.username ~ '^[a-z0-9._]{1,40}$'
   and new.username ~ '^[a-z0-9._]{1,40}$' then
  insert into public.profile_username_redirects(old_username,profile_id,changed_at)
  values(old.username,new.id,now())
  on conflict(old_username) do update set
    profile_id=excluded.profile_id,changed_at=excluded.changed_at;
 end if;
 return new;
end;
$fn$;
drop trigger if exists remember_profile_username on public.profiles;
create trigger remember_profile_username after update of username on public.profiles
 for each row execute function public.remember_profile_username();
revoke all on function public.remember_profile_username() from public,anon,authenticated;
notify pgrst,'reload schema';
