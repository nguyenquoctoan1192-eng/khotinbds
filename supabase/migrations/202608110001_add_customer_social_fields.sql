-- Customer contact fields.
-- IF NOT EXISTS keeps this migration safe if an older database already has either column.
alter table if exists public.leads
  add column if not exists zalo text,
  add column if not exists facebook text;
