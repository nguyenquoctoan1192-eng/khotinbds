import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { AUTH_COOKIE_NAME } from "@/lib/authConstants";
import { normalizeProfileRole, type UserRole } from "@/lib/roles";
import type { ProfileStatus } from "@/lib/agentProfile";

export type AuthorizedProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  zalo: string | null;
  area: string | null;
  role: UserRole;
  status: ProfileStatus;
};

const getToken = (req: Request) => {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([name]) => name === AUTH_COOKIE_NAME);

  return cookie?.slice(1).join("=") ? decodeURIComponent(cookie.slice(1).join("=")) : null;
};

const createServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function getRequestAuth(req: Request): Promise<{
  user: User;
  profile: AuthorizedProfile;
} | null> {
  const token = getToken(req);
  if (!token) return null;

  const supabase = createServiceClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, zalo, area, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user: authData.user,
    profile: {
      ...data,
      role: normalizeProfileRole(data.role),
      status: data.status as ProfileStatus,
    },
  };
}

export async function authorizeRequest(req: Request, allowedRoles: UserRole[]) {
  const auth = await getRequestAuth(req);
  if (!auth || auth.profile.status !== "approved") return null;
  if (!allowedRoles.includes(auth.profile.role)) return null;
  return auth;
}

export async function getAuthenticatedUser(req: Request) {
  const auth = await authorizeRequest(req, ["admin", "agent"]);
  return auth?.user || null;
}
