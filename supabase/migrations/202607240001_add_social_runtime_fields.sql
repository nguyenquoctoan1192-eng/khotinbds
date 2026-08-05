-- 202607240001_add_social_runtime_fields.sql

---------------------------------------------------
-- facebook_accounts
---------------------------------------------------

alter table public.facebook_accounts
add column if not exists status text default 'active';

alter table public.facebook_accounts
add column if not exists health_status text default 'healthy';

alter table public.facebook_accounts
add column if not exists paused_until timestamptz;

alter table public.facebook_accounts
add column if not exists daily_post_limit integer default 20;

alter table public.facebook_accounts
add column if not exists hourly_post_limit integer default 5;

alter table public.facebook_accounts
add column if not exists posts_today integer default 0;

alter table public.facebook_accounts
add column if not exists posts_this_hour integer default 0;

alter table public.facebook_accounts
add column if not exists last_checkpoint_at timestamptz;

alter table public.facebook_accounts
add column if not exists last_captcha_at timestamptz;

alter table public.facebook_accounts
add column if not exists last_error text;

---------------------------------------------------
-- facebook_groups
---------------------------------------------------

alter table public.facebook_groups
add column if not exists group_status text default 'active';

alter table public.facebook_groups
add column if not exists muted_until timestamptz;

alter table public.facebook_groups
add column if not exists daily_post_limit integer default 10;

alter table public.facebook_groups
add column if not exists posts_today integer default 0;

alter table public.facebook_groups
add column if not exists allowed_start_hour integer default 7;

alter table public.facebook_groups
add column if not exists allowed_end_hour integer default 22;

alter table public.facebook_groups
add column if not exists post_interval_hours integer default 24;