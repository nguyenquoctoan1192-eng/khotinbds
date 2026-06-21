create extension if not exists pgcrypto;

create table if not exists public.listing_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  raw_input text null,
  title text null,
  primary_content text not null,
  chotot_title text null,
  facebook_title text null,
  short_description text null,
  seo_description text null,
  phone text null,
  district text null,
  street text null,
  price text null,
  area text null,
  structure text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_library_created_at_idx
  on public.listing_library (created_at desc);

create index if not exists listing_library_district_idx
  on public.listing_library (district);

create index if not exists listing_library_street_idx
  on public.listing_library (street);

create index if not exists listing_library_phone_idx
  on public.listing_library (phone);

create or replace function public.set_listing_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_listing_library_updated_at on public.listing_library;

create trigger set_listing_library_updated_at
before update on public.listing_library
for each row
execute function public.set_listing_library_updated_at();
