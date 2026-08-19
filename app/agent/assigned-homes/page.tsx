import { redirect } from "next/navigation";
import SiteNavbar from "@/app/components/site-navbar";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export default async function AssignedHomesPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "agent" && profile.role !== "admin") redirect("/");

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
        <section style={{ padding: 28, borderRadius: 16, background: "#fff" }}>
          <h1 style={{ marginTop: 0 }}>Nhà được giao</h1>
          <p style={{ color: "#64748b", marginBottom: 0 }}>
            Nguồn nhà được phân công cho môi giới sẽ hiển thị tại đây. Khu vực phụ trách hiện tại: <strong>{profile.area || "Chưa cập nhật"}</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}

