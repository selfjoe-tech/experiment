-- Change Goongram Watch-page creator rates for FUTURE qualifying credits.
-- Unverified: USD $0.20 / 1,000; verified: USD $0.30 / 1,000.
-- Keep older credited sessions immutable; they continue using the rate earned
-- at the time of credit, and ledger-based payouts remain reconcilable.

alter table public.watch_monetization_sessions
  drop constraint if exists watch_monetization_amount_check;

alter table public.watch_monetization_sessions
  add constraint watch_monetization_amount_check check (
    status <> 'credited'
    or (
      credited_at is not null
      and rate_per_1000 in (0.200, 0.300, 0.250, 0.370)
      and amount_usd = rate_per_1000 / 1000
      and ad_zone_id is not null
    )
  );

CREATE OR REPLACE FUNCTION public.credit_watch_monetization(p_session uuid, p_visitor_hash text, p_network_hash text, p_zone integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
     rate_per_1000=case when p.verified then 0.300 else 0.200 end,
     amount_usd=case when p.verified then 0.00030000 else 0.00020000 end
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
$function$
;

revoke all on function public.credit_watch_monetization(uuid,text,text,integer)
  from public,anon,authenticated;
grant execute on function public.credit_watch_monetization(uuid,text,text,integer)
  to service_role;

-- The legacy column is not used for calculating Watch credits, but should
-- reflect the creator's tier instead of retaining an outdated default.
alter table public.creator_earnings alter column rate set default 0.200;

update public.creator_earnings as e
 set rate=case when p.verified then 0.300 else 0.200 end,
     updated_at=now()
 from public.profiles as p
 where e.user_id=p.id
   and e.rate is distinct from (case when p.verified then 0.300 else 0.200 end);

CREATE OR REPLACE FUNCTION public.save_creator_paypal_email(p_email text, p_confirm_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid();
 v_email text:=lower(trim(coalesce(p_email,'')));
 v_confirm text:=lower(trim(coalesce(p_confirm_email,'')));
 v_username text;
 v_verified boolean;
begin
 if v_user is null then return jsonb_build_object('ok',false,'error','Log in first.'); end if;
 if length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
   return jsonb_build_object('ok',false,'error','Enter a valid PayPal email.');
 end if;
 if v_email<>v_confirm then
   return jsonb_build_object('ok',false,'error','Emails do not match.');
 end if;
 select username,coalesce(verified,false) into v_username,v_verified
 from public.profiles where id=v_user;
 if v_username is null then
   return jsonb_build_object('ok',false,'error','Profile not found.');
 end if;
 insert into public.creator_earnings(
   user_id,username,paypal_email,paypal_email_set_at,rate,updated_at
 ) values (
   v_user,v_username,v_email,now(),
   case when v_verified then 0.300 else 0.200 end,now()
 )
 on conflict(user_id) do update
 set paypal_email=excluded.paypal_email,
     paypal_email_set_at=coalesce(public.creator_earnings.paypal_email_set_at,now()),
     rate=excluded.rate,
     updated_at=now();
 return jsonb_build_object('ok',true);
end;
$function$
;

revoke all on function public.save_creator_paypal_email(text,text)
  from public,anon;
grant execute on function public.save_creator_paypal_email(text,text)
  to authenticated;

notify pgrst, 'reload schema';
