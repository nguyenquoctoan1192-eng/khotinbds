"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useSearchParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ListingDetail() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const fromSearch = searchParams.get("fromSearch")?.trim() || "";
  const returnUrl = searchParams.get("returnUrl") || "";
  const safeReturnUrl = returnUrl.startsWith("/") ? returnUrl : "";
  const searchReturnUrl = fromSearch
    ? `/?q=${encodeURIComponent(fromSearch)}`
    : safeReturnUrl;

  const [showPhone, setShowPhone] = useState(false);
  const [listing, setListing] = useState<any>(null);
  const [mainImage, setMainImage] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchListing = async () => {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setListing(data);
        setMainImage(data.images?.[0] || "");
      }
    };

    fetchListing();
  }, [id]);

  const refreshPost = async () => {
    if (!listing) return;

    await supabase
      .from("listings")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    location.reload();
  };

  if (!listing) {
    return <div style={{ padding: 20 }}>Đang tải...</div>;
  }

  return (
    <div style={styles.page}>
      {/* NAV */}
      <div style={styles.nav}>
        <h2 style={styles.logo}>🏠 BDS</h2>
        <div style={styles.navLinks}>
          {searchReturnUrl && (
            <a href={searchReturnUrl} style={styles.backBtn}>
              Quay lại kết quả tìm kiếm
            </a>
          )}
          <a href="/" style={styles.backBtn}>← Trang chủ</a>
        </div>
      </div>

      {/* WRAPPER */}
      <div style={styles.wrapper}>
        
        {/* LEFT */}
        <div style={styles.left}>
          <div style={styles.card}>
            <img src={mainImage} style={styles.mainImage} />

            <div style={styles.thumbRow}>
              {listing.images?.map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  onClick={() => setMainImage(img)}
                  style={styles.thumb}
                />
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <h1 style={styles.title}>{listing.title}</h1>

            <div style={styles.priceRow}>
              <div style={styles.price}>
                {Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ
              </div>
              <div style={styles.date}>
                {listing.updated_at
                  ? new Date(listing.updated_at).toLocaleDateString("vi-VN")
                  : ""}
              </div>
            </div>

            <div style={styles.address}>📍 {listing.address}</div>
            <div style={styles.desc}>{listing.description}</div>
          </div>

          <div style={styles.card}>
            <h3>📍 Bản đồ</h3>
            <iframe
              style={styles.map}
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                listing.address || ""
              )}&output=embed`}
            />
          </div>
        </div>

        {/* RIGHT (FIX MOBILE FULL WIDTH) */}
        <div style={styles.right}>
          <button
            style={styles.btnBlue}
            onClick={() => setShowPhone(true)}
          >
            {showPhone
              ? `📞 ${listing.contact_phone || "Chưa có số"}`
              : "📞 Liên hệ"}
          </button>

          <button style={styles.btnOrange} onClick={refreshPost}>
            🔁 Làm mới
          </button>

          <button
            style={styles.btnGreen}
            onClick={() => window.location.assign(`/edit/${listing.id}`)}
          >
            ✏️ Sửa tin
          </button>

          <button
            style={styles.btnRed}
            onClick={async () => {
              if (!confirm("Xóa tin?")) return;

              await supabase
                .from("listings")
                .delete()
                .eq("id", listing.id);

              location.href = "/";
            }}
          >
            🗑 Xóa
          </button>
        </div>

      </div>
    </div>
  );
}

/* ================= STYLE FIX MOBILE CHUẨN ================= */

const styles: any = {
  page: {
  minHeight: "100vh",
  width: "100%",
  overflowX: "hidden",
  background: "#f3f4f6",
  fontFamily: "Arial",
},

  nav: {
    background: "#111827",
    color: "white",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logo: {
    fontSize: 18,
    fontWeight: "bold",
  },

  navLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  backBtn: {
    color: "white",
    textDecoration: "none",
    border: "1px solid white",
    padding: "6px 10px",
    borderRadius: 8,
  },

  /* ✅ QUAN TRỌNG NHẤT */
  wrapper: {
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
},

  /* LEFT FULL RESPONSIVE */
  left: {
  flex: "1 1 600px",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
},

  /* RIGHT AUTO FULL MOBILE */
  right: {
  flex: "1 1 240px",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
},

  card: {
    background: "white",
    borderRadius: 12,
    padding: 12,
  },

  mainImage: {
    width: "100%",
    height: 320,
    objectFit: "cover",
    borderRadius: 10,
  },

  thumbRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    overflowX: "auto",
  },

  thumb: {
    width: 70,
    height: 70,
    objectFit: "cover",
    borderRadius: 8,
    cursor: "pointer",
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
  },

  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
  },

  price: {
    color: "#dc2626",
    fontSize: 18,
    fontWeight: "bold",
  },

  date: {
    fontSize: 12,
    color: "#666",
  },

  address: {
    marginTop: 8,
  },

  desc: {
    marginTop: 10,
    color: "#555",
    lineHeight: 1.6,
  },

  map: {
    width: "100%",
    height: 220,
    border: 0,
    borderRadius: 10,
  },

  btnBlue: {
    padding: 14,
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
  },

  btnOrange: {
    padding: 14,
    background: "#f59e0b",
    color: "white",
    border: "none",
    borderRadius: 10,
  },

  btnGreen: {
    padding: 14,
    background: "#10b981",
    color: "white",
    border: "none",
    borderRadius: 10,
  },

  btnRed: {
    padding: 14,
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 10,
  },
};
