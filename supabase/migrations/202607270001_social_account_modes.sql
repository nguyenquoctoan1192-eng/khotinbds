alter table public.facebook_accounts
  add column if not exists posting_mode text not null default 'scheduled',
  add column if not exists start_time time not null default '08:00',
  add column if not exists end_time time not null default '22:00',
  add column if not exists interval_min_minutes integer not null default 3,
  add column if not exists interval_max_minutes integer not null default 10,
  add column if not exists max_posts_per_day integer not null default 50;

alter table public.facebook_accounts
  drop constraint if exists facebook_accounts_posting_mode_check;

alter table public.facebook_accounts
  add constraint facebook_accounts_posting_mode_check
  check (posting_mode in ('live', 'scheduled'));

update public.facebook_accounts
set posting_mode = case
  when id = (select id from public.facebook_accounts order by created_at asc limit 1)
    then 'live'
  else coalesce(posting_mode, 'scheduled')
end;
