-- 1 job = 1 nhóm chính + 9 nhóm phụ
alter table public.social_post_batches
  add column if not exists primary_group_id uuid references public.facebook_groups(id) on delete set null,
  add column if not exists extra_group_ids uuid[] not null default '{}'::uuid[],
  add column if not exists extra_group_names text[] not null default '{}'::text[],
  add column if not exists total_group_count integer not null default 1;

alter table public.social_post_batches
  drop constraint if exists social_post_batches_total_group_count_check;

alter table public.social_post_batches
  add constraint social_post_batches_total_group_count_check
  check (total_group_count between 1 and 10);

create index if not exists social_post_batches_primary_group_id_idx
  on public.social_post_batches(primary_group_id);
