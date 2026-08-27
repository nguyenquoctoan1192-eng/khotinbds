"use client";

import { useState } from "react";
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

type QueueState = "idle" | "loading" | "queued" | "processing" | "error";

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

const actionButton: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 9,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
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
  const [queueState, setQueueState] = useState<QueueState>("idle");
  const [queueMessage, setQueueMessage] = useState("");

  const isRented = listing.status === "rented";
  const showFacebookQueueButton = mode === "admin" && canManageListing;

  // getReasonLabels và search vẫn được giữ trong props (ListingsHome vẫn
  // truyền vào, dùng để soạn tin gửi khách ở nơi khác), chỉ không còn
  // hiển thị khối "Điểm phù hợp" trên card nữa.
  void getReasonLabels;
  void search;

    async function enqueueFacebook() {
    if (
      isRented ||
      queueState === "loading" ||
      queueState === "queued"
    ) {
      return;
    }

    setQueueState("loading");
    setQueueMessage("");

    try {
      /*
       * Gửi thẳng vào API enqueue chính.
       * Không đi qua /api/social/sync-today nữa vì frontend
       * trước đây đang đọc sai cấu trúc response của API đó.
       */
      const contentParts = [
        listing.title || "",
        listing.description || "",
      ]
        .map((value) => String(value).trim())
        .filter(Boolean);

      const content =
        contentParts.join("\n\n") ||
        String(listing.title || "Tin cho thuê bất động sản").trim();

      const response = await fetch("/api/social/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          listingId: listing.id,
          district: listing.district || undefined,
          contents: [content],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Không đưa được tin vào hàng chờ Facebook.",
        );
      }

      /*
       * API enqueue trả success=true + jobs[] khi tạo thành công.
       */
      if (
        data?.success === true &&
        Array.isArray(data?.jobs) &&
        data.jobs.length > 0
      ) {
        setQueueState("queued");
        setQueueMessage(
          `Đã đưa tin vào hàng chờ Facebook (${data.jobs.length} nhóm)`,
        );
        return;
      }

      /*
       * Trường hợp API báo tin đã tồn tại trong hàng chờ.
       */
      if (data?.skipped === true) {
        setQueueState("queued");
        setQueueMessage(
          data?.message ||
            "Tin đã có trong hàng chờ Facebook",
        );
        return;
      }

      /*
       * Trường hợp backend trả success nhưng không có jobs.
       * Không báo thành công giả.
       */
      throw new Error(
        data?.message ||
          data?.error ||
          "Tin chưa được tạo lịch đăng Facebook.",
      );
    } catch (error) {
      setQueueState("error");
      setQueueMessage(
        error instanceof Error
          ? error.message
          : "Không đưa được tin vào hàng chờ Facebook.",
      );
    }
  }

  const title = publicListing.publicTitle || listing.title || "Bất động sản";

  const displayPrice = canSeeRawListing
    ? Number(listing.price || 0) > 0
      ? `${Number(listing.price).toLocaleString("vi-VN")} VNĐ`
      : "Liên hệ"
    : publicListing.price;

  return (
    <article
  style={{
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "220px minmax(0,1fr) 190px",
    gap: 18,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    alignItems: "stretch",
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "0 5px 18px rgba(15,23,42,0.05)",

    // FONT GIỐNG KIỂU ADMIN
    fontFamily:
      "var(--font-inter)",
  }}
>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: isMobile ? 220 : 170,
          overflow: "hidden",
          borderRadius: 10,
          background: "#e2e8f0",
        }}
      >
        <img
          src={listing.images?.[0] || "https://placehold.co/600x400"}
          loading="lazy"
          alt={title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: isRented ? 0.6 : 1,
          }}
        />
        {isRented && <RentedStamp />}
        <span
          style={{
            position: "absolute",
            left: 9,
            bottom: 9,
            padding: "5px 8px",
            borderRadius: 7,
            background: "rgba(15,23,42,.78)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {listing.images?.length || 1} ảnh
        </span>
      </div>

      <div style={{ minWidth: 0, padding: "2px 0" }}>
        <div
          style={{
            color: "#dc2626",
            fontSize: 18,
            fontWeight: 900,
            marginBottom: 7,
          }}
        >
          {displayPrice}
        </div>

        <h3
          style={{
            fontSize: isMobile ? 18 : 20,
            lineHeight: 1.35,
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 11px",
          }}
        >
          {title}
        </h3>

        {(publicListing.area || publicListing.structure) && (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      color: "#475569",
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    {publicListing.area && (
      <span>{publicListing.area}</span>
    )}

    {publicListing.area && publicListing.structure && (
      <span style={{ color: "#cbd5e1" }}>·</span>
    )}

    {publicListing.structure && (
      <span>{publicListing.structure}</span>
    )}
  </div>
)}

        <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  }}
>

</div>

        {canSeeRawListing && listing.description && (
          <p
            style={{
              color: "#475569",
              lineHeight: 1.55,
              margin: "8px 0",
              wordBreak: "break-word",
              fontSize: 14,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {listing.description}
          </p>
        )}

        {canManageListing && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "7px 18px",
              marginTop: 10,
              color: "#64748b",
              fontSize: 13,
            }}
          >
            <span>
              <b>SĐT:</b> {listing.contact_phone || listing.phone || "Chưa có"}
            </span>
            <span>
              <b>Hoa hồng:</b> {listing.commission || listing.hh || "Chưa có"}
            </span>
            {listing.internal_note && (
              <span>
                <b>Ghi chú:</b> {listing.internal_note}
              </span>
            )}
          </div>
        )}

        <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
    color: "#64748b",
    fontSize: 12,
  }}
>
  <span>
    <b>Đăng:</b>{" "}
    {(listing.published_at || listing.created_at)
  ? new Date(
      String(
        listing.published_at || listing.created_at
      )
    ).toLocaleDateString("vi-VN")
  : ""}
  </span>

  {listing.updated_at && (
    <span>
      <b>Cập nhật:</b>{" "}
      {new Date(String(listing.updated_at)).toLocaleDateString("vi-VN")}
    </span>
  )}
</div>

        {queueMessage && (
          <div
            style={{
              marginTop: 9,
              color: queueState === "error" ? "#b91c1c" : "#047857",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {queueMessage}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          alignContent: "flex-start",
          gap: 8,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <button
          type="button"
          style={{
            ...actionButton,
            background: "#07172f",
            color: "#fff",
            border: "1px solid #07172f",
          }}
          onClick={() => onView(listing.id)}
        >
          Xem chi tiết
        </button>

        {canManageListing && onEdit && (
          <button
            type="button"
            style={{
              ...actionButton,
              background: "#07947c",
              color: "#fff",
              border: "1px solid #07947c",
            }}
            onClick={() => onEdit(listing.id)}
          >
            Sửa tin
          </button>
        )}

        {showFacebookQueueButton && (
          <button
            type="button"
            disabled={
              isRented ||
              queueState === "loading" ||
              queueState === "queued" ||
              queueState === "processing"
            }
            style={{
              ...actionButton,
              background:
                queueState === "queued"
                  ? "#ecfdf5"
                  : isRented
                    ? "#f1f5f9"
                    : "#fff7ed",
              color:
                queueState === "queued"
                  ? "#047857"
                  : isRented
                    ? "#94a3b8"
                    : "#ea580c",
              border:
                queueState === "queued"
                  ? "1px solid #10b981"
                  : isRented
                    ? "1px solid #cbd5e1"
                    : "1px solid #fb923c",
              cursor:
                isRented || queueState === "loading" || queueState === "queued"
                  ? "default"
                  : "pointer",
              opacity: queueState === "loading" ? 0.72 : 1,
            }}
            onClick={() => void enqueueFacebook()}
          >
            {isRented
              ? "Tin đã cho thuê"
              : queueState === "loading"
                ? "Đang thêm..."
                : queueState === "queued"
                  ? "Đã có trong hàng chờ"
                  : queueState === "error"
                    ? "Thử thêm lại Facebook"
                    : "Đưa vào hàng chờ Facebook"}
          </button>
        )}

        {canDeleteListing && onDelete && (
          <button
            type="button"
            style={{
              ...actionButton,
              background: "#ef2027",
              color: "#fff",
              border: "1px solid #ef2027",
            }}
            onClick={() => onDelete(listing)}
          >
            Xóa
          </button>
        )}
      </div>
    </article>
  );
}
