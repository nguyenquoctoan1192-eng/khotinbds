"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, syncServerSession, useUserRole } from "@/lib/userRole";

const publicMenuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/login", label: "Đăng nhập" },
];

const agentMenuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/agent", label: "Dashboard" },
  { href: "/customers", label: "Khách được giao" },
  { href: "/assigned-homes", label: "Nhà được giao" },
  { href: "/account", label: "Tài khoản" },
];

const adminMenuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/admin", label: "Dashboard" },
  { href: "/post", label: "Đăng tin" },
  { href: "/customers", label: "Khách hàng" },
  { href: "/listing-library", label: "Kho tin đăng" },
  { href: "/admin/agents", label: "Quản lý môi giới" },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const { role, roleLoading } = useUserRole();

  const isAdminRoute = pathname.startsWith("/admin");
  const isAgentRoute = pathname.startsWith("/agent");

  const visibleMenuItems =
    roleLoading
      ? []
      : isAdminRoute && role === "admin"
      ? adminMenuItems
      : isAgentRoute && role === "agent"
      ? agentMenuItems
      : publicMenuItems;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const logout = async () => {
    await Promise.allSettled([
      authClient.auth.signOut(),
      syncServerSession(),
    ]);

    setIsOpen(false);

    router.replace("/");
    router.refresh();
  };

  return (
    <header className="site-navbar">
      <div className="site-navbar__inner">
        <Link
          href="/"
          className="site-navbar__brand"
          onClick={() => setIsOpen(false)}
        >
          BDS
        </Link>

        <button
          type="button"
          className="site-navbar__toggle"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          {isOpen ? "✕" : "☰"}
        </button>

        <nav
          className={`site-navbar__links${
            isOpen ? " site-navbar__links--open" : ""
          }`}
        >
          {visibleMenuItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-navbar__link${
                  active ? " site-navbar__link--active" : ""
                }`}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}

          {!roleLoading &&
            ((isAdminRoute && role === "admin") ||
              (isAgentRoute && role === "agent")) && (
              <button
                type="button"
                className="site-navbar__logout"
                onClick={logout}
              >
                Đăng xuất
              </button>
            )}
        </nav>
      </div>
    </header>
  );
}