import { redirect } from "next/navigation";
import SiteNavbar from "@/app/components/site-navbar";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "agent") redirect(profile.role === "admin" ? "/admin" : "/");

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
        <section style={{ padding: 28, borderRadius: 16, background: "#fff" }}>
          <h1 style={{ marginTop: 0 }}>Tài khoản môi giới</h1>
          <div style={{ display: "grid", gap: 12, color: "#334155" }}>
            <div><strong>Vai trò:</strong> Môi giới</div>
            <div><strong>Trạng thái:</strong> Đã duyệt</div>
            <div><strong>Khu vực phụ trách:</strong> {profile.area || "Chưa cập nhật"}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

