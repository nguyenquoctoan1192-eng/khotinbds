create unique index if not exists
  bot_broker_profiles_license_id_unique
on public.bot_broker_profiles (license_id)
where license_id is not null;

select
  bl.id as license_id,
  bl.name as license_name,
  bp.id as broker_profile_id,
  bp.agent_user_id,
  bp.default_contact_phone,
  bp.is_active
from public.bot_licenses bl
left join public.bot_broker_profiles bp
  on bp.license_id = bl.id
order by bl.created_at desc;
