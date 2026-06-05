"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function Home() {
  const router = useRouter();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

   const [showTopButton, setShowTopButton] =
    useState(false);

  // NORMALIZE
  const normalize = (text: string) => {
    return text
      ?.toLowerCase()
      ?.normalize("NFD")
      ?.replace(/[\u0300-\u036f]/g, "")
      ?.trim();
  };

  // FETCH
  const fetchListings = async () => {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("listings")
        .select("*")
        .order("updated_at", {
  ascending: false,
});

    if (error) {
      console.error(error);
      setListings([]);
      setLoading(false);
      return;
    }

    let filtered = data || [];

    if (search.trim()) {
  const keyword = normalize(search);

  const districtMatch =
    keyword.match(/quan\s?(\d+)/);

  const districtNumber =
    districtMatch?.[1];

  const bedroomMatch =
    keyword.match(/(\d+)\s?pn/);

  const bedrooms =
    bedroomMatch?.[1];

  const bathroomMatch =
    keyword.match(
      /(\d+)\s?(wc|toilet)/
    );

  const bathrooms =
    bathroomMatch?.[1];

  const priceMatch =
    keyword.match(/(\d+)\s?tr/);

  const targetPrice =
    priceMatch?.[1]
      ? Number(priceMatch[1]) *
        1000000
      : null;

  filtered = filtered.filter(
    (item) => {
      const district =
        normalize(
          item.district || ""
        );

      const title =
        normalize(
          item.title || ""
        );

      const description =
        normalize(
          item.description || ""
        );

      // QUẬN
      if (districtNumber) {
        const itemDistrictNumber =
          district.match(
            /(\d+)/
          )?.[1];

        if (
          itemDistrictNumber !==
          districtNumber
        ) {
          return false;
        }
      }

      // PHÒNG NGỦ
      if (
        bedrooms &&
        Number(item.bedrooms) !==
          Number(bedrooms)
      ) {
        return false;
      }

      // WC
      if (
        bathrooms &&
        Number(item.bathrooms) !==
          Number(bathrooms)
      ) {
        return false;
      }

      // GIÁ
      if (
        targetPrice &&
        Math.abs(
          Number(item.price) -
            targetPrice
        ) > 5000000
      ) {
        return false;
      }

      // Nếu đã có bộ lọc quận/pn/wc/giá
      // thì cho qua
      if (
        districtNumber ||
        bedrooms ||
        bathrooms ||
        targetPrice
      ) {
        return true;
      }

      // tìm text bình thường
      return (
        title.includes(keyword) ||
        district.includes(
          keyword
        ) ||
        description.includes(
          keyword
        )
      );
    }
  );
}

    setListings(filtered);
    setLoading(false);
  };

 useEffect(() => {
  fetchListings();
}, [search]);

useEffect(() => {
  const handleScroll = () => {
    setShowTopButton(window.scrollY > 400);
  };

  window.addEventListener(
    "scroll",
    handleScroll
  );

  return () => {
    window.removeEventListener(
      "scroll",
      handleScroll
    );
  };
}, []);

return (
    <div style={styles.page}>
      {/* NAV */}
      <div style={styles.nav}>
        <h2
          style={{ cursor: "pointer" }}
          onClick={() => router.push("/")}
        >
          🏠 BDS
        </h2>

        <div style={styles.navRight}>
          <button
            style={styles.navBtn}
            onClick={() => router.push("/")}
          >
            Trang chủ
          </button>

          <button
            style={styles.navBtn}
            onClick={() =>
              router.push("/post")
            }
          >
            Đăng tin
          </button>
        </div>
      </div>

      {/* HERO */}
      <div style={styles.hero}>
        <h1>
          Tìm bất động sản nhanh chóng
        </h1>

        <p>
          Nhà đẹp • Giá tốt • Vị trí đẹp
        </p>
      </div>

      {/* SEARCH */}
      <div style={styles.searchBox}>
        <input
          placeholder="🔍 VD: quận 10 4pn 32tr"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={styles.searchInput}
        />
      </div>

      {/* CONTENT */}
      <div style={styles.container}>
        <h2>
          Bất động sản nổi bật (
          {listings.length})
        </h2>

        {loading ? (
          <p>Đang tải...</p>
        ) : listings.length === 0 ? (
          <p>
            Không tìm thấy dữ liệu
          </p>
        ) : (
          <div style={styles.list}>
            {listings.map((item) => (
              <div
                key={item.id}
                style={styles.card}
              >
                <img
                  src={
                    item.images &&
                    item.images.length > 0
                      ? item.images[0]
                      : "https://placehold.co/600x400"
                  }
                  style={styles.image}
                />

                <div style={styles.info}>
                  <h3 style={styles.title}>
                  {item.title}
                  </h3>

                  <p style={styles.price}>
                    {Number(
                      item.price || 0
                    ).toLocaleString(
                      "vi-VN"
                    )}{" "}
                    VNĐ
                  </p>

                  <p>
                    📍 {item.district}
                  </p>
                 

                  <div
  style={{
    display: "flex",
    gap: 15,
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 8,
  }}
>
  <span>
    🛏 {item.bedrooms || 0} PN
  </span>

  <span>
    🚿 {item.bathrooms || 0} WC
  </span>

  <span>
    📐 {item.area || 0}m²
  </span>

  <span>
    🏢 {item.floors || 0} tầng
  </span>
</div>

                  <p style={styles.desc}>
                    {item.description}
                  </p>

                  <p style={styles.postDate}>
                    📅 {new Date(
                      item.updated_at || item.created_at
                    ).toLocaleDateString("vi-VN")}
                  </p>

                </div>

                <div style={styles.action}>
                  <button
                    onClick={() =>
                      router.push(
                        `/listing/${item.id}`
                      )
                    }
                    style={
                      styles.detailBtn
                    }
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
                )}
      </div>

      {showTopButton && (
        <button
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
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
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 9999,
          }}
        >
          ↑
        </button>
      )}

    </div>
  );
}

const styles: any = {
  page: {
    fontFamily: "Arial",
    background: "#f3f4f6",
    minHeight: "100vh",
  },

  nav: {
    background: "#111827",
    color: "white",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  navRight: {
    display: "flex",
    gap: 14,
  },

  navBtn: {
    background: "transparent",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
  },

  hero: {
    background:
      "linear-gradient(to right,#2563eb,#1d4ed8)",
    color: "white",
    padding: "60px 20px",
    textAlign: "center",
  },

  searchBox: {
    maxWidth: 900,
    margin: "-30px auto 20px",
    background: "white",
    padding: 20,
    borderRadius: 16,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.08)",
  },

  searchInput: {
    width: "100%",
    padding: 18,
    borderRadius: 14,
    border: "1px solid #ddd",
    fontSize: 16,
    outline: "none",
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 20,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 20,
  },

  card: {
    background: "white",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    gap: 16,
    padding: 14,
    alignItems: "center",
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.06)",
  },

  image: {
    width: 260,
    height: 320,
    objectFit: "cover",
    borderRadius: 10,
  },

  info: {
    flex: 1,
  },

  price: {
    color: "#dc2626",
    fontWeight: "bold",
    fontSize: 22,
  },

 desc: {
  color: "#555",
  lineHeight: 3.5,
  marginTop: 42,
},

postDate: {
  marginTop: 10,
  color: "#6b7280",
  fontSize: 13,
},

  action: {
    minWidth: 160,
    display: "flex",
    justifyContent: "center",
  },

  detailBtn: {
    background: "#111827",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },
  title: {
  fontSize: 24,
  fontWeight: "700",
  color: "#1f2937",
  marginBottom: 6,
},

topButton: {
  position: "fixed",
  right: 20,
  bottom: 20,

  width: 55,
  height: 55,

  borderRadius: "50%",
  border: "none",

  background: "#2563eb",
  color: "white",

  fontSize: 24,
  fontWeight: "bold",

  cursor: "pointer",

  boxShadow:
    "0 4px 12px rgba(0,0,0,0.25)",

  zIndex: 9999,
},

};