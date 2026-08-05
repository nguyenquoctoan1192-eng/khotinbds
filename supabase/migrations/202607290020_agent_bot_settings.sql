alter table if exists public.bot_broker_profiles
  add column if not exists agent_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists bot_broker_profiles_agent_user_idx
  on public.bot_broker_profiles(agent_user_id);
