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

  async function enqueueFacebook() {
    if (isRented || queueState === "loading" || queueState === "queued") {
      return;
    }

    setQueueState("loading");
    setQueueMessage("");

    try {
      const response = await fetch("/api/social/sync-today", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingIds: [listing.id],
          force: false,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const results = Array.isArray(data?.results) ? data.results : [];
      const currentResult = results.find(
        (result: { listingId?: string }) => result?.listingId === listing.id,
      );
      const reason = String(currentResult?.reason || data?.message || "");

      if (!response.ok) {
        throw new Error(data?.error || reason || "Không đưa được tin vào hàng chờ");
      }

      const alreadyQueued = /đã có lịch|đã có trong hàng chờ|pending|processing/i.test(
        reason,
      );

      const created =
        Number(data?.createdJobs || 0) > 0 ||
        Number(data?.queuedListings || 0) > 0 ||
        currentResult?.queued === true ||
        alreadyQueued;

      if (!created) {
        throw new Error(
          reason ||
            "Tin chưa được đưa vào hàng chờ. Kiểm tra tài khoản và nhóm Facebook.",
        );
      }

      setQueueState("queued");
      setQueueMessage(
        alreadyQueued
          ? "Tin đã có trong hàng chờ Facebook"
          : "Đã đưa tin vào hàng chờ Facebook",
      );
    } catch (error) {
      setQueueState("error");
      setQueueMessage(
        error instanceof Error ? error.message : "Không đưa được tin vào hàng chờ",
      );
    }
  }

  const title = canSeeRawListing
    ? listing.title || "Bất động sản"
    : publicListing.publicTitle;

  const displayPrice = canSeeRawListing
    ? Number(listing.price || 0) > 0
      ? `${Number(listing.price).toLocaleString("vi-VN")} VNĐ`
      : "Liên hệ"
    : publicListing.price;

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "220px minmax(0,1fr) 190px",
        gap: 18,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
        alignItems: "stretch",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "0 5px 18px rgba(15,23,42,0.05)",
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 7,
            marginBottom: 12,
          }}
        >
          {[
            publicListing.area || (listing.area ? `${listing.area}m²` : ""),
            publicListing.structure || "",
            listing.bedrooms ? `${listing.bedrooms} PN` : "",
            listing.district || "",
            "Mặt tiền",
          ]
            .filter(Boolean)
            .map((label) => (
              <span
                key={String(label)}
                style={{
                  borderRadius: 999,
                  padding: "5px 9px",
                  background: "#f1f5f9",
                  color: "#475569",
                  fontSize: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                {String(label)}
              </span>
            ))}
        </div>

        {search.trim() && (
          <div
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 9,
              background: "#eff6ff",
              color: "#1e3a8a",
            }}
          >
            <strong>Điểm phù hợp: {String(item.score ?? 0)}</strong>
            {getReasonLabels(item).length > 0 && (
              <div style={{ marginTop: 5, fontSize: 13 }}>
                {getReasonLabels(item).join(" · ")}
              </div>
            )}
          </div>
        )}

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
            marginTop: 12,
            color: "#64748b",
            fontSize: 12,
          }}
        >
          Đăng:{" "}
          {listing.updated_at || listing.created_at
            ? new Date(
                String(listing.updated_at || listing.created_at),
              ).toLocaleString("vi-VN")
            : "Chưa cập nhật"}
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
