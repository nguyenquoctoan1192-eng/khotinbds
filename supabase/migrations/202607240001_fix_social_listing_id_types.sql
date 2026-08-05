begin;

------------------------------------------------------------
-- Đồng bộ kiểu listing_id với public.listings.id
------------------------------------------------------------

alter table public.social_post_batches
alter column listing_id type uuid
using listing_id::uuid;

alter table public.social_post_jobs
alter column listing_id type uuid
using listing_id::uuid;

------------------------------------------------------------
-- Thêm foreign key để ngăn dữ liệu lệch trong tương lai
------------------------------------------------------------

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'social_post_batches_listing_id_fkey'
          and conrelid = 'public.social_post_batches'::regclass
    ) then
        alter table public.social_post_batches
        add constraint social_post_batches_listing_id_fkey
        foreign key (listing_id)
        references public.listings(id)
        on delete cascade;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'social_post_jobs_listing_id_fkey'
          and conrelid = 'public.social_post_jobs'::regclass
    ) then
        alter table public.social_post_jobs
        add constraint social_post_jobs_listing_id_fkey
        foreign key (listing_id)
        references public.listings(id)
        on delete cascade;
    end if;
end
$$;

create index if not exists idx_social_batches_listing_id
on public.social_post_batches(listing_id);

create index if not exists idx_social_jobs_listing_id
on public.social_post_jobs(listing_id);

commit;