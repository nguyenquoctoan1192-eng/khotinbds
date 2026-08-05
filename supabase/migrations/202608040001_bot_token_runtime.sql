--------------------------------------------------
-- bot_devices
--------------------------------------------------

alter table public.bot_devices
add column if not exists issued_at timestamptz;

alter table public.bot_devices
add column if not exists expires_at timestamptz;

alter table public.bot_devices
add column if not exists last_used_at timestamptz;

alter table public.bot_devices
add column if not exists request_count bigint default 0;

alter table public.bot_devices
add column if not exists last_ip text;

alter table public.bot_devices
add column if not exists last_version text;

create index if not exists idx_bot_devices_last_used
on public.bot_devices(last_used_at);

create index if not exists idx_bot_devices_expires
on public.bot_devices(expires_at);