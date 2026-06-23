alter table public.profiles
  add column if not exists phone text,
  add column if not exists zalo text,
  add column if not exists area text,
  add column if not exists status text;

update public.profiles
set role = 'agent'
where lower(role) = 'broker';

-- Profiles that existed before the approval workflow remain usable.
update public.profiles
set status = 'approved'
where status is null;

alter table public.profiles
  alter column role set default 'agent',
  alter column role set not null,
  alter column status set default 'pending',
  alter column status set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check check (role in ('admin', 'agent')),
  drop constraint if exists profiles_status_check,
  add constraint profiles_status_check
    check (status in ('pending', 'approved', 'rejected', 'suspended'));

create index if not exists profiles_area_idx on public.profiles (area);
create index if not exists profiles_status_idx on public.profiles (status);

create or replace function public.is_profiles_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

revoke all on function public.is_profiles_admin() from public;
grant execute on function public.is_profiles_admin() to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_profiles_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_profiles_admin())
with check (public.is_profiles_admin());

create or replace function public.handle_new_agent_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    zalo,
    area,
    role,
    status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'zalo'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'area'), ''),
    'agent',
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_agent_profile on auth.users;
create trigger on_auth_user_created_create_agent_profile
after insert on auth.users
for each row execute function public.handle_new_agent_profile();

-- Source-house writes are restricted at the database layer as well.
alter table public.listings enable row level security;

drop policy if exists "Public can read listings" on public.listings;
create policy "Public can read listings"
on public.listings
for select
using (true);

drop policy if exists "Admins can insert listings" on public.listings;
create policy "Admins can insert listings"
on public.listings
for insert
to authenticated
with check (public.is_profiles_admin());

drop policy if exists "Admins can update listings" on public.listings;
create policy "Admins can update listings"
on public.listings
for update
to authenticated
using (public.is_profiles_admin())
with check (public.is_profiles_admin());

drop policy if exists "Admins can delete listings" on public.listings;
create policy "Admins can delete listings"
on public.listings
for delete
to authenticated
using (public.is_profiles_admin());

alter table public.listing_library enable row level security;

alter table public.leads
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);

create or replace function public.assign_lead_by_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demand_text text;
begin
  if new.assigned_to is not null then
    return new;
  end if;

  demand_text := lower(
    coalesce(new.preferred_districts::text, '') || ' ' || coalesce(new.note, '')
  );

  select profile.id
  into new.assigned_to
  from public.profiles as profile
  where profile.role = 'agent'
    and profile.status = 'approved'
    and profile.area is not null
    and (
      demand_text like '%' || lower(profile.area) || '%'
      or demand_text like '%' || replace(lower(profile.area), 'tp ', '') || '%'
    )
  order by (
    select count(*)
    from public.leads as assigned_lead
    where assigned_lead.assigned_to = profile.id
  ) asc,
  profile.created_at asc
  limit 1;

  return new;
end;
$$;

drop trigger if exists assign_lead_by_area_before_insert on public.leads;
create trigger assign_lead_by_area_before_insert
before insert on public.leads
for each row execute function public.assign_lead_by_area();
