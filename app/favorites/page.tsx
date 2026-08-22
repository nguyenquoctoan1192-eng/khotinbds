"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";

export default function FavoritesPage() {
  const router = useRouter();
  const { role } = useUserRole();
  const canSeeRawListing = role === "admin" || role === "agent";
  const [favorites, setFavorites] = useState<any[]>([]);

  // LOAD FROM LOCALSTORAGE
  useEffect(() => {
    const saved = localStorage.getItem("favorites");
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // REMOVE ITEM
  const removeFavorite = (id: any) => {
    const updated = favorites.filter((item) => item.id !== id);
    setFavorites(updated);
    localStorage.setItem("favorites", JSON.stringify(updated));
  };

  return (
    <div style={styles.page}>
      {/* NAV */}
      <div style={styles.nav}>
        <h2 onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
          🏠 BDS
        </h2>

        <button onClick={() => router.push("/")} style={styles.btn}>
          ← Quay lại
        </button>
      </div>

      {/* TITLE */}
      <div style={styles.header}>
        <h1>❤️ Tin đã lưu</h1>
        <p>Bạn đã lưu {favorites.length} bất động sản</p>
      </div>

      {/* LIST */}
      <div style={styles.container}>
        {favorites.length === 0 ? (
          <p>Chưa có tin yêu thích</p>
        ) : (
          <div style={styles.grid}>
            {favorites.map((item) => {
              const publicListing = formatPublicListing(item);

              return <div key={item.id} style={styles.card}>
                <div style={styles.imageFrame}>
                  <img
                    src={item.image || item.images?.[0] || "https://placehold.co/600x400"}
                    loading="lazy"
                    alt={canSeeRawListing ? item.title || "Bất động sản" : publicListing.publicTitle}
                    style={{
                      ...styles.image,
                      opacity: item.status === "rented" ? 0.6 : 1,
                    }}
                  />
                  {item.status === "rented" && <RentedStamp />}
                </div>

                <div style={styles.body}>
                  <h3>{canSeeRawListing ? item.title : publicListing.publicTitle}</h3>

                  <p style={styles.price}>
                    Giá: {canSeeRawListing
                      ? `${Number(item.price || 0).toLocaleString("vi-VN")} VNĐ`
                      : publicListing.price}
                  </p>

                  {canSeeRawListing ? (
                    <p>📍 {item.district}</p>
                  ) : (
                    <>
                      <p>Diện tích: {publicListing.area || "Đang cập nhật"}</p>
                      <p>Kết cấu: {publicListing.structure || "Đang cập nhật"}</p>
                    </>
                  )}

                  <div style={styles.actions}>
                    <button
                      onClick={() =>
                        router.push(`/listing/${item.id}?view=public`)
                      }
                      style={styles.viewBtn}
                    >
                      Xem
                    </button>

                    <button
                      onClick={() => removeFavorite(item.id)}
                      style={styles.removeBtn}
                    >
                      Xóa ❤️
                    </button>
                  </div>
                </div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* STYLE */
const styles: any = {
  page: {
    fontFamily: "var(--font-inter)",
    background: "#f3f4f6",
    minHeight: "100vh",
  },

  nav: {
    background: "#111827",
    color: "white",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  btn: {
    background: "transparent",
    border: "1px solid white",
    color: "white",
    padding: "6px 10px",
    cursor: "pointer",
    borderRadius: 6,
  },

  header: {
    textAlign: "center",
    padding: 30,
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 20,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
    gap: 20,
  },

  card: {
    background: "white",
    borderRadius: 12,
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: 200,
    objectFit: "cover",
  },

  imageFrame: {
    position: "relative",
    width: "100%",
    height: 200,
  },

  body: {
    padding: 15,
  },

  price: {
    color: "red",
    fontWeight: "bold",
  },

  actions: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },

  viewBtn: {
    flex: 1,
    padding: 10,
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  removeBtn: {
    flex: 1,
    padding: 10,
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
};

