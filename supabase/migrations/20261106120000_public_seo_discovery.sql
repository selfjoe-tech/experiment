-- Public-only search discovery. No private profile columns, no auth changes.
-- Rollback plan: DROP VIEW IF EXISTS public.public_seo_media;
-- DROP VIEW IF EXISTS public.public_seo_profiles;
-- DROP INDEX IF EXISTS public.media_seo_type_created_idx;
-- DROP INDEX IF EXISTS public.media_seo_owner_created_idx;
-- ALTER TABLE public.media DROP COLUMN IF EXISTS thumbnail_path;
alter table public.media add column if not exists thumbnail_path text;

create index if not exists media_seo_type_created_idx
  on public.media (media_type, created_at desc, id desc)
  where storage_path is not null;
create index if not exists media_seo_owner_created_idx
  on public.media (owner_id, created_at desc, id desc)
  where storage_path is not null;

-- Security invoker views honor the underlying RLS policies.
-- This project currently has no public/private/media moderation state columns.
-- Do not infer publication permission beyond the existing public RLS policy.
create or replace view public.public_seo_media
with (security_invoker = true)
as select
 m.id, m.owner_id, m.media_type, m.title, m.description,
 m.storage_path, m.thumbnail_path, m.duration_seconds,
 m.width, m.height, m.tags, m.created_at, m.view_count,
 p.username, p.avatar_url, p.verified
from public.media m
join public.profiles p on p.id = m.owner_id
where m.media_type in ('image','video')
  and nullif(btrim(m.storage_path),'') is not null
  and nullif(btrim(p.username),'') is not null
  and p.username ~ '^[a-z0-9._]{1,40}$'
  and (nullif(btrim(m.title),'') is not null
       or nullif(btrim(m.description),'') is not null);

create or replace view public.public_seo_profiles
with (security_invoker = true)
as select p.id, p.username, p.bio, p.avatar_url,
  p.verified, p.follower_count, p.created_at
from public.profiles p
where nullif(btrim(p.username),'') is not null
  and p.username ~ '^[a-z0-9._]{1,40}$'
  and (
   length(btrim(coalesce(p.bio,''))) >= 12
   or exists (
    select 1 from public.public_seo_media m
    where m.owner_id=p.id
   )
  );

revoke all on public.public_seo_media, public.public_seo_profiles from public;
grant select on public.public_seo_media, public.public_seo_profiles to anon, authenticated, service_role;
notify pgrst, 'reload schema';
