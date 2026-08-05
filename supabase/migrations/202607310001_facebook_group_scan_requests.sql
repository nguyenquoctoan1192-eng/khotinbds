create extension if not exists pgcrypto;

create table if not exists public.facebook_group_scan_requests (
  id uuid primary key default gen_random_uuid(),
  facebook_account_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  found_count integer not null default 0,
  saved_count integer not null default 0,
  last_error text
);

create index if not exists facebook_group_scan_requests_account_status_idx
  on public.facebook_group_scan_requests(
    facebook_account_id,
    status,
    requested_at desc
  );

create unique index if not exists facebook_group_scan_requests_one_active_idx
  on public.facebook_group_scan_requests(facebook_account_id)
  where status in ('pending','processing');
