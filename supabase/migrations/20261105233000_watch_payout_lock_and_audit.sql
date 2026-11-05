-- Serialize credit creation against a creator's payout snapshot.
-- Both functions lock the creator's profile row before touching the ledger;
-- a credit cannot be silently included in a payout after its amount was summed.
create or replace function public.credit_watch_monetization(
 p_session uuid, p_visitor_hash text, p_network_hash text, p_zone integer
) returns boolean
language plpgsql security invoker set search_path = ''
as $function$
declare v_count integer; v_creator uuid;
begin
 if p_zone not in (1130835,1130836,1130843,1130846) then return false; end if;
 select creator_id into v_creator from public.watch_monetization_sessions
 where id=p_session and status='started' and expires_at>now();
 if v_creator is null then return false; end if;
 perform 1 from public.profiles where id=v_creator for update;
 if not found then return false; end if;
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

-- Store the exact fractional-cent rounding difference for auditability.
alter table public.payout_requests
 add column if not exists rounding_adjustment_usd numeric(14,8) not null default 0;

create or replace function public.request_creator_payout()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile record; v_earn record; v_total numeric(14,8);
 v_amount numeric(14,2); v_now timestamptz:=now();
 v_local_day date:=(now() at time zone 'Africa/Johannesburg')::date;
 v_dow integer; v_friday date; v_request_id bigint; v_previous timestamptz;
begin
 if v_user is null then return jsonb_build_object('ok',false,'error','Log in first.'); end if;
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
  (user_id,username,verified,paypal_email,amount_usd,status,created_at,
   settlement_friday,payment_due_date,rounding_adjustment_usd)
 values(v_user,v_profile.username,coalesce(v_profile.verified,false),
  v_earn.paypal_email,v_amount,'pending',v_now,v_friday,v_friday+3,v_amount-v_total)
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
notify pgrst,'reload schema';
