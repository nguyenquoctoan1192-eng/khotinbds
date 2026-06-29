ALTER TABLE listings
ADD COLUMN IF NOT EXISTS primary_content text,
ADD COLUMN IF NOT EXISTS chotot_title text,
ADD COLUMN IF NOT EXISTS facebook_title text,
ADD COLUMN IF NOT EXISTS short_description text,
ADD COLUMN IF NOT EXISTS seo_description text;