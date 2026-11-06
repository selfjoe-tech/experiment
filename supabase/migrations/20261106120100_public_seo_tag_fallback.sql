-- Existing users often supply useful tags without descriptions.
-- Use actual creator-supplied tags as a discovery signal; do not invent text.
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
  and (
    nullif(btrim(m.title),'') is not null
    or nullif(btrim(m.description),'') is not null
    or coalesce(cardinality(m.tags),0) >= 3
  );
notify pgrst, 'reload schema';
