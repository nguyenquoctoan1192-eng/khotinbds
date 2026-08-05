alter table public.bot_devices
  add column if not exists current_status text not null default 'idle',
  add column if not exists status_message text,
  add column if not exists current_job_id text,
  add column if not exists current_step text,
  add column if not exists progress_percent integer,
  add column if not exists current_group_count integer,
  add column if not exists total_group_count integer,
  add column if not exists last_error text,
  add column if not exists activity_updated_at timestamptz;

alter table public.bot_devices
  drop constraint if exists bot_devices_current_status_check;

alter table public.bot_devices
  add constraint bot_devices_current_status_check
  check (current_status in ('starting','idle','syncing','processing','posting','success','error','stopping'));

alter table public.bot_devices
  drop constraint if exists bot_devices_progress_percent_check;

alter table public.bot_devices
  add constraint bot_devices_progress_percent_check
  check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100));

create index if not exists idx_bot_devices_current_status
  on public.bot_devices(current_status, last_seen_at desc);
