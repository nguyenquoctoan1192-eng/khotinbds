import type { ReactNode } from "react";
import SiteNavbar from "@/app/components/site-navbar";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin-layout-topnav">
      <SiteNavbar />
      {children}
    </div>
  );
}
