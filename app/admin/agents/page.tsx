import { redirect } from "next/navigation";
import AgentsManager from "@/app/admin/agents/agents-manager";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="agents-page">
      <div className="agents-page__main">
        <div className="agents-page__heading">
          <div>
            <h1>Quản lý môi giới</h1>
            <p>Duyệt tài khoản và quản lý trạng thái tham gia hệ thống.</p>
          </div>
        </div>
        <AgentsManager />
      </div>
    </div>
  );
}
