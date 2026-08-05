alter table public.listings
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_status text;

create index if not exists listings_coordinates_idx
  on public.listings (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists listings_geocode_status_idx
  on public.listings (geocode_status);
