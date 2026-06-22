"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/post", label: "Đăng tin" },
  { href: "/listing-library", label: "📚 Kho tin đăng" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
          {menuItems.map((item) => {
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
        </nav>
      </div>
    </header>
  );
}
