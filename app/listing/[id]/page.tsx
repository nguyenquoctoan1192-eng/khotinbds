"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useSearchParams } from "next/navigation";
import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ListingDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { role } = useUserRole();
  const canSeeRawListing = role === "admin" || role === "agent";
  const canManageListing = role === "admin";

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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
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
        setSelectedImageIndex(0);
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

  const getListingUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  };

  const buildShareText = () => {
    const imageCount = Array.isArray(listing.images) ? listing.images.length : 0;
    const publicListing = formatPublicListing(listing);
    const parts = [
      publicListing.publicTitle,
      "",
      publicListing.area ? `📐 Diện tích: ${publicListing.area}` : "",
      publicListing.structure ? `🏠 Kết cấu: ${publicListing.structure}` : "",
      `💰 Giá: ${publicListing.price}`,
      `📞 ${publicListing.contactPhone}`,
      `🖼️ ${imageCount} ảnh`,
      `🔗 ${getListingUrl()}`,
    ].filter(Boolean);

    return parts.join("\n");
  };

  const shareListing = async () => {
    await navigator.clipboard.writeText(buildShareText());
    setShareMessage(
      "Đã copy nội dung tin đăng. Bạn có thể dán vào Zalo, Facebook hoặc tin nhắn."
    );
  };

  const buildImageFileName = (index: number) => {
    const safeTitle =
      (listing.title || "listing")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "listing";

    return `${safeTitle}-${index + 1}.jpg`;
  };

  const downloadImageUrl = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("Cannot download image");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    }
  };

  const downloadListingImages = async () => {
    const listingImages = Array.isArray(listing.images) ? listing.images : [];

    if (listingImages.length === 0) {
      setShareMessage("Tin này chưa có ảnh để tải.");
      return;
    }

    for (const [index, imageUrl] of listingImages.entries()) {
      await downloadImageUrl(imageUrl, buildImageFileName(index));
    }

    setShareMessage("Đã tải ảnh. Bạn có thể gửi kèm qua Zalo/Facebook.");
  };

  const images = Array.isArray(listing?.images) ? listing.images : [];
  const imageCount = images.length;
  const currentImage = images[selectedImageIndex] || mainImage || "";

  const selectImage = (index: number) => {
    if (imageCount === 0) return;
    const nextIndex = Math.max(0, Math.min(index, imageCount - 1));
    setSelectedImageIndex(nextIndex);
    setMainImage(images[nextIndex] || "");
  };

  const showPreviousImage = () => {
    if (imageCount === 0) return;
    selectImage((selectedImageIndex - 1 + imageCount) % imageCount);
  };

  const showNextImage = () => {
    if (imageCount === 0) return;
    selectImage((selectedImageIndex + 1) % imageCount);
  };

  if (!listing) {
    return <div style={{ padding: 20 }}>Đang tải...</div>;
  }

  const publicListing = formatPublicListing(listing);
  const displayTitle = canSeeRawListing ? listing.title : publicListing.publicTitle;
  const displayAddress = canSeeRawListing ? listing.address : publicListing.publicTitle;

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
              {imageCount > 1 && (
                <button
                  type="button"
                  onClick={showPreviousImage}
                  style={{ ...styles.galleryArrow, ...styles.galleryArrowLeft }}
                  aria-label="Ảnh trước"
                >
                  ‹
                </button>
              )}
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={displayTitle || "Bất động sản"}
                  style={{
                    ...styles.mainImage,
                    opacity: listing.status === "rented" ? 0.6 : 1,
                  }}
                  onClick={() => setShowImageModal(true)}
                />
              ) : (
                <div style={styles.imagePlaceholder}>BDS</div>
              )}
              {listing.status === "rented" && <RentedStamp />}
              {imageCount > 1 && (
                <button
                  type="button"
                  onClick={showNextImage}
                  style={{ ...styles.galleryArrow, ...styles.galleryArrowRight }}
                  aria-label="Ảnh sau"
                >
                  ›
                </button>
              )}
              {imageCount > 0 && (
                <div style={styles.imageCounter}>
                  {selectedImageIndex + 1} / {imageCount}
                </div>
              )}
            </div>

            <div style={styles.thumbRow}>
              {images.map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  onClick={() => selectImage(i)}
                  style={{
                    ...styles.thumb,
                    ...(i === selectedImageIndex ? styles.thumbActive : {}),
                  }}
                />
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <h1 style={styles.title}>{displayTitle}</h1>

            <div style={styles.priceRow}>
              <div style={styles.price}>
                Giá: {canSeeRawListing
                  ? `${Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ`
                  : publicListing.price}
              </div>
              <div style={styles.date}>
                {listing.updated_at
                  ? new Date(listing.updated_at).toLocaleDateString("vi-VN")
                  : ""}
              </div>
            </div>

            <div style={styles.address}>📍 {displayAddress}</div>
            {canSeeRawListing ? (
              <div style={styles.desc}>{listing.description}</div>
            ) : (
              <div style={styles.desc}>
                <div>Diện tích: {publicListing.area || "Đang cập nhật"}</div>
                <div>Kết cấu: {publicListing.structure || "Đang cập nhật"}</div>
              </div>
            )}
          </div>

          <div style={styles.card}>
            <h3>📍 Bản đồ</h3>
            <iframe
              style={styles.map}
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                displayAddress || ""
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
              ? `📞 ${canSeeRawListing
                ? listing.contact_phone || "Chưa có số"
                : publicListing.contactPhone}`
              : "📞 Liên hệ"}
          </button>

          {canManageListing && (
            <>
              <button style={styles.btnOrange} onClick={refreshPost}>
                🔁 Làm mới
              </button>

              <button
                style={styles.btnGreen}
                onClick={() => window.location.assign(`/edit/${listing.id}`)}
              >
                ✏️ Sửa tin
              </button>
            </>
          )}

          <button style={styles.btnShare} onClick={shareListing}>
            Chia sẻ
          </button>

          <button style={styles.btnDownloadImages} onClick={downloadListingImages}>
            Tải ảnh
          </button>

          {shareMessage && (
            <div style={styles.shareMessage}>
              {shareMessage}
            </div>
          )}

          {canManageListing && (
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
          )}
        </div>

      </div>
      {showImageModal && currentImage && (
        <div style={styles.imageModal} onClick={() => setShowImageModal(false)}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowImageModal(false);
            }}
            style={styles.modalClose}
            aria-label="Đóng ảnh"
          >
            ×
          </button>

          {imageCount > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              style={{ ...styles.modalArrow, ...styles.modalArrowLeft }}
              aria-label="Ảnh trước"
            >
              ‹
            </button>
          )}

          <img
            src={currentImage}
            style={styles.modalImage}
            onClick={(event) => event.stopPropagation()}
          />

          {imageCount > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              style={{ ...styles.modalArrow, ...styles.modalArrowRight }}
              aria-label="Ảnh sau"
            >
              ›
            </button>
          )}

          <div style={styles.modalCounter}>
            {selectedImageIndex + 1} / {imageCount}
          </div>
        </div>
      )}
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
    position: "relative",
  },

  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    cursor: "zoom-in",
  },

  imagePlaceholder: {
    color: "#9ca3af",
    fontWeight: "bold",
    fontSize: 28,
  },

  imageCounter: {
    position: "absolute",
    right: 12,
    bottom: 12,
    background: "rgba(17,24,39,0.78)",
    color: "white",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },

  galleryArrow: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 38,
    height: 48,
    border: "none",
    borderRadius: 8,
    background: "rgba(17,24,39,0.68)",
    color: "white",
    fontSize: 34,
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 2,
  },

  galleryArrowLeft: {
    left: 10,
  },

  galleryArrowRight: {
    right: 10,
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
    border: "2px solid transparent",
    flex: "0 0 auto",
  },

  thumbActive: {
    border: "2px solid #2563eb",
  },

  imageModal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.92)",
    zIndex: 20000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  modalImage: {
    maxWidth: "100%",
    maxHeight: "88vh",
    objectFit: "contain",
  },

  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.18)",
    color: "white",
    fontSize: 30,
    cursor: "pointer",
    zIndex: 3,
  },

  modalArrow: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 48,
    height: 62,
    border: "none",
    borderRadius: 10,
    background: "rgba(255,255,255,0.16)",
    color: "white",
    fontSize: 42,
    cursor: "pointer",
    zIndex: 3,
  },

  modalArrowLeft: {
    left: 16,
  },

  modalArrowRight: {
    right: 16,
  },

  modalCounter: {
    position: "absolute",
    bottom: 18,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(255,255,255,0.18)",
    color: "white",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
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

  btnDownloadImages: {
    padding: 14,
    background: "#0f766e",
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
