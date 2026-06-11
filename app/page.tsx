"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function Home() {
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [parsedFilters, setParsedFilters] =
    useState<ParsedRequirementFilters | null>(null);
  const [showTopButton, setShowTopButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const fetchListings = async () => {
    setLoading(true);

    if (search.trim()) {
      const parsed = parseVietnameseRequirement(search);

      setParsedFilters(parsed);

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "lead",
          note: parsed.note || null,
          preferred_districts: parsed.preferred_districts,
          max_price: parsed.max_price,
          min_area: parsed.min_area,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setListings([]);
        setLoading(false);
        return;
      }

      setListings(json.matches || []);
      setLoading(false);
      return;
    }

    setParsedFilters(null);

    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setListings([]);
      setLoading(false);
      return;
    }

    setListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchListings();
  }, [search]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowTopButton(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f3f4f6" }}>
      <div style={{ background: "#111827", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ cursor: "pointer" }} onClick={() => router.push("/")}>BDS</h2>
        <div style={{ display: "flex", gap: 14 }}>
          <button style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }} onClick={() => router.push("/")}>Trang chủ</button>
          <button style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }} onClick={() => router.push("/post")}>Đăng tin</button>
        </div>
      </div>

      <div style={{ background: "linear-gradient(to right,#2563eb,#1d4ed8)", color: "#fff", padding: "60px 20px", textAlign: "center" }}>
        <h1>Tìm bất động sản nhanh chóng</h1>
        <p>Nhà đẹp - Giá tốt - Vị trí đẹp</p>
      </div>

      <div style={{ maxWidth: 900, margin: "-30px auto 20px", background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <input
          placeholder="VD: tìm nhà khu vực phú nhuận, làm spa, giá 50tr đổ lại, dt 80m2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 18, borderRadius: 14, border: "1px solid #ddd", fontSize: 16, outline: "none" }}
        />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        <h2>
          {search.trim()
            ? `Kết quả phù hợp (${listings.length})`
            : `Bất động sản nổi bật (${listings.length})`}
        </h2>

        {parsedFilters && (
          <div style={{ background: "#fff", borderRadius: 10, padding: 14, marginTop: 12, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Bộ lọc đã phân tích</h3>
            <p>Quận: {parsedFilters.preferred_districts.join(", ") || "Không có"}</p>
            <p>
              Giá tối đa:{" "}
              {parsedFilters.max_price
                ? parsedFilters.max_price.toLocaleString("vi-VN")
                : "Không có"}
            </p>
            <p>Diện tích tối thiểu: {parsedFilters.min_area || "Không có"}</p>
            <p>Nhu cầu: {parsedFilters.note || "Không có"}</p>
          </div>
        )}

        {loading ? (
          <p>Đang tải...</p>
        ) : listings.length === 0 ? (
          <p>Không tìm thấy dữ liệu</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            {listings.map((item) => {
              const listing = item.listing || item;

              return (
                <div key={listing.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, background: "#fff", borderRadius: 14, overflow: "hidden", padding: 14, alignItems: "flex-start" }}>
                  <img
                    src={listing.images?.[0] || "https://placehold.co/600x400"}
                    style={{ width: isMobile ? "100%" : 260, height: isMobile ? 200 : 180, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>{listing.title}</h3>
                    <p style={{ color: "#dc2626", fontWeight: "bold", fontSize: 22 }}>
                      {Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ
                    </p>
                    <p>Vị trí: {listing.district}</p>
                    {search.trim() && <p>Score: {item.score}</p>}
                    <div style={{ display: "flex", gap: 15, flexWrap: "wrap", marginTop: 8, marginBottom: 8 }}>
                      <span>{listing.bedrooms || 0} PN</span>
                      <span>{listing.bathrooms || 0} WC</span>
                      <span>{listing.area || 0}m²</span>
                      <span>{listing.floors || 0} tầng</span>
                    </div>
                    <p style={{ color: "#555", lineHeight: 1.5, marginTop: 10, wordBreak: "break-word", fontSize: isMobile ? 14 : 16 }}>
                      {listing.description}
                    </p>
                    <p style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
                      {new Date(listing.updated_at || listing.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", width: "100%", marginTop: isMobile ? 10 : 0 }}>
                    <button style={{ background: "#111827", color: "#fff", border: "none", padding: "12px 18px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }} onClick={() => router.push(`/listing/${listing.id}`)}>
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showTopButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: 55,
            height: 55,
            borderRadius: "50%",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 9999
          }}
        >
          ↑
        </button>
      )}
    </div>
  );
}
