import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";

const adminCards = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/post", label: "Đăng tin" },
  { href: "/admin/customers", label: "Khách hàng" },
  { href: "/admin/listing-library", label: "Kho tin đăng" },
  { href: "/admin/agents", label: "Quản lý môi giới" },
];

export default function AdminPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />

      <main
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "24px 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            background: "#fff",
            borderRadius: 16,
            padding: 24,
          }}
        >
          {adminCards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: 9,
                padding: 18,
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