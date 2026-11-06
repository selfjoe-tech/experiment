-- Non-blocking discovery queue. Existing RLS remains enabled; clients never
-- receive permission to write this internal queue.
create or replace function public.enqueue_public_seo_discovery()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_url text;v_kind text;v_username text;
begin
 if tg_table_name='media' then
   if tg_op='DELETE' then return old; end if;
   if new.media_type not in ('video','image') or new.storage_path is null then return new; end if;
   v_kind:=new.media_type;
   v_url:='https://goongram.com/'||
     case when new.media_type='video' then 'watch/' else 'image/' end||new.id::text;
   select p.username into v_username from public.profiles p where p.id=new.owner_id;
   if v_username is not null and length(v_username)>0 then
     insert into public.seo_discovery_events(canonical_url,kind,status,attempts,created_at,updated_at)
     values('https://goongram.com/'||v_username,'profile','queued',0,now(),now())
     on conflict(canonical_url) do update set status='queued',updated_at=now(),attempts=0,last_error=null;
   end if;
 elsif tg_table_name='profiles' then
   if tg_op='DELETE' then return old; end if;
   if new.username is null or new.username='' then return new; end if;
   if not exists(select 1 from public.media m where m.owner_id=new.id
      and m.storage_path is not null and m.media_type in ('video','image')) then return new; end if;
   v_kind:='profile';
   v_url:='https://goongram.com/'||new.username;
 end if;
 insert into public.seo_discovery_events(canonical_url,kind,status,attempts,created_at,updated_at)
 values(v_url,v_kind,'queued',0,now(),now())
 on conflict(canonical_url) do update set status='queued',updated_at=now(),attempts=0,last_error=null;
 return new;
exception when others then
 -- Publishing must succeed even when the asynchronous SEO queue fails.
 raise warning 'SEO queue insert failed: %',sqlerrm;
 return new;
end;
$fn$;
drop trigger if exists queue_published_media_seo on public.media;
create trigger queue_published_media_seo
 after insert or update of storage_path,title,description,thumbnail_path on public.media
 for each row execute function public.enqueue_public_seo_discovery();
drop trigger if exists queue_public_creator_seo on public.profiles;
create trigger queue_public_creator_seo
 after insert or update of username,bio,avatar_url on public.profiles
 for each row execute function public.enqueue_public_seo_discovery();
revoke all on function public.enqueue_public_seo_discovery() from public,anon,authenticated;
create index if not exists seo_discovery_pending_idx on public.seo_discovery_events(status,created_at)
 where status in ('queued','failed');
