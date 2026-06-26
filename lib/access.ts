import "server-only";

import { authorizeRequest } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import type { UserRole } from "@/lib/roles";

const defaultRoles: UserRole[] = ["admin", "agent"];

export async function getAccess(
  req: Request,
  allowedRoles: UserRole[] = defaultRoles
) {
  const auth = await authorizeRequest(req, allowedRoles);

  if (!auth) {
    return null;
  }

  const role = auth.profile.role;
  const permissions = getPermissions(role);

  return {
    auth,
    user: auth.user,
    profile: auth.profile,
    role,
    permissions,
    isAdmin: role === "admin",
    isAgent: role === "agent",
  };
}