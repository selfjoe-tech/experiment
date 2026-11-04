-- Private short-lived staging bucket used by authenticated server-side video trimming.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads-staging',
  'uploads-staging',
  false,
  52428800,
  array['video/mp4','video/webm','video/quicktime']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
