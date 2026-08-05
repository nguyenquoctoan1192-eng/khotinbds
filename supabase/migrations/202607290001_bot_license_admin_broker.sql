-- Admin owns system licenses; each broker owns only assigned licenses.
alter table public.bot_licenses
  add column if not exists license_type text not null default 'broker',
  add column if not exists owner_user_id uuid null,
  add column if not exists created_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_licenses_license_type_check'
  ) then
    alter table public.bot_licenses
      add constraint bot_licenses_license_type_check
      check (license_type in ('admin', 'broker'));
  end if;
end $$;

create index if not exists bot_licenses_owner_user_id_idx
  on public.bot_licenses(owner_user_id);

create index if not exists bot_licenses_license_type_idx
  on public.bot_licenses(license_type);

-- Existing licenses are treated as admin/system licenses.
update public.bot_licenses
set license_type = 'admin'
where owner_user_id is null
  and license_type = 'broker';

comment on column public.bot_licenses.owner_user_id is
  'Profile/user id that owns this license. Null means system/admin license.';

comment on column public.bot_licenses.created_by is
  'Admin profile/user id that created the license.';
