alter table public.listings
add column if not exists status text not null default 'available';
