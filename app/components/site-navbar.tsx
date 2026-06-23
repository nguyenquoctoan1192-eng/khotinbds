"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, syncServerSession } from "@/lib/userRole";

const publicMenuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/login", label: "Đăng nhập" },
];

const adminMenuItems = [
  { href: "/admin", label: "Trang chủ" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/post", label: "Đăng tin" },
  { href: "/admin/customers", label: "Khách hàng" },
  { href: "/admin/listing-library", label: "Kho tin đăng" },
  { href: "/admin/agents", label: "Quản lý môi giới" },
];

const agentMenuItems = [
  { href: "/agent", label: "Trang chủ" },
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/customers", label: "Khách được giao" },
  { href: "/agent/assigned-homes", label: "Nhà được giao" },
  { href: "/agent/account", label: "Tài khoản" },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isAdminArea = pathname.startsWith("/admin");
  const isAgentArea = pathname.startsWith("/agent");

  const menuItems = isAdminArea
    ? adminMenuItems
    : isAgentArea
    ? agentMenuItems
    : publicMenuItems;

  const brandHref = isAdminArea ? "/admin" : isAgentArea ? "/agent" : "/";
  const showLogout = isAdminArea || isAgentArea;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href;
  };

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
          href={brandHref}
          className="site-navbar__brand"
          onClick={() => setIsOpen(false)}
        >
          BDS
        </Link>

        <button
          type="button"
          className="site-navbar__toggle"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "✕" : "☰"}
        </button>

        <nav
          className={`site-navbar__links${
            isOpen ? " site-navbar__links--open" : ""
          }`}
          aria-label="Điều hướng chính"
        >
          {menuItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-navbar__link${
                  active ? " site-navbar__link--active" : ""
                }`}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}

          {showLogout && (
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