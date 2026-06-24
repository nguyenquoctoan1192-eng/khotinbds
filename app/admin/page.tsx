"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNavbar from "@/app/components/site-navbar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function AdminPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadListings = async () => {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });

      setListings(data || []);
      setLoading(false);
    };

    loadListings();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>Trang chủ Admin</h1>
            <p style={{ color: "#6b7280" }}>Danh sách nhà đầy đủ thông tin nội bộ.</p>
          </div>

          <Link href="/admin/post" style={{ background: "#2563eb", color: "#fff", padding: "11px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
            + Đăng tin mới
          </Link>
        </div>

        {loading && <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>Đang tải dữ liệu...</div>}

        {!loading && listings.length === 0 && (
          <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>Chưa có tin đăng.</div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {listings.map((item) => (
            <div key={item.id} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <h2 style={{ marginTop: 0 }}>{item.title || item.address || "Tin chưa có tiêu đề"}</h2>

              <div style={{ display: "grid", gap: 6, color: "#374151" }}>
                <div><b>Địa chỉ:</b> {item.address || item.location || "Chưa có"}</div>
                <div><b>Giá:</b> {item.price || "Chưa có"}</div>
                <div><b>Diện tích:</b> {item.area || "Chưa có"}</div>
                <div><b>Kết cấu:</b> {item.structure || "Chưa có"}</div>
                <div><b>SĐT:</b> {item.phone || "Chưa có"}</div>
                <div><b>Hoa hồng:</b> {item.commission || item.hh || "Chưa có"}</div>
                <div><b>Trạng thái:</b> {item.status === "rented" ? "Đã cho thuê" : "Còn trống"}</div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <Link href={`/admin/edit/${item.id}`} style={{ color: "#2563eb", fontWeight: 700 }}>
                  Sửa tin
                </Link>
                <Link href={`/listing/${item.id}`} style={{ color: "#111827", fontWeight: 700 }}>
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}