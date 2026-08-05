begin;

create extension if not exists pgcrypto;

alter table if exists public.bot_devices
  add column if not exists current_status text not null default 'idle',
  add column if not exists status_message text,
  add column if not exists current_job_id text,
  add column if not exists current_step text,
  add column if not exists progress_percent integer,
  add column if not exists current_group_count integer,
  add column if not exists total_group_count integer,
  add column if not exists last_error text,
  add column if not exists activity_updated_at timestamptz;

alter table if exists public.bot_devices
  drop constraint if exists bot_devices_current_status_check;

alter table if exists public.bot_devices
  add constraint bot_devices_current_status_check
  check (current_status in ('starting','idle','syncing','processing','posting','success','error','stopping'));

alter table if exists public.bot_devices
  drop constraint if exists bot_devices_progress_percent_check;

alter table if exists public.bot_devices
  add constraint bot_devices_progress_percent_check
  check (progress_percent is null or progress_percent between 0 and 100);

create table if not exists public.bot_broker_profiles (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null unique references public.bot_licenses(id) on delete cascade,
  agent_user_id uuid unique references auth.users(id) on delete set null,
  display_name text,
  default_contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bot_broker_profiles
  add column if not exists agent_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists display_name text,
  add column if not exists default_contact_phone text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.facebook_accounts
  add column if not exists broker_profile_id uuid references public.bot_broker_profiles(id) on delete set null;

alter table if exists public.bot_devices
  add column if not exists broker_profile_id uuid references public.bot_broker_profiles(id) on delete set null;

alter table if exists public.listings
  add column if not exists contact_phone_override text;

alter table if exists public.social_post_batches
  add column if not exists broker_profile_id uuid references public.bot_broker_profiles(id) on delete set null,
  add column if not exists contact_phone_snapshot text;

alter table if exists public.social_post_jobs
  add column if not exists contact_phone_snapshot text,
  add column if not exists hashtags_snapshot text[] not null default '{}';

create index if not exists idx_bot_devices_current_status
  on public.bot_devices(current_status, last_seen_at desc);
create index if not exists bot_broker_profiles_license_idx
  on public.bot_broker_profiles(license_id);
create index if not exists bot_broker_profiles_agent_user_idx
  on public.bot_broker_profiles(agent_user_id);
create index if not exists facebook_accounts_broker_profile_idx
  on public.facebook_accounts(broker_profile_id);
create index if not exists bot_devices_broker_profile_idx
  on public.bot_devices(broker_profile_id);

update public.bot_devices d
set broker_profile_id = p.id
from public.bot_broker_profiles p
where d.license_id = p.license_id
  and d.broker_profile_id is null;

update public.facebook_accounts a
set broker_profile_id = p.id
from public.bot_broker_profiles p
where a.license_id = p.license_id
  and a.broker_profile_id is null;

commit;
