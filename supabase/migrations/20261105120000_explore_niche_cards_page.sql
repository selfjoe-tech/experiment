-- Explore niche cards: public, read-only RPC respecting tags/media RLS.
-- Mirrors the migration already applied to the connected Goon Gram Supabase project.
create or replace function public.get_niche_cards_page(
  p_limit integer default 12,
  p_offset integer default 0,
  p_sort text default 'newest'
)
returns table (
  tag_id bigint,
  slug text,
  label text,
  storage_path text,
  post_count bigint,
  top_views bigint,
  media_created_at timestamptz,
  media_id bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    t.id as tag_id,
    t.slug,
    t.label,
    featured.storage_path,
    coalesce(totals.post_count, 0)::bigint,
    coalesce(featured.view_count, 0)::bigint as top_views,
    featured.created_at as media_created_at,
    featured.id as media_id
  from public.tags as t
  left join lateral (
    select m.id, m.storage_path, m.view_count, m.created_at
    from public.media as m
    where m.media_type = 'video'
      and exists (
        select 1
        from unnest(m.tags) as mt(value)
        where lower(trim(leading '#' from btrim(mt.value))) in (
          lower(t.label), lower(t.slug), replace(lower(t.slug), '-', ' ')
        )
      )
    order by m.view_count desc, m.created_at desc, m.id desc
    limit 1
  ) as featured on true
  left join lateral (
    select count(*)::bigint as post_count
    from public.media as m
    where m.media_type = 'video'
      and exists (
        select 1
        from unnest(m.tags) as mt(value)
        where lower(trim(leading '#' from btrim(mt.value))) in (
          lower(t.label), lower(t.slug), replace(lower(t.slug), '-', ' ')
        )
      )
  ) as totals on true
  order by
    case when p_sort = 'trending' then totals.post_count end desc nulls last,
    case when p_sort = 'views' then featured.view_count end desc nulls last,
    case when p_sort = 'newest' then t.created_at end desc nulls last,
    t.created_at desc, t.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.get_niche_cards_page(integer, integer, text) from public;
grant execute on function public.get_niche_cards_page(integer, integer, text) to anon, authenticated;
notify pgrst, 'reload schema';
