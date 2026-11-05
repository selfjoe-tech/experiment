-- Reconcile each manual payout against immutable per-video watch credits.
create or replace function public.get_payout_ledger_summary(p_ids bigint[])
returns table (
 payout_id bigint,
 qualifying_loads bigint,
 ledger_usd numeric,
 rounding_adjustment_usd numeric,
 matches_amount boolean
)
language sql stable security invoker set search_path=''
as $fn$
 select p.id, count(s.id)::bigint as qualifying_loads,
   coalesce(sum(s.amount_usd),0)::numeric(14,8) as ledger_usd,
   p.rounding_adjustment_usd,
   count(s.id)>0 and 
   (coalesce(sum(s.amount_usd),0)::numeric(14,8) + p.rounding_adjustment_usd = p.amount_usd) as matches_amount
 from public.payout_requests p
 left join public.watch_monetization_sessions s
  on s.payout_request_id=p.id and s.creator_id=p.user_id and s.status='credited'
 where p.id=any(p_ids)
 group by p.id,p.rounding_adjustment_usd,p.amount_usd
$fn$;
revoke all on function public.get_payout_ledger_summary(bigint[]) from public,anon,authenticated;
grant execute on function public.get_payout_ledger_summary(bigint[]) to service_role;

-- An admin cannot mark a payout "paid" if its amount does not reconcile.
create or replace function public.check_paid_payout_ledger()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare v_summary record;
begin
 if new.status='paid' and old.status is distinct from 'paid' then
   select qualifying_loads,ledger_usd,matches_amount into v_summary
   from public.get_payout_ledger_summary(array[new.id]::bigint[]);
   if not coalesce(v_summary.matches_amount,false) then
     raise exception 'Payout amount does not reconcile with qualifying Watch loads.';
   end if;
   new.paid_at:=coalesce(new.paid_at,now());
 end if;
 return new;
end;
$fn$;
drop trigger if exists check_paid_payout_ledger on public.payout_requests;
create trigger check_paid_payout_ledger before update of status on public.payout_requests
for each row execute function public.check_paid_payout_ledger();
revoke all on function public.check_paid_payout_ledger() from public,anon,authenticated;
notify pgrst,'reload schema';
