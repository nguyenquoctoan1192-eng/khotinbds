"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, syncServerSession, useUserRole } from "@/lib/userRole";

const publicMenuItems = [{ href: "/", label: "Trang chủ" }];
const agentMenuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/listing-library", label: "📚 Kho tin đăng" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Khách hàng" },
];
const adminMenuItems = [
  agentMenuItems[0],
  { href: "/post", label: "Đăng tin" },
  ...agentMenuItems.slice(1),
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();
  const visibleMenuItems =
    role === "admin"
      ? adminMenuItems
      : role === "broker"
        ? agentMenuItems
        : publicMenuItems;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const logout = async () => {
    await authClient.auth.signOut();
    await syncServerSession();
    setIsOpen(false);
    router.replace("/");
    router.refresh();
  };

  return (
    <header className="site-navbar">
      <div className="site-navbar__inner">
        <Link href="/" className="site-navbar__brand" onClick={() => setIsOpen(false)}>
          BDS
        </Link>

        <button
          type="button"
          className="site-navbar__toggle"
          aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "✕" : "☰"}
        </button>

        <nav
          id="site-navigation"
          className={`site-navbar__links${isOpen ? " site-navbar__links--open" : ""}`}
          aria-label="Điều hướng chính"
        >
          {visibleMenuItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-navbar__link${active ? " site-navbar__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          {role !== "customer" && (
            <button type="button" className="site-navbar__logout" onClick={logout}>
              Đăng xuất
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
