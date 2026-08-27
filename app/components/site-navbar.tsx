"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authClient,
  syncServerSession,
} from "@/lib/userRole";

type MenuItem = {
  href: string;
  label: string;
};

const publicMenuItems: MenuItem[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/login", label: "Đăng nhập" },
];

const agentMenuItems: MenuItem[] = [
  { href: "/agent", label: "Trang chủ" },
  { href: "/agent/dashboard", label: "Dashboard" },
  { href: "/agent/customers", label: "Khách hàng" },
  {
    href: "/agent/assigned-homes",
    label: "Khách được giao",
  },
  {
    href: "/agent/listing-library",
    label: "Kho tin đăng",
  },
  {
    href: "/agent/bot-settings",
    label: "Bot của tôi",
  },
  {
    href: "/agent/account",
    label: "Tài khoản",
  },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [agentBotOnline, setAgentBotOnline] =
    useState<boolean | null>(null);

  const isAdminArea = pathname.startsWith("/admin");
  const isAgentArea = pathname.startsWith("/agent");

  useEffect(() => {
    if (!isAgentArea) return;

    let cancelled = false;

    async function loadBotStatus() {
      try {
        const response = await fetch(
          "/api/agent/bot-settings",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) return;

        const json = await response.json();

        const devices = Array.isArray(json?.devices)
          ? json.devices
          : [];

        const isOnline = devices.some(
          (device: {
            is_active?: boolean;
            last_seen_at?: string | null;
          }) => {
            if (
              !device?.is_active ||
              !device?.last_seen_at
            ) {
              return false;
            }

            return (
              Date.now() -
                new Date(
                  device.last_seen_at,
                ).getTime() <
              90_000
            );
          },
        );

        if (!cancelled) {
          setAgentBotOnline(isOnline);
        }
      } catch {
        if (!cancelled) {
          setAgentBotOnline(false);
        }
      }
    }

    void loadBotStatus();

    const timer = window.setInterval(
      () => void loadBotStatus(),
      20_000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAgentArea]);

  const menuItems = isAgentArea
    ? agentMenuItems
    : publicMenuItems;

  const brandHref = isAgentArea
    ? "/agent"
    : "/";

  const showLogout =
    isAdminArea || isAgentArea;

  const isActive = (href: string) => {
    if (
      href === "/" ||
      href === "/admin" ||
      href === "/agent"
    ) {
      return pathname === href;
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
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

  if (isAdminArea) {
    return null;
  }

  return (
    <header className="site-navbar">
      <div className="site-navbar__inner">

        {/* LOGO BĐS */}
        <Link
          href={brandHref}
          className="site-navbar__brand"
          aria-label="Kho Tin BĐS"
        >
          <span className="site-navbar__brand-icon">
            BĐS
          </span>

          <span className="site-navbar__brand-text">
            Kho Tin BĐS
          </span>
        </Link>

        {/* MOBILE TOGGLE */}
        <button
          type="button"
          className="site-navbar__toggle"
          onClick={() =>
            setIsOpen((value) => !value)
          }
          aria-label="Mở menu"
          aria-expanded={isOpen}
        >
          ☰
        </button>

        {/* MENU */}
        <nav
          className={`site-navbar__links ${
            isOpen
              ? "site-navbar__links--open"
              : ""
          }`}
        >
          {menuItems.map((item) => {
            const active = isActive(
              item.href,
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`site-navbar__link ${
                  active
                    ? "site-navbar__link--active"
                    : ""
                }`}
                onClick={() =>
                  setIsOpen(false)
                }
              >
                {item.label}
              </Link>
            );
          })}

          {isAgentArea &&
            agentBotOnline !== null && (
              <span className="site-navbar__bot-status">
                <span
                  className={`site-navbar__status-dot ${
                    agentBotOnline
                      ? "site-navbar__status-dot--online"
                      : "site-navbar__status-dot--offline"
                  }`}
                />
                {agentBotOnline
                  ? "Bot Online"
                  : "Bot Offline"}
              </span>
            )}

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