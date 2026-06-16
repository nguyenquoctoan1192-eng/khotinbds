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
  const [shareMessage, setShareMessage] = useState("");

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

  const formatSharePrice = () =>
    `${Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ`;

  const getListingUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  };

  const buildShareText = () => {
    const parts = [
      listing.title,
      `Giá: ${formatSharePrice()}`,
      listing.area ? `Diện tích: ${listing.area}m²` : "",
      listing.district ? `Khu vực: ${listing.district}` : "",
      listing.description ? `Mô tả: ${listing.description}` : "",
      getListingUrl(),
    ].filter(Boolean);

    return parts.join("\n");
  };

  const copyShareContent = async () => {
    await navigator.clipboard.writeText(buildShareText());
    setShareMessage(
      "Đã copy nội dung tin đăng. Có thể dán trực tiếp vào Zalo hoặc Facebook."
    );
  };

  const copyListingUrl = async (message = "Đã copy link") => {
    await navigator.clipboard.writeText(getListingUrl());
    setShareMessage(message);
  };

  const shareListing = async () => {
    const url = getListingUrl();
    const text = buildShareText();

    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title || "Bất động sản",
          text,
          url,
        });
        setShareMessage("Đã mở chia sẻ");
        return;
      }

      await copyListingUrl();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      await copyListingUrl();
    }
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(getListingUrl());
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareZalo = async () => {
    const url = encodeURIComponent(getListingUrl());
    const popup = window.open(
      `https://zalo.me/share?u=${url}`,
      "_blank",
      "noopener,noreferrer"
    );

    if (!popup) {
      await copyListingUrl("Đã copy link, bạn có thể dán vào Zalo.");
      return;
    }

    setShareMessage("Nếu Zalo không mở được, hãy copy link để gửi thủ công.");
  };

  const loadImageForCanvas = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
  ) => {
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let currentY = y;
    let lines = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const isTooWide = ctx.measureText(testLine).width > maxWidth;

      if (isTooWide && line) {
        lines += 1;
        const suffix = lines === maxLines ? "..." : "";
        ctx.fillText(lines === maxLines ? `${line}${suffix}` : line, x, currentY);
        if (lines === maxLines) return currentY;
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line && lines < maxLines) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }

    return currentY;
  };

  const exportShareImage = async () => {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1350;
    const padding = 56;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, 92);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px Arial";
    ctx.fillText("BDS", padding, 58);
    ctx.font = "400 22px Arial";
    ctx.fillText("Tin bất động sản", padding + 82, 58);

    const imageX = padding;
    const imageY = 124;
    const imageW = width - padding * 2;
    const imageH = 610;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(imageX, imageY, imageW, imageH);

    try {
      const coverImage = await loadImageForCanvas(mainImage || listing.images?.[0] || "");
      const ratio = Math.min(imageW / coverImage.width, imageH / coverImage.height);
      const drawW = coverImage.width * ratio;
      const drawH = coverImage.height * ratio;
      const drawX = imageX + (imageW - drawW) / 2;
      const drawY = imageY + (imageH - drawH) / 2;
      ctx.drawImage(coverImage, drawX, drawY, drawW, drawH);
    } catch {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "500 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("BDS", width / 2, imageY + imageH / 2);
      ctx.textAlign = "left";
    }

    let y = imageY + imageH + 56;
    ctx.fillStyle = "#111827";
    ctx.font = "700 42px Arial";
    y = drawWrappedText(ctx, listing.title || "Bất động sản", padding, y, width - padding * 2, 52, 3) + 16;

    ctx.fillStyle = "#dc2626";
    ctx.font = "700 44px Arial";
    ctx.fillText(formatSharePrice(), padding, y);
    y += 58;

    ctx.fillStyle = "#374151";
    ctx.font = "500 30px Arial";
    const detailParts = [
      listing.area ? `${listing.area}m²` : "",
      listing.district || "",
      listing.contact_phone ? `SĐT: ${listing.contact_phone}` : "",
    ].filter(Boolean);
    y = drawWrappedText(ctx, detailParts.join(" • "), padding, y, width - padding * 2, 40, 2) + 18;

    if (listing.description) {
      ctx.fillStyle = "#4b5563";
      ctx.font = "400 27px Arial";
      y = drawWrappedText(ctx, listing.description, padding, y, width - padding * 2, 38, 4) + 18;
    }

    ctx.fillStyle = "#6b7280";
    ctx.font = "400 24px Arial";
    drawWrappedText(ctx, getListingUrl(), padding, height - 96, width - padding * 2, 32, 2);

    const link = document.createElement("a");
    link.download = `bds-${listing.id || "listing"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setShareMessage("Đã xuất ảnh chia sẻ.");
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
            <div style={styles.mainImageFrame}>
              <img src={mainImage} style={styles.mainImage} />
            </div>

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

          <button style={styles.btnShare} onClick={shareListing}>
            Chia sẻ
          </button>

          <button style={styles.btnShareContent} onClick={copyShareContent}>
            Copy nội dung tin đăng
          </button>

          <button style={styles.btnExportImage} onClick={exportShareImage}>
            Xuất ảnh chia sẻ
          </button>

          <div style={styles.shareRow}>
            <button style={styles.btnZalo} onClick={shareZalo}>
              Zalo
            </button>
            <button style={styles.btnFacebook} onClick={shareFacebook}>
              Facebook
            </button>
          </div>

          {shareMessage && (
            <div style={styles.shareMessage}>
              {shareMessage}
            </div>
          )}

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

  mainImageFrame: {
    width: "100%",
    height: 320,
    background: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    overflow: "hidden",
  },

  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
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

  btnShare: {
    padding: 14,
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  btnShareContent: {
    padding: 14,
    background: "#0f766e",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  btnExportImage: {
    padding: 14,
    background: "#7c3aed",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  shareRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  btnZalo: {
    padding: 12,
    background: "#0068ff",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  btnFacebook: {
    padding: 12,
    background: "#1877f2",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  shareMessage: {
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    lineHeight: 1.4,
  },

  btnRed: {
    padding: 14,
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: 10,
  },
};
