-- Init schema for "RedGif-style" app (refined)
-- Save as supabase/migrations/XXXXXXXXXXXXXX_init_redgif_schema.sql

----------------------------------------------------------------------
-- Extensions
----------------------------------------------------------------------

create extension if not exists "pgcrypto";

----------------------------------------------------------------------
-- Custom types
----------------------------------------------------------------------

-- media_type: what kind of file
do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_type') then
    create type public.media_type as enum ('video','image','gif');
  end if;
end$$;

-- audience_type: strict audience options
do $$
begin
  if not exists (select 1 from pg_type where typname = 'audience_type') then
    create type public.audience_type as enum (
      'Straight',
      'Trans',
      'Gay',
      'Bisexual',
      'Lesbian',
      'Animated'
    );
  end if;
end$$;

-- verification_status for creator verification flow
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('pending','approved','rejected');
  end if;
end$$;

-- report types & status for the flag system
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_target_type') then
    create type public.content_target_type as enum ('post','comment','profile');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('pending','reviewed','dismissed');
  end if;
end$$;

----------------------------------------------------------------------
-- profiles
-- One row per user, linked to auth.users.id
----------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  is_creator boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_username_idx
  on public.profiles (username);

----------------------------------------------------------------------
-- posts
-- Logical post (video or 1..N images)
----------------------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  description text,
  audience public.audience_type not null default 'Straight',
  like_count bigint default 0,
  view_count bigint default 0,
  comment_count bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_creator_created_idx
  on public.posts (creator_id, created_at desc);

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

----------------------------------------------------------------------
-- post_media
-- Individual media files belonging to a post
-- storage_path assumes bucket "media" and paths "videos/..." or "images/..."
----------------------------------------------------------------------

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_type public.media_type not null,
  storage_path text not null,      -- e.g. "videos/abc123.mp4" or "images/def456.jpg"
  width integer,
  height integer,
  duration_seconds numeric,        -- for videos
  order_index integer default 0,   -- for galleries / multi-images
  created_at timestamptz default now(),
  constraint post_media_storage_path_chk
    check (storage_path ~ '^(videos|images)/')
);

create index if not exists post_media_post_order_idx
  on public.post_media (post_id, order_index);

----------------------------------------------------------------------
-- tags & many-to-many post_tags
----------------------------------------------------------------------

create table if not exists public.tags (
  id serial primary key,
  name text unique not null
);

create table if not exists public.post_tags (
  post_id uuid references public.posts(id) on delete cascade,
  tag_id integer references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index if not exists post_tags_tag_idx
  on public.post_tags (tag_id);

----------------------------------------------------------------------
-- niches & post_niches
----------------------------------------------------------------------

create table if not exists public.niches (
  id serial primary key,
  slug text unique not null,
  name text not null,
  description text,
  cover_image_path text
);

create table if not exists public.post_niches (
  post_id uuid references public.posts(id) on delete cascade,
  niche_id integer references public.niches(id) on delete cascade,
  primary key (post_id, niche_id)
);

create index if not exists post_niches_niche_idx
  on public.post_niches (niche_id);

----------------------------------------------------------------------
-- follows: user -> user
----------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id);

----------------------------------------------------------------------
-- post_likes  (soft-counted into posts.like_count)
----------------------------------------------------------------------

create table if not exists public.post_likes (
  user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

create index if not exists post_likes_post_idx
  on public.post_likes (post_id);

----------------------------------------------------------------------
-- comments (simple version, soft-counted into posts.comment_count later if needed)
----------------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at desc);

----------------------------------------------------------------------
-- post_views (soft-counted into posts.view_count)
-- You may dedupe by user_id + post_id + day at app level if needed.
----------------------------------------------------------------------

create table if not exists public.post_views (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id),
  viewed_at timestamptz default now()
);

create index if not exists post_views_post_idx
  on public.post_views (post_id);

----------------------------------------------------------------------
-- creator_verifications
----------------------------------------------------------------------

create table if not exists public.creator_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.verification_status default 'pending',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  notes text,
  id_photo_path text,
  extra_links text[]        -- array of external URLs (OnlyFans, etc.)
);

create index if not exists creator_verifications_user_idx
  on public.creator_verifications (user_id);

----------------------------------------------------------------------
-- bulk_uploads + link from post_media
----------------------------------------------------------------------

create table if not exists public.bulk_uploads (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text default 'processing', -- processing / success / failed
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.post_media
  add column if not exists bulk_upload_id uuid
    references public.bulk_uploads(id) on delete set null;

create index if not exists post_media_bulk_upload_idx
  on public.post_media (bulk_upload_id);

----------------------------------------------------------------------
-- content_reports (report / flag system)
----------------------------------------------------------------------

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.content_target_type not null,
  target_post_id uuid references public.posts(id) on delete cascade,
  target_comment_id uuid references public.comments(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  status public.report_status default 'pending',
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id),
  notes text,
  constraint content_reports_target_chk check (
    (target_type = 'post'    and target_post_id    is not null and target_comment_id is null     and target_profile_id is null) or
    (target_type = 'comment' and target_comment_id is not null and target_post_id    is null     and target_profile_id is null) or
    (target_type = 'profile' and target_profile_id is not null and target_post_id    is null     and target_comment_id is null)
  )
);

create index if not exists content_reports_target_post_idx
  on public.content_reports (target_post_id);

create index if not exists content_reports_target_comment_idx
  on public.content_reports (target_comment_id);

create index if not exists content_reports_target_profile_idx
  on public.content_reports (target_profile_id);

----------------------------------------------------------------------
-- feed_posts view
-- Joins posts + first media + creator for quick feed queries.
----------------------------------------------------------------------

create or replace view public.feed_posts as
select
  p.id,
  p.creator_id,
  p.description,
  p.audience,
  p.like_count,
  p.view_count,
  p.comment_count,
  p.created_at,
  m.media_type,
  m.storage_path as media_path,
  prof.username,
  prof.display_name,
  prof.avatar_url
from public.posts p
join lateral (
  select pm.*
  from public.post_media pm
  where pm.post_id = p.id
  order by pm.order_index
  limit 1
) m on true
join public.profiles prof on prof.id = p.creator_id;

----------------------------------------------------------------------
-- Soft-count trigger functions
----------------------------------------------------------------------

-- Likes -> posts.like_count
create or replace function public.handle_post_like_insert()
returns trigger as $$
begin
  update public.posts
  set like_count = like_count + 1
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create or replace function public.handle_post_like_delete()
returns trigger as $$
begin
  update public.posts
  set like_count = greatest(like_count - 1, 0)
  where id = old.post_id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_post_likes_insert on public.post_likes;
create trigger trg_post_likes_insert
after insert on public.post_likes
for each row
execute function public.handle_post_like_insert();

drop trigger if exists trg_post_likes_delete on public.post_likes;
create trigger trg_post_likes_delete
after delete on public.post_likes
for each row
execute function public.handle_post_like_delete();

-- Views -> posts.view_count
create or replace function public.handle_post_view_insert()
returns trigger as $$
begin
  update public.posts
  set view_count = view_count + 1
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_post_views_insert on public.post_views;
create trigger trg_post_views_insert
after insert on public.post_views
for each row
execute function public.handle_post_view_insert();

----------------------------------------------------------------------
-- Row Level Security (RLS) policies
-- Everything is public-readable; writes restricted to owners.
----------------------------------------------------------------------

-- profiles
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles: read all'
  ) then
    create policy "Profiles: read all"
      on public.profiles
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles: update own'
  ) then
    create policy "Profiles: update own"
      on public.profiles
      for update
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Profiles: insert self'
  ) then
    create policy "Profiles: insert self"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;
end$$;

-- posts
alter table public.posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Posts: read all'
  ) then
    create policy "Posts: read all"
      on public.posts
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Posts: insert own'
  ) then
    create policy "Posts: insert own"
      on public.posts
      for insert
      with check (creator_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Posts: update own'
  ) then
    create policy "Posts: update own"
      on public.posts
      for update
      using (creator_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Posts: delete own'
  ) then
    create policy "Posts: delete own"
      on public.posts
      for delete
      using (creator_id = auth.uid());
  end if;
end$$;

-- post_media
alter table public.post_media enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_media'
      and policyname = 'Post_media: read all'
  ) then
    create policy "Post_media: read all"
      on public.post_media
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_media'
      and policyname = 'Post_media: modify own'
  ) then
    create policy "Post_media: modify own"
      on public.post_media
      for all
      using (
        exists (
          select 1 from public.posts p
          where p.id = post_media.post_id
            and p.creator_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.posts p
          where p.id = post_media.post_id
            and p.creator_id = auth.uid()
        )
      );
  end if;
end$$;

-- follows
alter table public.follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows'
      and policyname = 'Follows: read all'
  ) then
    create policy "Follows: read all"
      on public.follows
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows'
      and policyname = 'Follows: modify own'
  ) then
    create policy "Follows: modify own"
      on public.follows
      for all
      using (follower_id = auth.uid())
      with check (follower_id = auth.uid());
  end if;
end$$;

-- post_likes
alter table public.post_likes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
      and policyname = 'Post_likes: read all'
  ) then
    create policy "Post_likes: read all"
      on public.post_likes
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
      and policyname = 'Post_likes: modify own'
  ) then
    create policy "Post_likes: modify own"
      on public.post_likes
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end$$;

-- comments
alter table public.comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments'
      and policyname = 'Comments: read all'
  ) then
    create policy "Comments: read all"
      on public.comments
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments'
      and policyname = 'Comments: insert own'
  ) then
    create policy "Comments: insert own"
      on public.comments
      for insert
      with check (author_id = auth.uid());
  end if;
end$$;

-- creator_verifications (user can see + create their own, moderation uses service role)
alter table public.creator_verifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_verifications'
      and policyname = 'Creator_verifications: read own'
  ) then
    create policy "Creator_verifications: read own"
      on public.creator_verifications
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_verifications'
      and policyname = 'Creator_verifications: insert own'
  ) then
    create policy "Creator_verifications: insert own"
      on public.creator_verifications
      for insert
      with check (user_id = auth.uid());
  end if;
end$$;

-- bulk_uploads (creator only)
alter table public.bulk_uploads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bulk_uploads'
      and policyname = 'Bulk_uploads: read own'
  ) then
    create policy "Bulk_uploads: read own"
      on public.bulk_uploads
      for select
      using (creator_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bulk_uploads'
      and policyname = 'Bulk_uploads: insert own'
  ) then
    create policy "Bulk_uploads: insert own"
      on public.bulk_uploads
      for insert
      with check (creator_id = auth.uid());
  end if;
end$$;

-- content_reports: users can file & see their own reports
alter table public.content_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_reports'
      and policyname = 'Content_reports: read own'
  ) then
    create policy "Content_reports: read own"
      on public.content_reports
      for select
      using (reporter_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_reports'
      and policyname = 'Content_reports: insert own'
  ) then
    create policy "Content_reports: insert own"
      on public.content_reports
      for insert
      with check (reporter_id = auth.uid());
  end if;
end$$;

----------------------------------------------------------------------
-- End of migration
----------------------------------------------------------------------
