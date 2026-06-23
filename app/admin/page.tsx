import Link from "next/link";
import { redirect } from "next/navigation";
import SiteNavbar from "@/app/components/site-navbar";
import { getServerProfile } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/post", label: "Đăng tin" },
  { href: "/customers", label: "Khách hàng" },
  { href: "/listing-library", label: "Kho tin đăng" },
  { href: "/admin/agents", label: "Quản lý môi giới" },
];

export default async function AdminPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />
      <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
        <section style={{ padding: 26, borderRadius: 16, background: "#fff" }}>
          <h1 style={{ marginTop: 0 }}>Quản trị hệ thống</h1>
          <p style={{ color: "#64748b" }}>
            Quản lý nguồn nhà, khách hàng và tài khoản môi giới.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ padding: 16, border: "1px solid #dbeafe", borderRadius: 10, color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
