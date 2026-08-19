"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/userRole";
import type { UserRole } from "@/lib/roles";

export default function RoleGate({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { role, roleLoading } = useUserRole();
  const allowed = allowedRoles.includes(role);

  useEffect(() => {
    if (!roleLoading && !allowed) router.replace("/login");
  }, [allowed, roleLoading, router]);

  if (roleLoading || !allowed) {
    return <div style={{ padding: 20 }}>Đang kiỒm tra quyền truy cập...</div>;
  }

  return children;
}

