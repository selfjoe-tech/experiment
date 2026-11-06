-- Only topics with real eligible public content are advertised as landing pages.
-- Reuse existing tags and user-supplied media tags rather than generating search doorway URLs.
create index if not exists media_tags_seo_gin on public.media using gin (tags);

create or replace view public.public_seo_tags
with (security_invoker = true) as
select t.id,t.slug,t.label,t.created_at
from public.tags t
where t.slug ~ '^[a-z0-9-]{2,90}$'
  and exists (
    select 1 from public.public_seo_media m
    where m.tags @> array[t.label]::text[]
  );
revoke all on public.public_seo_tags from public;
grant select on public.public_seo_tags to anon, authenticated, service_role;
notify pgrst, 'reload schema';
