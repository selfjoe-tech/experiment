-- Supabase Auth transition groundwork and authenticated app operations.
-- Existing legacy profile UUIDs and bcrypt hashes are preserved.
-- The profiles -> auth.users foreign key is intentionally deferred until after
-- legacy users have been imported and the new application version is deployed.

begin;

-- New Auth-created profiles do not store a second password hash.
alter table public.profiles
  alter column hash drop not null;

-- Private trigger helpers are not exposed through the PostgREST API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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

  return new;
end;
$$;

create or replace function private.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = lower(trim(new.email))
     where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.sync_auth_user_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_auth_user_email();

-- Verification submissions are private and scoped to their creator.
alter table public.verify enable row level security;

drop policy if exists "Creators can read own verification requests" on public.verify;
create policy "Creators can read own verification requests"
on public.verify
for select
to authenticated
using (creator_id = (select auth.uid()));

drop policy if exists "Creators can submit own verification requests" on public.verify;
create policy "Creators can submit own verification requests"
on public.verify
for insert
to authenticated
with check (creator_id = (select auth.uid()));

drop policy if exists "verification_owner_read" on storage.objects;
create policy "verification_owner_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification'
  and (storage.foldername(name))[1] = 'verify-selfies'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "verification_owner_insert" on storage.objects;
create policy "verification_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification'
  and (storage.foldername(name))[1] = 'verify-selfies'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

-- Ad buyer records and ad management are private to the authenticated owner.
alter table public.ad_buyers enable row level security;
alter table public.ads enable row level security;

drop policy if exists "ad_buyers_owner_read" on public.ad_buyers;
create policy "ad_buyers_owner_read"
on public.ad_buyers
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "ads_owner_read" on public.ads;
create policy "ads_owner_read"
on public.ads
for select
to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "ads_owner_insert" on public.ads;
create policy "ads_owner_insert"
on public.ads
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "ads_owner_update" on public.ads;
create policy "ads_owner_update"
on public.ads
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "ads_owner_delete" on public.ads;
create policy "ads_owner_delete"
on public.ads
for delete
to authenticated
using (owner_id = (select auth.uid()));

-- Storage ownership uses the second path segment for the user's UUID:
-- videos/<uid>/..., images/<uid>/..., avatars/<uid>/..., ads/<uid>/...
drop policy if exists "media_storage_owner_insert" on storage.objects;
create policy "media_storage_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (
    (
      (storage.foldername(name))[1] in ('videos', 'images', 'avatars')
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'ads'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

drop policy if exists "media_storage_owner_update" on storage.objects;
create policy "media_storage_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and (
    (
      (storage.foldername(name))[1] in ('videos', 'images', 'avatars')
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'ads'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
)
with check (
  bucket_id = 'media'
  and (
    (
      (storage.foldername(name))[1] in ('videos', 'images', 'avatars')
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'ads'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

drop policy if exists "media_storage_owner_delete" on storage.objects;
create policy "media_storage_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and (
    (
      (storage.foldername(name))[1] in ('videos', 'images', 'avatars')
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'ads'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

-- Public ad feeds receive only a curated subset of active ad fields.
drop function if exists public.get_active_ads_for_feed(text, integer);
create function public.get_active_ads_for_feed(
  p_media_type text,
  p_limit integer default 5
)
returns table (
  id bigint,
  storage_path text,
  media_type text,
  landing_url text,
  owner_username text,
  owner_avatar_url text,
  owner_verified boolean,
  like_count bigint,
  view_count bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    a.id,
    a.storage_path,
    a.media_type,
    a.landing_url,
    p.username as owner_username,
    p.avatar_url as owner_avatar_url,
    coalesce(p.verified, false) as owner_verified,
    a.like_count,
    a.view_count
  from public.ads a
  left join public.profiles p on p.id = a.owner_id
  where a."showAd" is true
    and (p_media_type is null or a.media_type = p_media_type)
    and exists (
      select 1
      from public.ad_buyers b
      where b.user_id = a.owner_id
        and b.expires_at > now()
    )
  order by random()
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

revoke all on function public.get_active_ads_for_feed(text, integer) from public;
grant execute on function public.get_active_ads_for_feed(text, integer) to anon, authenticated;

-- Comment JSON updates are performed by trusted, identity-aware database functions.
create or replace function private.append_comment_reply(
  p_nodes jsonb,
  p_parent_id text,
  p_reply jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node jsonb;
  v_replies jsonb;
  v_child jsonb;
  v_out jsonb := '[]'::jsonb;
  v_found boolean := false;
begin
  if p_nodes is null then
    p_nodes := '[]'::jsonb;
  elsif jsonb_typeof(p_nodes) <> 'array' then
    p_nodes := jsonb_build_array(p_nodes);
  end if;

  for v_node in select value from jsonb_array_elements(p_nodes) loop
    if not v_found and v_node ->> 'id' = p_parent_id then
      v_replies := coalesce(v_node -> 'replies', '[]'::jsonb);
      if jsonb_typeof(v_replies) <> 'array' then
        v_replies := '[]'::jsonb;
      end if;
      v_node := jsonb_set(
        v_node,
        '{replies}',
        v_replies || jsonb_build_array(p_reply),
        true
      );
      v_found := true;
    elsif not v_found and jsonb_typeof(v_node -> 'replies') = 'array' then
      v_child := private.append_comment_reply(
        v_node -> 'replies',
        p_parent_id,
        p_reply
      );
      if coalesce((v_child ->> 'found')::boolean, false) then
        v_node := jsonb_set(v_node, '{replies}', v_child -> 'nodes', true);
        v_found := true;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(v_node);
  end loop;

  return jsonb_build_object('nodes', v_out, 'found', v_found);
end;
$$;

create or replace function private.toggle_comment_like(
  p_nodes jsonb,
  p_comment_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node jsonb;
  v_liked_by jsonb;
  v_new_liked_by jsonb;
  v_child jsonb;
  v_out jsonb := '[]'::jsonb;
  v_found boolean := false;
  v_likes integer;
  v_has_liked boolean;
begin
  if p_nodes is null then
    p_nodes := '[]'::jsonb;
  elsif jsonb_typeof(p_nodes) <> 'array' then
    p_nodes := jsonb_build_array(p_nodes);
  end if;

  for v_node in select value from jsonb_array_elements(p_nodes) loop
    if not v_found and v_node ->> 'id' = p_comment_id then
      v_liked_by := coalesce(v_node -> 'liked_by', '[]'::jsonb);
      if jsonb_typeof(v_liked_by) <> 'array' then
        v_liked_by := '[]'::jsonb;
      end if;

      v_has_liked := v_liked_by ? p_user_id::text;
      v_likes := greatest(coalesce((v_node ->> 'likes')::integer, 0), 0);

      if v_has_liked then
        select coalesce(jsonb_agg(value), '[]'::jsonb)
          into v_new_liked_by
        from jsonb_array_elements(v_liked_by)
        where value #>> '{}' <> p_user_id::text;
        v_likes := greatest(v_likes - 1, 0);
      else
        v_new_liked_by := v_liked_by || jsonb_build_array(p_user_id::text);
        v_likes := v_likes + 1;
      end if;

      v_node := jsonb_set(v_node, '{liked_by}', v_new_liked_by, true);
      v_node := jsonb_set(v_node, '{likes}', to_jsonb(v_likes), true);
      v_found := true;
    elsif not v_found and jsonb_typeof(v_node -> 'replies') = 'array' then
      v_child := private.toggle_comment_like(
        v_node -> 'replies',
        p_comment_id,
        p_user_id
      );
      if coalesce((v_child ->> 'found')::boolean, false) then
        v_node := jsonb_set(v_node, '{replies}', v_child -> 'nodes', true);
        v_found := true;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(v_node);
  end loop;

  return jsonb_build_object('nodes', v_out, 'found', v_found);
end;
$$;

create or replace function public.add_media_comment(
  p_media_id bigint,
  p_comment text,
  p_parent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_comments jsonb;
  v_node jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_media_id is null or length(trim(coalesce(p_comment, ''))) = 0 then
    raise exception 'A media ID and comment are required.';
  end if;

  if length(p_comment) > 5000 then
    raise exception 'Comment is too long.';
  end if;

  select username, avatar_url, verified
    into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found.';
  end if;

  select coalesce(comments, '[]'::jsonb)
    into v_comments
  from public.media
  where id = p_media_id
  for update;

  if not found then
    raise exception 'Media not found.';
  end if;

  v_node := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'username', v_profile.username,
    'avatar_path', coalesce(v_profile.avatar_url, '/avatar-placeholder.png'),
    'comment', trim(p_comment),
    'likes', 0,
    'liked_by', '[]'::jsonb,
    'replies', '[]'::jsonb,
    'verified', coalesce(v_profile.verified, false)
  );

  if p_parent_id is null then
    if jsonb_typeof(v_comments) <> 'array' then
      v_comments := jsonb_build_array(v_comments);
    end if;
    v_comments := v_comments || jsonb_build_array(v_node);
  else
    v_result := private.append_comment_reply(v_comments, p_parent_id, v_node);
    if not coalesce((v_result ->> 'found')::boolean, false) then
      raise exception 'Parent comment not found.';
    end if;
    v_comments := v_result -> 'nodes';
  end if;

  update public.media
    set comments = v_comments
  where id = p_media_id;

  return v_comments;
end;
$$;

create or replace function public.toggle_media_comment_like(
  p_media_id bigint,
  p_comment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comments jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_media_id is null or nullif(trim(p_comment_id), '') is null then
    raise exception 'A media ID and comment ID are required.';
  end if;

  select coalesce(comments, '[]'::jsonb)
    into v_comments
  from public.media
  where id = p_media_id
  for update;

  if not found then
    raise exception 'Media not found.';
  end if;

  v_result := private.toggle_comment_like(v_comments, p_comment_id, v_user_id);
  if not coalesce((v_result ->> 'found')::boolean, false) then
    raise exception 'Comment not found.';
  end if;

  v_comments := v_result -> 'nodes';

  update public.media
    set comments = v_comments
  where id = p_media_id;

  return v_comments;
end;
$$;

revoke all on function private.append_comment_reply(jsonb, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.toggle_comment_like(jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.add_media_comment(bigint, text, text)
  from public, anon;
revoke all on function public.toggle_media_comment_like(bigint, text)
  from public, anon;

grant execute on function public.add_media_comment(bigint, text, text) to authenticated;
grant execute on function public.toggle_media_comment_like(bigint, text) to authenticated;

-- Financial tables can only be read by their owner. Mutations go through RPCs.
alter table public.creator_earnings enable row level security;
alter table public.payout_requests enable row level security;
alter table public.affiliate_requests enable row level security;

drop policy if exists "creator_earnings_owner_read" on public.creator_earnings;
create policy "creator_earnings_owner_read"
on public.creator_earnings
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "payout_requests_owner_read" on public.payout_requests;
create policy "payout_requests_owner_read"
on public.payout_requests
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "affiliate_requests_owner_read" on public.affiliate_requests;
create policy "affiliate_requests_owner_read"
on public.affiliate_requests
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.creator_earnings from anon, authenticated;
revoke all on table public.payout_requests from anon, authenticated;
revoke all on table public.affiliate_requests from anon, authenticated;
grant select on table public.creator_earnings to authenticated;
grant select on table public.payout_requests to authenticated;
grant select on table public.affiliate_requests to authenticated;

create or replace function public.save_creator_paypal_email(
  p_email text,
  p_confirm_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_confirm text := lower(trim(coalesce(p_confirm_email, '')));
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'Invalid PayPal email.');
  end if;

  if v_email <> v_confirm then
    return jsonb_build_object('ok', false, 'error', 'Emails do not match.');
  end if;

  select username into v_username
  from public.profiles
  where id = v_user_id;

  if v_username is null then
    raise exception 'Profile not found.';
  end if;

  insert into public.creator_earnings (
    user_id, username, paypal_email, paypal_email_set_at,
    user_type, rate, visits_per_day, updated_at
  )
  values (
    v_user_id, v_username, v_email, now(),
    'ordinary', 0.147, '{}'::jsonb, now()
  )
  on conflict (user_id) do update
    set username = excluded.username,
        paypal_email = excluded.paypal_email,
        paypal_email_set_at = now(),
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.request_creator_payout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_earn record;
  v_day record;
  v_total numeric := 0;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, username, verified
    into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  select paypal_email, paypal_email_set_at, rate, visits_per_day, user_type
    into v_earn
  from public.creator_earnings
  where user_id = v_user_id
  for update;

  if not found or nullif(trim(coalesce(v_earn.paypal_email, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Add your PayPal email first.');
  end if;

  for v_day in
    select key, value
    from jsonb_each(coalesce(v_earn.visits_per_day, '{}'::jsonb))
  loop
    if v_earn.paypal_email_set_at is null
       or v_day.key >= to_char(v_earn.paypal_email_set_at at time zone 'UTC', 'YYYY-MM-DD') then
      if jsonb_typeof(v_day.value) = 'number' then
        v_total := v_total + ((v_day.value::text)::numeric / 1000) * v_earn.rate;
      end if;
    end if;
  end loop;

  v_total := round(v_total, 2);

  if v_total < 50 then
    return jsonb_build_object('ok', false, 'error', 'Minimum payout is $50.');
  end if;

  insert into public.payout_requests (
    user_id, username, verified, paypal_email,
    amount_usd, status, created_at
  )
  values (
    v_user_id, v_profile.username, coalesce(v_profile.verified, false),
    v_earn.paypal_email, v_total, 'pending', v_now
  );

  update public.creator_earnings
  set visits_per_day = '{}'::jsonb,
      last_payout_amount_usd = v_total,
      last_payout_requested_at = v_now,
      updated_at = v_now
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'amountUsd', v_total,
    'requestedAt', v_now
  );
end;
$$;

create or replace function public.apply_for_affiliate()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select username into v_username
  from public.profiles
  where id = v_user_id;

  if v_username is null then
    raise exception 'Profile not found.';
  end if;

  insert into public.affiliate_requests (user_id, username, status)
  values (v_user_id, v_username, 'pending')
  on conflict (user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_creator_paypal_email(text, text) from public, anon;
revoke all on function public.request_creator_payout() from public, anon;
revoke all on function public.apply_for_affiliate() from public, anon;
grant execute on function public.save_creator_paypal_email(text, text) to authenticated;
grant execute on function public.request_creator_payout() to authenticated;
grant execute on function public.apply_for_affiliate() to authenticated;

-- Reporting is tied to the verified caller; reporter_id is never supplied by the browser.
create or replace function public.submit_media_report(
  p_media_id bigint,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := trim(coalesce(p_reason, ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_report_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_media_id is null or p_media_id <= 0 then
    raise exception 'Invalid media ID.';
  end if;

  if length(v_reason) < 2 or length(v_reason) > 120 then
    raise exception 'Report reason must be between 2 and 120 characters.';
  end if;

  if v_note is not null and length(v_note) > 2000 then
    raise exception 'Report details are too long.';
  end if;

  if not exists (select 1 from public.media m where m.id = p_media_id) then
    raise exception 'Media not found.';
  end if;

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = v_user_id
      and r.media_id = p_media_id
      and r.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'Please wait before reporting this media again.';
  end if;

  insert into public.reports (reporter_id, media_id, reason, note, status)
  values (v_user_id, p_media_id, v_reason, v_note, 'pending')
  returning id into v_report_id;

  return jsonb_build_object('ok', true, 'report_id', v_report_id);
end;
$$;

revoke all on function public.submit_media_report(bigint, text, text) from public, anon;
grant execute on function public.submit_media_report(bigint, text, text) to authenticated;

commit;
