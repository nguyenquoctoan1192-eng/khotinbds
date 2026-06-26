import type { UserRole } from "@/lib/roles";

export type AppRole = UserRole | "public";


export type Permissions = {
  canEditListing: boolean;
  canDeleteListing: boolean;
  canViewOwnerPhone: boolean;
  canManageAgents: boolean;
  canPostListing: boolean;
  canAssignLead: boolean;
};

export function getPermissions(role: AppRole): Permissions {
  switch (role) {
    case "admin":
      return {
        canEditListing: true,
        canDeleteListing: true,
        canViewOwnerPhone: true,
        canManageAgents: true,
        canPostListing: true,
        canAssignLead: true,
      };

    case "agent":
      return {
        canEditListing: false,
        canDeleteListing: false,
        canViewOwnerPhone: true,
        canManageAgents: false,
        canPostListing: false,
        canAssignLead: false,
      };

    default:
      return {
        canEditListing: false,
        canDeleteListing: false,
        canViewOwnerPhone: false,
        canManageAgents: false,
        canPostListing: false,
        canAssignLead: false,
      };
  }
}