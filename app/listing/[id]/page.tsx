"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ListingDetail() {
  const params = useParams();

  const [showPhone, setShowPhone] = useState(false);
  const [listing, setListing] = useState<any>(null);
  const [mainImage, setMainImage] = useState("");

  useEffect(() => {
    const fetchListing = async () => {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("id", params.id)
        .single();

      if (data) {
        setListing(data);
        setMainImage(data.images?.[0] || "");
      }
    };

    fetchListing();
  }, [params.id]);

  const refreshPost = async () => {
    const { error } = await supabase
      .from("listings")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", listing.id);

    if (!error) {
      alert("Đã làm mới tin");
      location.reload();
    }
  };

  if (!listing) return <div style={{ padding: 40 }}>Đang tải...</div>;

  return (
    <div style={styles.page}>
      {/* NAV */}
      <div style={styles.nav}>
        <h2>🏠 BDS</h2>
        <a href="/" style={styles.backBtn}>← Trang chủ</a>
      </div>

      {/* WRAPPER */}
      <div style={styles.wrapper}>

        {/* LEFT BLOCK */}
        <div style={styles.mainBlock}>

          {/* IMAGE BLOCK */}
          <div style={styles.card}>
            <img src={mainImage} style={styles.mainImage} />

            <div style={styles.thumbRow}>
              {listing.images?.map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  onClick={() => setMainImage(img)}
                  style={{
                    ...styles.thumb,
                    border: mainImage === img ? "2px solid #2563eb" : "1px solid #ddd"
                  }}
                />
              ))}
            </div>
          </div>

          {/* INFO BLOCK */}
          <div style={styles.card}>
            <h1 style={styles.title}>{listing.title}</h1>

            <div style={styles.priceRow}>
              <h2 style={styles.price}>
                {Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ
              </h2>

             <span style={styles.date}>
            Ngày đăng:{" "}
            {listing.updated_at
            ? new Date(listing.updated_at).toLocaleDateString("vi-VN")
            : ""}
            </span>
            </div>

            <p style={styles.address}>📍 {listing.address}</p>

            <p style={styles.desc}>{listing.description}</p>
          </div>

          {/* MAP BLOCK (TÁCH RIÊNG 100%) */}
          <div style={styles.card}>
            <h3>📍 Vị trí bản đồ</h3>

            <iframe
              style={styles.map}
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                listing.address
              )}&output=embed`}
            />
          </div>

        </div>

        {/* RIGHT ACTION BLOCK */}
        <div style={styles.side}>

          <button
  style={styles.contactBtn}
  onClick={() => setShowPhone(true)}
>
  {showPhone
    ? `📞 ${listing.contact_phone || "Chưa có số"}`
    : "📞 Liên hệ"}
</button>



          <button onClick={refreshPost} style={styles.refreshBtn}>
            🔁 Làm mới tin
          </button>

          <button
            style={styles.editBtn}
            onClick={() => window.location.assign(`/edit/${listing.id}`)}
          >
            ✏️ Sửa tin
          </button>

          <button
            style={styles.deleteBtn}
            onClick={async () => {
              if (!confirm("Xóa tin?")) return;

              await supabase
                .from("listings")
                .delete()
                .eq("id", listing.id);

              location.href = "/";
            }}
          >
            🗑 Xóa tin
          </button>
        </div>

      </div>
    </div>
  );
}

const styles: any = {
  page: {
    background: "#f3f4f6",
    fontFamily: "Arial",
    minHeight: "100vh",
  },

  nav: {
    background: "#111827",
    color: "white",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
  },

  backBtn: {
    color: "white",
    border: "1px solid white",
    padding: "6px 12px",
    borderRadius: 8,
    textDecoration: "none",
  },

  wrapper: {
    maxWidth: 1100,
    margin: "30px auto",
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
  },

  mainBlock: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  card: {
    background: "white",
    borderRadius: 12,
    padding: 16,
  },

mainImage: {
  width: "100%",
  height: 420,
  objectFit: "contain", // ✔ quan trọng
  backgroundColor: "#000",
  borderRadius: 10,
},

  thumbRow: {
  display: "flex",
  gap: 8,
  marginTop: 10,
  overflowX: "auto",
  paddingBottom: 4,
},

  thumb: {
  width: 72,
  height: 72,
  objectFit: "cover",
  borderRadius: 6,
  cursor: "pointer",
  border: "1px solid #0f1113",
},

  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 10,
  },

  priceRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 6,
},

  price: {
    color: "#dc2626",
    fontSize: 24,
  },

  date: {
  fontSize: 13,
  color: "#6b7280",
  marginLeft: 12,
},

  address: {
    marginTop: 10,
    color: "#444",
  },

  desc: {
  marginTop: 30,      // ✔ tạo khoảng cách với phần trên
  lineHeight: 1.7,
  color: "#555",
  fontSize: 15,       // ✔ cho dễ đọc hơn
},

district: {
  marginTop: 6,   // tạo khoảng cách từ giá xuống
  fontSize: 14,
  color: "#555",
},

  map: {
    width: "100%",
    height: 260,
    border: 0,
    borderRadius: 10,
  },

  side: {
    width: 240,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  contactBtn: {
    padding: 14,
    background: "#2563eb",
    color: "white",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },

  refreshBtn: {
    padding: 14,
    background: "#f59e0b",
    color: "white",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },

  editBtn: {
    padding: 14,
    background: "#10b981",
    color: "white",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },

  deleteBtn: {
    padding: 14,
    background: "#ef4444",
    color: "white",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },

  
};