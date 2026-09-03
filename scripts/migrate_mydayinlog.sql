-- Canonical schema: scripts/daylog_tables.sql
-- This file is kept so auth error hints and the agent checklist still resolve.

-- MyDayInLog tables in the SHARED Supabase project (same as Milestone).
-- Run in Supabase SQL Editor. Does not modify Milestone tables.

create table if not exists public.daylog_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  invitation_code text not null unique,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.daylog_profiles
  add column if not exists avatar_url text;

create table if not exists public.daylog_activity_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.daylog_profiles(id) on delete cascade,
  name text not null,
  color text not null default '#c8922a',
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.daylog_time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.daylog_profiles(id) on delete cascade,
  activity_type_id uuid not null references public.daylog_activity_types(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists daylog_time_blocks_one_open_per_user
  on public.daylog_time_blocks (user_id)
  where ended_at is null;

create index if not exists daylog_time_blocks_user_started_idx
  on public.daylog_time_blocks (user_id, started_at desc);

create index if not exists daylog_activity_types_user_sort
  on public.daylog_activity_types (user_id, sort);

alter table public.daylog_profiles enable row level security;
alter table public.daylog_activity_types enable row level security;
alter table public.daylog_time_blocks enable row level security;

drop policy if exists "daylog_profiles_own" on public.daylog_profiles;
drop policy if exists "daylog_profiles_select_own" on public.daylog_profiles;
drop policy if exists "daylog_profiles_insert_own" on public.daylog_profiles;
drop policy if exists "daylog_profiles_update_own" on public.daylog_profiles;
create policy "daylog_profiles_own"
  on public.daylog_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "daylog_activity_types_own" on public.daylog_activity_types;
drop policy if exists "daylog_activity_select_own" on public.daylog_activity_types;
drop policy if exists "daylog_activity_insert_own" on public.daylog_activity_types;
drop policy if exists "daylog_activity_update_own" on public.daylog_activity_types;
create policy "daylog_activity_types_own"
  on public.daylog_activity_types for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daylog_time_blocks_own" on public.daylog_time_blocks;
drop policy if exists "daylog_blocks_select_own" on public.daylog_time_blocks;
drop policy if exists "daylog_blocks_insert_own" on public.daylog_time_blocks;
drop policy if exists "daylog_blocks_update_own" on public.daylog_time_blocks;
create policy "daylog_time_blocks_own"
  on public.daylog_time_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.daylog_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.daylog_activity_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.daylog_time_blocks to anon, authenticated, service_role;

comment on table public.daylog_profiles is 'MyDayInLog only — not Milestone profiles';
comment on table public.daylog_time_blocks is 'MyDayInLog focus/time blocks';
