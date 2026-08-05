create extension if not exists pgcrypto;

create table if not exists public.bot_licenses (
  id uuid primary key default gen_random_uuid(),
  license_key_hash text not null unique,
  license_key_prefix text not null,
  name text not null,
  broker_user_id uuid,
  is_active boolean not null default true,
  max_devices integer not null default 1 check (max_devices > 0),
  max_facebook_accounts integer not null default 1 check (max_facebook_accounts > 0),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.bot_licenses(id) on delete cascade,
  device_uid text not null,
  device_name text,
  platform text,
  app_version text,
  token_hash text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  last_ip text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_id, device_uid)
);

alter table public.facebook_accounts
  add column if not exists license_id uuid references public.bot_licenses(id) on delete set null,
  add column if not exists external_uid text,
  add column if not exists facebook_user_id text,
  add column if not exists last_group_sync_at timestamptz,
  add column if not exists synced_group_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.facebook_groups
  add column if not exists facebook_account_id uuid references public.facebook_accounts(id) on delete cascade,
  add column if not exists facebook_group_id text,
  add column if not exists source text not null default 'manual',
  add column if not exists last_synced_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_bot_devices_token_hash
  on public.bot_devices(token_hash) where token_hash is not null;
create index if not exists idx_bot_devices_license on public.bot_devices(license_id);
create index if not exists idx_bot_devices_last_seen on public.bot_devices(last_seen_at desc);
create index if not exists idx_facebook_accounts_license on public.facebook_accounts(license_id);
create unique index if not exists idx_facebook_groups_account_group
  on public.facebook_groups(facebook_account_id, facebook_group_id)
  where facebook_account_id is not null and facebook_group_id is not null;

alter table public.bot_licenses enable row level security;
alter table public.bot_devices enable row level security;
