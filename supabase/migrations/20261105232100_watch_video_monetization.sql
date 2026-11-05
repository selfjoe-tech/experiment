
-- Video-only monetization. This is a NEW ledger: historic profile visits have no value.
-- A separate, provider-verified impression callback is not currently offered
-- by the installed JuicyAds integration. "Ad loaded" is client-observed
-- evidence only; payouts remain subject to manual publisher reconciliation.
create table if not exists public.watch_monetization_sessions (
 id uuid primary key default gen_random_uuid(),
 media_id bigint not null references public.media(id) on delete cascade,
 creator_id uuid not null references public.profiles(id) on delete cascade,
 viewer_id uuid null,
 visitor_hash text not null,
 network_hash text not null,
 visit_day date not null,
 status text not null default 'started' check(status in ('started','credited','rejected')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '10 minutes'),
 credited_at timestamptz,
 ad_zone_id integer,
 rate_per_1000 numeric(7,3),
 amount_usd numeric(14,8),
 payout_request_id bigint references public.payout_requests(id) on delete set null,
 constraint watch_monetization_amount_check check (
   (status <> 'credited') or
   (credited_at is not null and rate_per_1000 in (0.250,0.370)
    and amount_usd = rate_per_1000 / 1000 and ad_zone_id is not null)
 )
);
create unique index if not exists watch_monetization_one_visitor_daily
 on public.watch_monetization_sessions(media_id,visitor_hash,visit_day) where status='credited';
create unique index if not exists watch_monetization_one_network_daily
 on public.watch_monetization_sessions(media_id,network_hash,visit_day) where status='credited';
create index if not exists watch_monetization_creator_balance
 on public.watch_monetization_sessions(creator_id, status, payout_request_id);
create index if not exists watch_monetization_session_created
 on public.watch_monetization_sessions(visitor_hash, created_at desc);
create index if not exists watch_monetization_network_created
 on public.watch_monetization_sessions(network_hash, created_at desc);
alter table public.watch_monetization_sessions enable row level security;
revoke all on public.watch_monetization_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.watch_monetization_sessions to service_role;

alter table public.payout_requests add column if not exists settlement_friday date;
alter table public.payout_requests add column if not exists payment_due_date date;
alter table public.payout_requests add column if not exists paid_at timestamptz;
create index if not exists payout_requests_user_created on public.payout_requests(user_id, created_at desc);

-- No untrusted client can directly credit views. The service role calls this
-- one atomic transition AFTER a new Watch-page session was created by the server.
create or replace function public.credit_watch_monetization(
 p_session uuid, p_visitor_hash text, p_network_hash text, p_zone integer
) returns boolean
language plpgsql security invoker set search_path = ''
as $function$
declare v_count integer;
begin
 if p_zone not in (1130835,1130836,1130843,1130846) then return false; end if;
 update public.watch_monetization_sessions as s
 set status='credited', credited_at=now(), ad_zone_id=p_zone,
     rate_per_1000=case when p.verified then 0.370 else 0.250 end,
     amount_usd=case when p.verified then 0.00037000 else 0.00025000 end
 from public.media m join public.profiles p on p.id=m.owner_id
 where s.id=p_session and s.status='started'
   and s.media_id=m.id and s.creator_id=m.owner_id
   and m.media_type='video' and m.duration_seconds>=30
   and s.visitor_hash=p_visitor_hash and s.network_hash=p_network_hash
   and s.expires_at>now() and s.created_at<=now()-interval '3 seconds'
   and (s.viewer_id is null or s.viewer_id<>s.creator_id)
   and not exists (
     select 1 from public.watch_monetization_sessions past
     where past.media_id=s.media_id and past.visit_day=s.visit_day
     and past.status='credited'
     and (past.visitor_hash=s.visitor_hash or past.network_hash=s.network_hash)
   );
 get diagnostics v_count = row_count;
 return v_count=1;
exception when unique_violation then
 return false;
end;
$function$;
revoke all on function public.credit_watch_monetization(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.credit_watch_monetization(uuid,text,text,integer) to service_role;

-- Aggregate at database precision. Client never handles per-view ledger writes.
create or replace function public.get_creator_video_earnings(p_creator_id uuid)
returns table(
 media_id bigint, title text, duration_seconds numeric,
 qualified_views bigint, earned_usd numeric, unpaid_usd numeric
) language sql stable security invoker set search_path=''
as $function$
 select m.id, coalesce(nullif(m.title,''),nullif(left(m.description,80),''),'Untitled video'),
 m.duration_seconds,
 count(s.id) filter(where s.status='credited')::bigint,
 coalesce(sum(s.amount_usd) filter(where s.status='credited'),0)::numeric,
 coalesce(sum(s.amount_usd) filter(where s.status='credited' and s.payout_request_id is null),0)::numeric
 from public.media m
 left join public.watch_monetization_sessions s on s.media_id=m.id and s.creator_id=m.owner_id
 where m.owner_id=p_creator_id and m.media_type='video'
 group by m.id,m.title,m.description,m.duration_seconds,m.created_at
 order by m.created_at desc
$function$;
revoke all on function public.get_creator_video_earnings(uuid) from public,anon,authenticated;
grant execute on function public.get_creator_video_earnings(uuid) to service_role;

-- PayPal is optional to earn; required only to request payout.
create or replace function public.save_creator_paypal_email(p_email text,p_confirm_email text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_email text:=lower(trim(coalesce(p_email,'')));
 v_confirm text:=lower(trim(coalesce(p_confirm_email,''))); v_username text;
begin
 if v_user is null then return jsonb_build_object('ok',false,'error','Log in first.'); end if;
 if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
   return jsonb_build_object('ok',false,'error','Enter a valid PayPal email.');
 end if;
 if v_email<>v_confirm then return jsonb_build_object('ok',false,'error','Emails do not match.'); end if;
 select username into v_username from public.profiles where id=v_user;
 if v_username is null then return jsonb_build_object('ok',false,'error','Profile not found.'); end if;
 insert into public.creator_earnings(user_id,username,paypal_email,paypal_email_set_at,rate,updated_at)
 values(v_user,v_username,v_email,now(),0.250,now())
 on conflict(user_id) do update set paypal_email=excluded.paypal_email,
  paypal_email_set_at=coalesce(public.creator_earnings.paypal_email_set_at,now()),
  updated_at=now();
 return jsonb_build_object('ok',true);
end;
$function$;
revoke all on function public.save_creator_paypal_email(text,text) from public,anon;
grant execute on function public.save_creator_paypal_email(text,text) to authenticated;

-- The credit ledger and payout allocation are transactionally consistent.
-- One request per rolling seven days, no overlapping pending request.
-- Friday in Africa/Johannesburg is the settlement cutoff; Saturday–Thursday
-- requests use the next Friday and are due by the following Monday.
create or replace function public.request_creator_payout()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile record; v_earn record; v_total numeric(14,8);
 v_amount numeric(14,2); v_now timestamptz:=now();
 v_local_day date:=(now() at time zone 'Africa/Johannesburg')::date;
 v_dow integer; v_friday date; v_request_id bigint; v_previous timestamptz;
begin
 if v_user is null then return jsonb_build_object('ok',false,'error','Log in first.'); end if;
 -- Lock one stable creator row to make concurrent requests serialized.
 select id,username,verified into v_profile from public.profiles where id=v_user for update;
 if not found then return jsonb_build_object('ok',false,'error','Profile not found.'); end if;
 select paypal_email into v_earn from public.creator_earnings where user_id=v_user for update;
 if nullif(trim(coalesce(v_earn.paypal_email,'')),'') is null then
   return jsonb_build_object('ok',false,'error','Add your PayPal email before requesting payout.');
 end if;
 if exists(select 1 from public.payout_requests where user_id=v_user and status='pending') then
   return jsonb_build_object('ok',false,'error','Your previous payout request is still pending.');
 end if;
 select max(created_at) into v_previous from public.payout_requests where user_id=v_user;
 if v_previous is not null and v_previous>v_now-interval '7 days' then
   return jsonb_build_object('ok',false,'error','You can request payout only once every seven days.');
 end if;
 select coalesce(sum(amount_usd),0)::numeric(14,8) into v_total
 from public.watch_monetization_sessions
 where creator_id=v_user and status='credited' and payout_request_id is null;
 v_amount:=round(v_total,2);
 if v_amount<30.00 then
   return jsonb_build_object('ok',false,'error','Minimum payout is $30.');
 end if;
 v_dow:=extract(dow from v_local_day)::integer;
 v_friday:=v_local_day + ((5-v_dow+7)%7);
 insert into public.payout_requests
  (user_id,username,verified,paypal_email,amount_usd,status,created_at,settlement_friday,payment_due_date)
 values(v_user,v_profile.username,coalesce(v_profile.verified,false),
  v_earn.paypal_email,v_amount,'pending',v_now,v_friday,v_friday+3)
 returning id into v_request_id;
 update public.watch_monetization_sessions set payout_request_id=v_request_id
 where creator_id=v_user and status='credited' and payout_request_id is null;
 update public.creator_earnings set last_payout_amount_usd=v_amount,
  last_payout_requested_at=v_now,updated_at=v_now where user_id=v_user;
 return jsonb_build_object('ok',true,'amountUsd',v_amount,'requestedAt',v_now,
   'paymentDueDate',v_friday+3,'payoutId',v_request_id);
end;
$function$;
revoke all on function public.request_creator_payout() from public,anon;
grant execute on function public.request_creator_payout() to authenticated;

-- Legacy profile traffic must never influence this new payable ledger.
revoke all on function public.increment_creator_daily_visit(uuid,date) from public,anon,authenticated;

notify pgrst, 'reload schema';
