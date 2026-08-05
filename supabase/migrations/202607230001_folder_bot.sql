-- Bổ sung cột cho Kho tin đăng để nhận dữ liệu từ bot thư mục.
alter table public.listing_library add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.listing_library add column if not exists thumbnail_url text;
alter table public.listing_library add column if not exists status text not null default 'pending';
alter table public.listing_library add column if not exists source text;
alter table public.listing_library add column if not exists source_folder text;
alter table public.listing_library add column if not exists import_hash text;
create unique index if not exists listing_library_import_hash_unique
  on public.listing_library(import_hash) where import_hash is not null;

-- Tạo bucket công khai cho ảnh nếu chưa có.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = true;
