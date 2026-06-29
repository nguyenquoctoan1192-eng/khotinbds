alter table public.listings
  add column if not exists primary_content text null,
  add column if not exists chotot_title text null,
  add column if not exists facebook_title text null,
  add column if not exists short_description text null,
  add column if not exists seo_description text null;
