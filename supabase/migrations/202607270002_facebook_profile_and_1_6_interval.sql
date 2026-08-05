alter table public.facebook_accounts
  add column if not exists profile_url text;

update public.facebook_accounts
set
  interval_min_minutes = 1,
  interval_max_minutes = 6
where
  interval_min_minutes is null
  or interval_max_minutes is null
  or interval_min_minutes <> 1
  or interval_max_minutes <> 6;

alter table public.facebook_accounts
  alter column interval_min_minutes set default 1,
  alter column interval_max_minutes set default 6;

alter table public.facebook_accounts
  drop constraint if exists facebook_accounts_interval_range_check;

alter table public.facebook_accounts
  add constraint facebook_accounts_interval_range_check
  check (
    interval_min_minutes between 1 and 6
    and interval_max_minutes between 1 and 6
    and interval_max_minutes >= interval_min_minutes
  );
