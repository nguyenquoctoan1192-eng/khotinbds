"use client";

import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { getPermissions } from "@/lib/permissions";
import type { Listing } from "@/types/listing";

export type ListingCardItem = {
  listing?: Listing;
  score?: number | string | null;
  breakdown?: unknown;
  reasons?: unknown;
  [key: string]: unknown;
};

type ListingCardProps = {
  item: ListingCardItem;
  isMobile: boolean;
  mode: "public" | "agent" | "admin";
  search: string;
  getListingFromResult: (item: ListingCardItem) => Listing;
  getReasonLabels: (item: ListingCardItem) => string[];
  onView: (listingId: string) => void;
  onEdit?: (listingId: string) => void;
  onDelete?: (listing: Listing) => void;
};

export default function ListingCard({
  item,
  isMobile,
  mode,
  search,
  getListingFromResult,
  getReasonLabels,
  onView,
  onEdit,
  onDelete,
}: ListingCardProps) {
  const listing = getListingFromResult(item);
  const publicListing = formatPublicListing(listing);
const permissions = getPermissions(mode);
const canSeeRawListing = permissions.canViewOwnerPhone;
const canManageListing = permissions.canEditListing;
const canDeleteListing = permissions.canDeleteListing;

  return (
    <div key={listing.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, background: "#fff", borderRadius: 14, overflow: "hidden", padding: 14, alignItems: "flex-start", width: "100%", boxSizing: "border-box" }}>
      <div style={{ position: "relative", width: isMobile ? "100%" : 260, height: isMobile ? 200 : 180, flexShrink: 0 }}>
        <img
          src={listing.images?.[0] || "https://placehold.co/600x400"}
          loading="lazy"
          alt={canSeeRawListing ? listing.title || "Bất động sản" : publicListing.publicTitle}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, opacity: listing.status === "rented" ? 0.6 : 1 }}
        />
        {listing.status === "rented" && <RentedStamp />}
      </div>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
          {canSeeRawListing ? listing.title : publicListing.publicTitle}
        </h3>
        <p style={{ color: "#dc2626", fontWeight: "bold", fontSize: 22 }}>
          Giá: {canSeeRawListing
            ? `${Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ`
            : publicListing.price}
        </p>
        {canSeeRawListing ? (
          <p>Vị trí: {listing.district}</p>
        ) : (
          <>
            <p>Diện tích: {publicListing.area || "Đang cập nhật"}</p>
            <p>Kết cấu: {publicListing.structure || "Đang cập nhật"}</p>
          </>
        )}
        {search.trim() && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>
              Điểm phù hợp: {String(item.score ?? 0)}
            </p>
            {getReasonLabels(item).length > 0 && (
              <div>
                <p style={{ marginBottom: 4 }}>Reasons:</p>
                <ul style={{ marginTop: 0, paddingLeft: 20 }}>
                  {getReasonLabels(item).map((reason) => (
                    <li key={reason}>✓ {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {canSeeRawListing && (
          <>
            <div style={{ display: "flex", gap: 15, flexWrap: "wrap", marginTop: 8, marginBottom: 8 }}>
              <span>{listing.bedrooms || 0} PN</span>
              <span>{listing.bathrooms || 0} WC</span>
              <span>{listing.area || 0}m²</span>
              <span>{listing.floors || 0} tầng</span>
            </div>
            <p style={{ color: "#555", lineHeight: 1.5, marginTop: 10, wordBreak: "break-word", fontSize: isMobile ? 14 : 16 }}>
              {listing.description}
            </p>
          </>
        )}
        {canManageListing && (
          <div style={{ display: "grid", gap: 6, marginTop: 10, color: "#374151" }}>
            <div><b>SĐT:</b> {listing.contact_phone || listing.phone || "Chưa có"}</div>
            <div><b>Hoa hồng:</b> {listing.commission || listing.hh || "Chưa có"}</div>
            {listing.internal_note && <div><b>Ghi chú:</b> {listing.internal_note}</div>}
          </div>
        )}
        <p style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
          {listing.updated_at || listing.created_at
  ? new Date(String(listing.updated_at || listing.created_at)).toLocaleDateString("vi-VN")
  : ""}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 10, justifyContent: isMobile ? "flex-start" : "flex-end", width: isMobile ? "100%" : "auto", marginTop: isMobile ? 10 : 0, flexShrink: 0, flexWrap: "wrap" }}>
        <button style={{ background: "#111827", color: "#fff", border: "none", padding: "12px 18px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }} onClick={() => onView(listing.id)}>
          Xem chi tiết
        </button>
        {canManageListing && onEdit && (
          <button style={{ background: "#10b981", color: "#fff", border: "none", padding: "12px 18px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }} onClick={() => onEdit(listing.id)}>
            Sửa tin
          </button>
        )}
        {canDeleteListing && onDelete && (
          <button style={{ background: "#ef4444", color: "#fff", border: "none", padding: "12px 18px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }} onClick={() => onDelete(listing)}>
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}
