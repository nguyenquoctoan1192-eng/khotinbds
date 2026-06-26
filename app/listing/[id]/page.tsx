"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useSearchParams } from "next/navigation";
import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type ViewMode = "public" | "agent" | "admin";

const normalizeViewMode = (value: string | null): ViewMode => {
  if (value === "admin" || value === "agent") return value;
  return "public";
};

export default function ListingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { role } = useUserRole();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const viewMode = normalizeViewMode(searchParams.get("view"));

  const isAdminView = viewMode === "admin" && role === "admin";
  const isAgentView = viewMode === "agent" && role === "agent";
  const canSeeRawListing = isAdminView || isAgentView;
  const canManageListing = isAdminView;

  const homeHref =
    viewMode === "admin" ? "/admin" : viewMode === "agent" ? "/agent" : "/";

  const fromSearch = searchParams.get("fromSearch")?.trim() || "";
  const returnUrl = searchParams.get("returnUrl") || "";
  const safeReturnUrl = returnUrl.startsWith("/") ? returnUrl : "";
  const searchReturnUrl = fromSearch
    ? `${homeHref}?q=${encodeURIComponent(fromSearch)}`
    : safeReturnUrl;

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchListing = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setListing(data);
        setMainImage(Array.isArray(data.images) ? data.images[0] || "" : "");
        setSelectedImageIndex(0);
      }

      setLoading(false);
    };

    fetchListing();
  }, [id]);

  const images = Array.isArray(listing?.images) ? listing.images : [];
  const imageCount = images.length;
  const currentImage = images[selectedImageIndex] || mainImage || "";

  const publicListing = useMemo(() => {
    if (!listing) return null;
    return formatPublicListing(listing);
  }, [listing]);

  const displayTitle = canSeeRawListing
    ? listing?.title || listing?.address || "Tin chưa có tiêu đề"
    : publicListing?.publicTitle || "Tin cho thuê";

  const displayAddress = canSeeRawListing
    ? listing?.address || listing?.location || "Chưa có địa chỉ"
    : publicListing?.publicTitle || "";

  const selectImage = (index: number) => {
    if (!imageCount) return;
    const nextIndex = Math.max(0, Math.min(index, imageCount - 1));
    setSelectedImageIndex(nextIndex);
    setMainImage(images[nextIndex] || "");
  };

  const showPreviousImage = () => {
    if (!imageCount) return;
    selectImage((selectedImageIndex - 1 + imageCount) % imageCount);
  };

  const showNextImage = () => {
    if (!imageCount) return;
    selectImage((selectedImageIndex + 1) % imageCount);
  };

  const refreshPost = async () => {
    if (!listing || !canManageListing) return;

    await supabase
      .from("listings")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", listing.id);

    location.reload();
  };

  const deletePost = async () => {
    if (!listing || !canManageListing) return;

    const ok = window.confirm("Bạn chắc chắn muốn xóa tin này?");
    if (!ok) return;

    const { error } = await supabase.from("listings").delete().eq("id", listing.id);

    if (error) {
      alert(`Không xóa được tin: ${error.message}`);
      return;
    }

    location.href = homeHref;
  };

  const getListingUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  };

  const buildShareText = () => {
    if (!listing || !publicListing) return "";

    const parts = [
      publicListing.publicTitle,
      "",
      publicListing.area ? `Diện tích: ${publicListing.area}` : "",
      publicListing.structure ? `Kết cấu: ${publicListing.structure}` : "",
      publicListing.price ? `Giá: ${publicListing.price}` : "",
      `Liên hệ: ${publicListing.contactPhone}`,
      imageCount ? `${imageCount} ảnh` : "",
      getListingUrl(),
    ].filter(Boolean);

    return parts.join("\n");
  };

  const shareListing = async () => {
    await navigator.clipboard.writeText(buildShareText());
    setShareMessage("Đã copy nội dung tin đăng.");
  };

  if (loading) {
    return <div style={styles.loading}>Đang tải tin...</div>;
  }

  if (!listing || !publicListing) {
    return <div style={styles.loading}>Không tìm thấy tin đăng.</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <a href={homeHref} style={styles.brand}>
          BDS
        </a>

        <nav style={styles.navLinks}>
          {searchReturnUrl && (
            <a href={searchReturnUrl} style={styles.backBtn}>
              Quay lại kết quả tìm kiếm
            </a>
          )}

          <a href={homeHref} style={styles.backBtn}>
            Trang chủ
          </a>
        </nav>
      </header>

      <main style={styles.main}>
        <section style={styles.gallerySection}>
          <div style={styles.mainImageWrap}>
            {currentImage ? (
              <img
                src={currentImage}
                alt={displayTitle}
                style={styles.mainImage}
                onClick={() => setShowImageModal(true)}
              />
            ) : (
              <div style={styles.noImage}>Chưa có ảnh</div>
            )}

            {listing.status === "rented" && <RentedStamp />}
          </div>

          {imageCount > 1 && (
            <div style={styles.thumbnailGrid}>
              {images.map((imageUrl: string, index: number) => (
                <button
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => selectImage(index)}
                  style={{
                    ...styles.thumbnailButton,
                    borderColor:
                      index === selectedImageIndex ? "#2563eb" : "#e5e7eb",
                  }}
                >
                  <img src={imageUrl} alt="" style={styles.thumbnailImage} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={styles.infoCard}>
          <h1 style={styles.title}>{displayTitle}</h1>

          <div style={styles.infoGrid}>
            <InfoItem
              label="Địa chỉ"
              value={displayAddress || "Thông tin liên hệ môi giới"}
            />

            <InfoItem
              label="Giá"
              value={
                canSeeRawListing
                  ? listing.price || publicListing.price
                  : publicListing.price
              }
            />

            <InfoItem
              label="Diện tích"
              value={
                canSeeRawListing
                  ? listing.area || publicListing.area
                  : publicListing.area
              }
            />

            <InfoItem
              label="Kết cấu"
              value={
                canSeeRawListing
                  ? listing.structure || publicListing.structure
                  : publicListing.structure
              }
            />

            {canSeeRawListing && (
              <>
                <InfoItem
                  label="Số điện thoại"
                  value={listing.phone || listing.contact_phone || "Chưa có"}
                />

                <InfoItem
                  label="Hoa hồng"
                  value={listing.commission || listing.hh || "Chưa có"}
                />

                <InfoItem
                  label="Trạng thái"
                  value={listing.status === "rented" ? "Đã cho thuê" : "Còn trống"}
                />
              </>
            )}
          </div>

          <div style={styles.descriptionBox}>
            <h2 style={styles.sectionTitle}>Mô tả</h2>

            <p style={styles.descriptionText}>
              {canSeeRawListing
                ? listing.description || listing.raw_content || "Chưa có mô tả."
                : [
                    publicListing.area ? `Diện tích: ${publicListing.area}` : "",
                    publicListing.structure
                      ? `Kết cấu: ${publicListing.structure}`
                      : "",
                    publicListing.price ? `Giá: ${publicListing.price}` : "",
                  ]
                    .filter(Boolean)
                    .join(" - ") || "Liên hệ để được tư vấn thêm."}
            </p>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={shareListing} style={styles.primaryButton}>
              Copy nội dung chia sẻ
            </button>

            {canManageListing && (
              <>
                <a href={`/edit/${listing.id}`} style={styles.secondaryButton}>
                  Sửa tin
                </a>

                <button
                  type="button"
                  onClick={refreshPost}
                  style={styles.secondaryButton}
                >
                  Làm mới tin
                </button>

                <button type="button" onClick={deletePost} style={styles.dangerButton}>
                  Xóa tin
                </button>
              </>
            )}
          </div>

          {shareMessage && <p style={styles.message}>{shareMessage}</p>}
        </section>
      </main>

      {showImageModal && currentImage && (
        <div style={styles.modal} onClick={() => setShowImageModal(false)}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPreviousImage();
            }}
            style={styles.modalArrowLeft}
          >
            ‹
          </button>

          <img src={currentImage} alt={displayTitle} style={styles.modalImage} />

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNextImage();
            }}
            style={styles.modalArrowRight}
          >
            ›
          </button>

          <button
            type="button"
            onClick={() => setShowImageModal(false)}
            style={styles.modalClose}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{String(value || "Chưa có")}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    color: "#111827",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  header: {
    background: "#111827",
    color: "#fff",
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brand: {
    color: "#fff",
    textDecoration: "none",
    fontSize: 24,
    fontWeight: 700,
  },
  navLinks: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  backBtn: {
    color: "#fff",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 700,
  },
  main: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
    gap: 20,
  },
  gallerySection: {
    minWidth: 0,
  },
  mainImageWrap: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    background: "#e5e7eb",
    minHeight: 360,
  },
  mainImage: {
    width: "100%",
    height: 460,
    objectFit: "cover",
    cursor: "zoom-in",
  },
  noImage: {
    height: 360,
    display: "grid",
    placeItems: "center",
    color: "#6b7280",
  },
  thumbnailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  thumbnailButton: {
    border: "2px solid #e5e7eb",
    borderRadius: 10,
    padding: 0,
    overflow: "hidden",
    cursor: "pointer",
    background: "#fff",
  },
  thumbnailImage: {
    width: "100%",
    height: 72,
    objectFit: "cover",
  },
  infoCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
    alignSelf: "start",
  },
  title: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 28,
    lineHeight: 1.25,
  },
  infoGrid: {
    display: "grid",
    gap: 10,
  },
  infoItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    display: "grid",
    gap: 4,
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  infoValue: {
    color: "#111827",
    fontSize: 15,
  },
  descriptionBox: {
    marginTop: 18,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: 20,
  },
  descriptionText: {
    whiteSpace: "pre-wrap",
    color: "#374151",
    lineHeight: 1.55,
  },
  actions: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: 0,
    borderRadius: 9,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    padding: "11px 14px",
    textDecoration: "none",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
    padding: "11px 14px",
    textDecoration: "none",
  },
  dangerButton: {
    border: 0,
    borderRadius: 9,
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    padding: "11px 14px",
  },
  message: {
    color: "#166534",
    fontWeight: 700,
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.86)",
    zIndex: 99999,
    display: "grid",
    placeItems: "center",
    padding: 20,
  },
  modalImage: {
    maxWidth: "92vw",
    maxHeight: "86vh",
    objectFit: "contain",
  },
  modalClose: {
    position: "fixed",
    top: 18,
    right: 18,
    border: 0,
    borderRadius: 9,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  modalArrowLeft: {
    position: "fixed",
    left: 20,
    top: "50%",
    transform: "translateY(-50%)",
    border: 0,
    borderRadius: 999,
    width: 48,
    height: 48,
    cursor: "pointer",
    fontSize: 34,
  },
  modalArrowRight: {
    position: "fixed",
    right: 20,
    top: "50%",
    transform: "translateY(-50%)",
    border: 0,
    borderRadius: 999,
    width: 48,
    height: 48,
    cursor: "pointer",
    fontSize: 34,
  },
  loading: {
    padding: 24,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};