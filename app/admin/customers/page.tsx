import RoleGate from "@/app/components/role-gate";
import { CustomerWorkspace } from "./customer-workspace";

type CustomersPageProps = {
  searchParams: Promise<{ customer?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const customerId = typeof params.customer === "string" ? params.customer : "";

  return (
    <RoleGate allowedRoles={["admin", "agent"]}>
      <CustomerWorkspace initialId={customerId} />
    </RoleGate>
  );
}

