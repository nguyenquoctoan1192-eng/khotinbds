"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/admin", label: "Trang chủ", icon: "⌂" },
  { href: "/admin/customers", label: "Khách hàng", icon: "♙" },
  { href: "/admin/social-publishing", label: "AI đăng tin", icon: "✦" },
  { href: "/admin/post", label: "Đăng tin", icon: "+" },
  { href: "/admin/bot", label: "Quản lý Bot", icon: "◉" },
  { href: "/admin/agents", label: "Quản lý môi giới", icon: "♧" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          height: 76,
          background: "#07172f",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 6px 20px rgba(15,23,42,0.18)",
        }}
      >
        <div
          style={{
            width: "min(1480px, calc(100% - 40px))",
            height: "100%",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#fff",
              textDecoration: "none",
              minWidth: 120,
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                display: "grid",
                placeItems: "center",
                borderRadius: 11,
                background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                fontSize: 22,
              }}
            >
              ⌂
            </span>
            <strong style={{ fontSize: 22 }}>BDS</strong>
          </Link>

          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flex: 1,
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 42,
                    padding: "0 14px",
                    borderRadius: 10,
                    color: active ? "#fff" : "#dbe7f7",
                    background: active ? "#2563eb" : "transparent",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    fontSize: 14,
                    fontWeight: 700,
                    transition: "background .18s ease,color .18s ease",
                  }}
                >
                  <span style={{ fontSize: 17 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                background: "#e2e8f0",
                color: "#0f172a",
                fontWeight: 800,
              }}
            >
              A
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Admin BDS</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Quản trị viên</div>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
