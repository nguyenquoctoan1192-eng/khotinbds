import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { normalizeProfileRole, type UserRole } from "@/lib/roles";

export const AUTH_COOKIE_NAME = "bds_access_token";

export async function getServerUserRole(): Promise<UserRole> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return "customer";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData.user) return "customer";

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) return "customer";
  return normalizeProfileRole(profile.role);
}
