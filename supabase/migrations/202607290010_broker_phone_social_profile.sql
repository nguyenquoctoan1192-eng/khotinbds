create table if not exists public.bot_broker_profiles (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null unique references public.bot_licenses(id) on delete cascade,
  display_name text,
  default_contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists bot_broker_profiles_license_idx
  on public.bot_broker_profiles(license_id);

create index if not exists facebook_accounts_broker_profile_idx
  on public.facebook_accounts(broker_profile_id);

create index if not exists bot_devices_broker_profile_idx
  on public.bot_devices(broker_profile_id);
