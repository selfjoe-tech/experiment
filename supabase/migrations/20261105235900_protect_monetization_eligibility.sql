-- Defense in depth: public clients cannot self-upgrade verified status
-- or rewrite an uploaded video's recorded duration to gain higher earnings.
-- Existing authenticated column privileges also deny these mutations.
create or replace function public.protect_creator_verified_status()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
 if current_user not in ('postgres','service_role','supabase_admin') then
  if tg_op='INSERT' and coalesce(new.verified,false) then
   raise exception 'Verification can only be approved by an administrator.';
  end if;
  if tg_op='UPDATE' and new.verified is distinct from old.verified then
   raise exception 'Verification can only be changed by an administrator.';
  end if;
 end if;
 return new;
end;
$fn$;
drop trigger if exists protect_creator_verified_status on public.profiles;
create trigger protect_creator_verified_status
before insert or update of verified on public.profiles
for each row execute function public.protect_creator_verified_status();

create or replace function public.protect_video_duration()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
 if current_user not in ('postgres','service_role','supabase_admin')
    and new.duration_seconds is distinct from old.duration_seconds then
  raise exception 'Video duration cannot be modified after uploading.';
 end if;
 return new;
end;
$fn$;
drop trigger if exists protect_video_duration on public.media;
create trigger protect_video_duration
before update of duration_seconds on public.media
for each row execute function public.protect_video_duration();
revoke all on function public.protect_creator_verified_status() from public,anon,authenticated;
revoke all on function public.protect_video_duration() from public,anon,authenticated;
notify pgrst,'reload schema';
