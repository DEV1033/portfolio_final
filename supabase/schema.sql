-- Run this whole file once in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

-- ========== site_settings (singleton row: profile, theme color, CTAs) ==========
create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Dev Chaudhary',
  tagline text not null default 'Aspiring Product Designer with a taste of Tech, Aesthetics & Product Thinking',
  avatar_url text,
  banner_url text,
  website_label text default 'Easycomm.io',
  website_url text default 'https://easycomm.io',
  linkedin_handle text default '@DEV CHAUDHARY',
  linkedin_url text default 'https://linkedin.com',
  instagram_handle text default '@iamdc5203',
  instagram_url text default 'https://instagram.com',
  accent_color text not null default '#01a73b',
  cta_hire_label text default 'Hire Me',
  cta_hire_url text default '',
  cta_resume_label text default 'View Resume',
  cta_resume_url text default '',
  updated_at timestamptz not null default now()
);

-- safe to re-run: adds the column if you ran this file before banner_url existed
alter table site_settings add column if not exists banner_url text;

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists "site_settings public read" on site_settings;
create policy "site_settings public read" on site_settings
  for select using (true);

drop policy if exists "site_settings admin write" on site_settings;
create policy "site_settings admin write" on site_settings
  for update to authenticated using (true) with check (true);

-- ========== posts ==========
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('tweets', 'media', 'case_studies', 'activities')),
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table posts enable row level security;

drop policy if exists "posts public read published" on posts;
create policy "posts public read published" on posts
  for select using (status = 'published' or auth.role() = 'authenticated');

drop policy if exists "posts admin insert" on posts;
create policy "posts admin insert" on posts
  for insert to authenticated with check (true);

drop policy if exists "posts admin update" on posts;
create policy "posts admin update" on posts
  for update to authenticated using (true) with check (true);

drop policy if exists "posts admin delete" on posts;
create policy "posts admin delete" on posts
  for delete to authenticated using (true);

-- ========== post_media ==========
create table if not exists post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  position int not null default 0,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

alter table post_media enable row level security;

drop policy if exists "post_media public read" on post_media;
create policy "post_media public read" on post_media
  for select using (
    exists (
      select 1 from posts p
      where p.id = post_media.post_id
        and (p.status = 'published' or auth.role() = 'authenticated')
    )
  );

drop policy if exists "post_media admin write" on post_media;
create policy "post_media admin write" on post_media
  for all to authenticated using (true) with check (true);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row execute function set_updated_at();

drop trigger if exists site_settings_set_updated_at on site_settings;
create trigger site_settings_set_updated_at
  before update on site_settings
  for each row execute function set_updated_at();

-- ========== storage bucket for media (photos/videos) ==========
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 5242880) -- 5MB per file, enforced app-side for the 25MB/post total
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');

-- ========== admin account ==========
-- Create the single admin user from Supabase Dashboard -> Authentication -> Users -> Add user.
-- Use any email you like (it is never shown in the UI) and set the password to the 6-character
-- passkey you want to type on the admin login screen. Put that same email into assets/js/config.js.
