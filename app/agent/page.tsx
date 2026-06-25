import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";

const agentCards = [
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/customers", label: "Khách được giao" },
  { href: "/agent/assigned-homes", label: "Nhà được giao" },
  { href: "/agent/account", label: "Tài khoản" },
];

export default function AgentPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Trang chủ Môi giới</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Quản lý khách được giao, nhà được giao và lịch chăm sóc.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {agentCards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                background: "#fff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: 20,
                color: "#1d4ed8",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}