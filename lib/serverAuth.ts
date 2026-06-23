import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { normalizeProfileRole, type UserRole } from "@/lib/roles";
import type { ProfileStatus } from "@/lib/agentProfile";
import { AUTH_COOKIE_NAME } from "@/lib/authConstants";

export { AUTH_COOKIE_NAME } from "@/lib/authConstants";

export type ServerProfile = {
  id: string;
  role: UserRole;
  status: ProfileStatus;
  area: string | null;
};

export async function getServerProfile(): Promise<ServerProfile | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, status, area")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    role: normalizeProfileRole(data.role),
    status: data.status as ProfileStatus,
    area: data.area,
  };
}

export async function getServerUserRole(): Promise<UserRole> {
  const profile = await getServerProfile();
  return profile?.status === "approved" ? profile.role : "customer";
}
