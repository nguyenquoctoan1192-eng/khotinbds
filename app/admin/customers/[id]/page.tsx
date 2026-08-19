"use client";

import { useParams } from "next/navigation";
import RoleGate from "@/app/components/role-gate";
import { CustomerWorkspace } from "../customer-workspace";

function CustomerDetailRoute() {
  const params = useParams<{ id: string }>();
  return <CustomerWorkspace initialId={String(params.id || "")} />;
}

export default function CustomerDetailPage() {
  return <RoleGate allowedRoles={["admin", "agent"]}><CustomerDetailRoute /></RoleGate>;
}
