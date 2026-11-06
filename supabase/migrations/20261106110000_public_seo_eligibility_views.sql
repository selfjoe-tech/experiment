-- Public search eligibility is intentionally narrower than data readability.
-- These SECURITY INVOKER views follow the existing table RLS rules.
create or replace view public.public_seo_media with (security_invoker = true) as
select m.id, m.owner_id, m.media_type, m.title, m.description,
  m.storage_path, m.thumbnail_path, m.duration_seconds,
  m.width, m.height, m.tags, m.created_at, m.view_count,
  p.username, p.avatar_url, p.verified
from public.media m
join public.profiles p on p.id = m.owner_id
where m.media_type in ('video','image')
 and nullif(btrim(m.storage_path),'') is not null
 and nullif(btrim(p.username),'') is not null
 and p.username ~ '^[a-z0-9._]{1,40}$'
 and (
  nullif(btrim(m.title),'') is not null
  or nullif(btrim(m.description),'') is not null
  or coalesce(cardinality(m.tags),0) >= 3
 );

create or replace view public.public_seo_profiles with (security_invoker = true) as
select p.id, p.username, p.bio, p.avatar_url, p.verified,
 p.follower_count, p.created_at
from public.profiles p
where nullif(btrim(p.username),'') is not null
 and p.username ~ '^[a-z0-9._]{1,40}$'
 and (
  length(btrim(coalesce(p.bio,''))) >= 12
  or exists (select 1 from public.public_seo_media m where m.owner_id = p.id)
 );

create or replace view public.public_seo_tags with (security_invoker = true) as
select t.id,t.slug,t.label,t.created_at from public.tags t
where t.slug ~ '^[a-z0-9-]{2,90}$'
 and exists (select 1 from public.public_seo_media m where m.tags @> array[t.label]);

grant select on public.public_seo_media, public.public_seo_profiles, public.public_seo_tags to anon,authenticated;
create index if not exists seo_media_public_owner_idx
 on public.media(owner_id,created_at desc) where storage_path is not null;
create index if not exists seo_media_public_type_idx
 on public.media(media_type,id) where storage_path is not null;
create index if not exists seo_media_tags_gin_idx
 on public.media using gin(tags);
create index if not exists seo_profiles_username_idx
 on public.profiles(username);
-- Reverting: restore the previous view definitions and DROP the four new indexes.
notify pgrst,'reload schema';
