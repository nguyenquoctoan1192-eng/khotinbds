"use client";

import "./customer-workspace.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  buildLeadAssignments,
  type LeadAssignmentResult,
} from "@/lib/leadAssignment";

import { calculateLeadScoring } from "@/lib/leadScoring";

import {
  formatCustomerBudget,
  getCustomerAISummary,
  getCustomerPriceValue,
  getCustomerRequirementDetails,
  getCustomerSource,
  type CustomerDisplayLead,
} from "@/lib/customerDisplay";

/* =========================================================
   TYPES
========================================================= */

type Lead = CustomerDisplayLead & {
  id: string;

  fullname: string | null;
  phone: string | null;

  zalo?: string | null;
  facebook?: string | null;

  preferred_districts: unknown;

  note: string | null;

  max_price: number | string | null;
  min_area?: number | string | null;

  bedrooms?: number | string | null;
  bathrooms?: number | string | null;

  status: string | null;

  lead_score?: number | null;
  lead_temperature?: string | null;

  created_at: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at: string | null;
};

type MatchItem = {
  listing_id: string | number;

  score: number;

  listing?: {
    id?: string | number;
    title?: string | null;

    price?: number | string | null;
    area?: number | string | null;

    district?: string | null;
    address?: string | null;

    image_url?: string | null;
    images?: unknown;

    bedrooms?: number | string | null;
    bathrooms?: number | string | null;

    [key: string]: unknown;
  };

  breakdown?: {
    reasons?: string[];
    [key: string]: unknown;
  };

  reasons?: string[];
};

type ParsedRequirement = Record<string, unknown>;

/* =========================================================
   CRM STATUS
========================================================= */

const crmStatuses = [
  "Khách mới",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Đã đi xem",
  "Đang đàm phán",
  "Đã chốt",
  "Hủy",
];

/* =========================================================
   HELPERS
========================================================= */

const formatDate = (value: string | null) => {
  if (!value) return "Chưa rõ";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa rõ";
  }

  return date.toLocaleString("vi-VN");
};

const formatShortDate = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("vi-VN");
};

const getTemperature = (lead: Lead) => {
  if (
    lead.lead_temperature === "Hot" ||
    lead.lead_temperature === "Warm" ||
    lead.lead_temperature === "Cold"
  ) {
    return lead.lead_temperature;
  }

  return calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_temperature;
};

const getInitial = (lead: Lead) =>
  (lead.fullname || "K").trim().slice(0, 1).toUpperCase();

const getListingImage = (match: MatchItem) => {
  const listing = match.listing || {};

  if (
    typeof listing.image_url === "string" &&
    listing.image_url.trim()
  ) {
    return listing.image_url;
  }

  if (Array.isArray(listing.images)) {
    const first = listing.images[0];

    if (typeof first === "string" && first.trim()) {
      return first;
    }

    if (
      first &&
      typeof first === "object" &&
      "url" in first
    ) {
      const url = (first as { url?: unknown }).url;

      if (typeof url === "string" && url.trim()) {
        return url;
      }
    }
  }

  return "";
};

const formatPrice = (value: unknown) => {
  const price = getCustomerPriceValue(
    value as number | string | null
  );

  return price > 0
    ? `${formatCustomerBudget(price)}/tháng`
    : "Liên hệ";
};

const getReasons = (match: MatchItem) =>
  Array.from(
    new Set(
      (
        match.reasons ||
        match.breakdown?.reasons ||
        []
      ).filter(Boolean)
    )
  );

const getSummaryItems = (lead: Lead): string[] => {
  const summary = getCustomerAISummary(lead) as unknown;

  if (Array.isArray(summary)) {
    return summary
      .map(String)
      .filter(Boolean);
  }

  if (typeof summary === "string") {
    return summary
      .split(/\n+/)
      .map((item) =>
        item
          .replace(/^[-•*]\s*/, "")
          .trim()
      )
      .filter(Boolean);
  }

  return [];
};

/* =========================================================
   CUSTOMER SIDEBAR
========================================================= */

function CustomerSidebar({
  leads,
  selectedId,
  search,
  setSearch,
  onSelect,
  onSaved,
  onDeleted,
}: {
  leads: Lead[];
  selectedId: string;
  search: string;
  setSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onSaved: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return leads;

    return leads.filter((lead) =>
      [
        lead.fullname,
        lead.phone,
        lead.zalo,
        lead.facebook,
        lead.note,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(q)
        )
    );
  }, [leads, search]);

  /* ---------------------------------------------------------
     ADD CUSTOMER FROM RAW NOTE
  --------------------------------------------------------- */

  const analyzeAndSave = async () => {
    const text = rawText.trim();

    if (!text || analyzing) return;

    try {
      setAnalyzing(true);
      setMessage("");

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "customer_raw",
          rawText: text,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ||
            json.message ||
            "Không phân tích và lưu được khách."
        );
      }

      setRawText("");
      setMessage("✓ Đã phân tích và lưu khách.");

      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không phân tích và lưu được khách."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /* ---------------------------------------------------------
     DELETE CUSTOMER FROM SIDEBAR
  --------------------------------------------------------- */

  const deleteFromSidebar = async (lead: Lead) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa ${
        lead.fullname || "khách hàng này"
      } không?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}`,
        {
          method: "DELETE",
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            json.error ||
            "Không thể xóa khách hàng."
        );
      }

      onDeleted(lead.id);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Không thể xóa khách hàng."
      );
    }
  };

  return (
    <aside className="customer-sidebar">
      {/* SIDEBAR HEADER */}
      <div className="sidebar-heading">
        <div className="eyebrow">
          QUẢN LÝ KHÁCH HÀNG
        </div>

        <h1>Khách hàng</h1>

        <p>
          Lưu nguyên văn nhu cầu khách gửi, phân tích
          bằng AI và tự động matching kho tin.
        </p>
      </div>

      {/* RAW CUSTOMER INPUT */}
      <section className="paste-card">
        <div className="card-title-row">
          <div>
            <h2>Dán nội dung khách gửi</h2>

            <p>
              Giữ nguyên nội dung khách gửi. Hệ thống
              sẽ nhận diện thông tin và phân tích nhu cầu.
            </p>
          </div>

          <span className="date-chip">
            {new Date().toLocaleDateString("vi-VN")}
          </span>
        </div>

        <textarea
          value={rawText}
          onChange={(event) => {
            setRawText(event.target.value);
            setMessage("");
          }}
          placeholder={`Ví dụ:

Khách mình cần thuê căn hộ 2PN 2WC gần Học viện Hàng không.
Tài chính 12tr quay đầu.
Ưu tiên nhà sạch sẽ thoáng mát, an ninh, full nội thất,
có thể ký hợp đồng dài hạn.`}
        />

        <div className="paste-footer">
          <span>{rawText.length} ký tự</span>

          <button
            type="button"
            onClick={() => void analyzeAndSave()}
            disabled={analyzing || !rawText.trim()}
          >
            {analyzing
              ? "⏳ Đang phân tích..."
              : "✨ Phân tích & Lưu"}
          </button>
        </div>

        {message ? (
          <div
            className={
              message.startsWith("âœ“")
                ? "sidebar-message success"
                : "sidebar-message error"
            }
          >
            {message}
          </div>
        ) : null}
      </section>

      {/* CUSTOMER LIST */}
      <section className="customer-list-card">
        <div className="list-heading">
          <div>
            <h2>Danh sách khách</h2>
            <span>{leads.length} khách</span>
          </div>

          <div className="search-box">
            <span>âŒ•</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Tìm tên, SĐT..."
            />
          </div>
        </div>

        <div className="customer-list">
          {filtered.slice(0, 30).map((lead, index) => (
            <div
              key={lead.id}
              className={`customer-row ${
                lead.id === selectedId ? "active" : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(lead.id)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  onSelect(lead.id);
                }
              }}
            >
              <span
                className={`avatar avatar-${index % 6}`}
              >
                {getInitial(lead)}
              </span>

              <span className="customer-main">
                <strong>
                  {lead.fullname || "Khách hàng"}
                </strong>

                <small>
                  {lead.phone || "Chưa có SĐT"}
                  {" · "}
                  {lead.zalo || "Chưa có Zalo"}
                </small>

                <em>
                  {lead.note
                    ? lead.note
                        .replace(/\s+/g, " ")
                        .slice(0, 60) +
                      (lead.note.length > 60
                        ? "..."
                        : "")
                    : "Chưa có nội dung nhu cầu"}
                </em>
              </span>

              <span className="customer-date">
                {formatShortDate(lead.created_at)}

                <span className="row-actions">
                  <button
                    type="button"
                    className="row-view"
                    aria-label="Xem khách"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(lead.id);
                    }}
                  >
                    â—‰
                  </button>

                  <button
                    type="button"
                    className="row-delete"
                    aria-label="Xóa khách"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteFromSidebar(lead);
                    }}
                  >
                    ðŸ—‘
                  </button>
                </span>
              </span>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="sidebar-empty">
              Không tìm thấy khách hàng.
            </div>
          ) : null}
        </div>

        <div className="pagination">
          {filtered.length > 30
            ? `Hiển thị 30/${filtered.length} khách`
            : `${filtered.length} khách`}
        </div>
      </section>
    </aside>
  );
}

/* =========================================================
   PROFILE HEADER
========================================================= */

function ProfileHeader({
  lead,
  onDelete,
  deleting,
  onRefresh,
}: {
  lead: Lead;
  onDelete: () => void;
  deleting: boolean;
  onRefresh: () => void;
}) {
  const temperature = getTemperature(lead);

  return (
    <div className="profile-header">
      <div className="profile-header-left">
        <Link
          href="/admin/customers"
          className="back-link"
        >
          ← Quay lại danh sách khách
        </Link>

        <div className="profile-title">
          <div className="profile-avatar">
            {getInitial(lead)}
          </div>

          <div>
            <h2>
              {lead.fullname || "Khách hàng"}
            </h2>

            <div className="profile-meta">
              <span>
                {lead.phone || "Chưa có SĐT"}
              </span>

              <span>•</span>

              <span>
                LEAD-{lead.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          <span
            className={`temperature ${temperature.toLowerCase()}`}
          >
            {temperature}
          </span>

          <span className="status-pill">
            {lead.status || "Khách mới"}
          </span>
        </div>
      </div>

      <div className="profile-actions">
        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
        >
          ⟳ <span>Tìm nhà</span>
        </button>

        <button
          type="button"
          className="delete-btn"
          disabled={deleting}
          onClick={onDelete}
        >
          ðŸ—‘{" "}
          <span>
            {deleting
              ? "Đang xóa..."
              : "Xóa khách"}
          </span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   CUSTOMER INFO
========================================================= */

function CustomerInfo({ lead }: { lead: Lead }) {
  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            CUSTOMER PROFILE
          </span>

          <h2>Thông tin khách hàng</h2>
        </div>
      </div>

      <div className="info-grid">
        <Info
          icon="ðŸ‘¤"
          label="Họ tên"
          value={lead.fullname || "Chưa có"}
        />

        <Info
          icon="ðŸ“ž"
          label="Số điện thoại"
          value={lead.phone || "Chưa có SĐT"}
        />

        <Info
          icon="ðŸ’¬"
          label="Zalo"
          value={lead.zalo || "Chưa có"}
        />

        <Info
          icon="â“•"
          label="Facebook"
          value={lead.facebook || "Chưa có"}
        />

        <Info
          icon="â—·"
          label="Ngày tạo"
          value={formatDate(lead.created_at)}
        />

        <Info
          icon="â—"
          label="Trạng thái"
          value={lead.status || "Khách mới"}
          highlight
        />

        <Info
          icon="â™§"
          label="Nguồn"
          value={getCustomerSource(lead)}
        />

        <Info
          icon="#"
          label="Mã khách hàng"
          value={`LEAD-${lead.id
            .slice(0, 12)
            .toUpperCase()}`}
        />
      </div>
    </section>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function Info({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="info-item">
      <span className="info-icon">{icon}</span>

      <span className="info-copy">
        <small>{label}</small>

        <strong
          className={
            highlight ? "orange-value" : ""
          }
        >
          {value}
        </strong>
      </span>
    </div>
  );
}

/* =========================================================
   RAW NOTE
========================================================= */

function RawNote({ lead }: { lead: Lead }) {
  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            ORIGINAL MESSAGE
          </span>

          <h2>Nội dung khách gửi</h2>
        </div>
      </div>

      <div className="raw-note">
        {lead.note || "Khách chưa có nội dung."}
      </div>
    </section>
  );
}

/* =========================================================
   REQUIREMENT
========================================================= */

function Requirement({ lead }: { lead: Lead }) {
  const details = getCustomerRequirementDetails(lead);
  const detailRecord = details as unknown as Record<string, unknown>;

  const rows: Array<{
    icon: string;
    label: string;
    value: unknown;
  }> = [
    {
      icon: "ðŸ“",
      label: "Khu vực",
      value: details.location,
    },
    {
      icon: "âŒ‚",
      label: "Loại hình",
      value: details.propertyType,
    },
    {
      icon: "ðŸ’µ",
      label: "Ngân sách",
      value: details.budget,
    },
    {
      icon: "ðŸ›",
      label: "Phòng ngủ",
      value: lead.bedrooms ?? "Chưa có thông tin",
    },
    {
      icon: "â™¨",
      label: "Phòng vệ sinh",
      value: lead.bathrooms ?? "Chưa có thông tin",
    },
    {
      icon: "ðŸ“",
      label: "Diện tích",
      value: details.area,
    },
    {
      icon: "â†”",
      label: "Ngang",
      value: details.width,
    },
    {
      icon: "ðŸ›‹",
      label: "Nội thất",
      value: detailRecord.furniture,
    },
    {
      icon: "ðŸ“„",
      label: "Hợp đồng",
      value: detailRecord.contract,
    },
    {
      icon: "â­",
      label: "Ưu tiên",
      value: details.extraNote,
    },
    {
      icon: "ðŸŽ¯",
      label: "Mục đích",
      value: details.purpose,
    },
    {
      icon: "ðŸ“",
      label: "Ghi chú",
      value: detailRecord.extraNote,
    },
  ];

  return (
    <section className="content-card requirement-card">
      <div className="section-heading">
        <h2>Nhu cầu đã phân tích bởi AI</h2>
      </div>

      <div className="requirement-grid">
        {rows.map((row, index) => {
          const displayValue =
            row.value !== null &&
            row.value !== undefined &&
            String(row.value).trim() !== ""
              ? String(row.value)
              : "Chưa xác định";

          return (
            <div
              key={`requirement-${index}-${row.label}`}
              className={
                row.label === "Ưu tiên"
                  ? "requirement-item priority"
                  : "requirement-item"
              }
            >
              <span className="req-icon">{row.icon}</span>

              <span>
                <small>{row.label}</small>
                <strong>{displayValue}</strong>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================
   MATCHING
========================================================= */

function Matches({
  matches,
  fallbackWarning,
  onOpen,
}: {
  matches: MatchItem[];
  fallbackWarning?: string | null;
  onOpen: (id: string | number) => void;
}) {
  const topMatches = matches.slice(0, 3);
  const remainingMatches = matches.slice(3, 30);

  return (
    <section className="content-card matches-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            AI PROPERTY MATCHING
          </span>

          <h2>Nhà phù hợp với khách này</h2>
        </div>

        <span className="match-count">
          {matches.length} kết quả
        </span>
      </div>

      {fallbackWarning ? (
        <div className="match-warning">
          âš  {fallbackWarning}
        </div>
      ) : null}

      {/* TOP 3 */}
      {topMatches.length > 0 ? (
        <>
          <div className="sub-heading-row">
            <h3>Top 3 nhà phù hợp nhất</h3>

            <span>
              Ưu tiên theo điểm matching
            </span>
          </div>

          <div className="top-matches">
            {topMatches.map((match, index) => {
              const listing = match.listing || {};

              const score = Math.round(
                Number(match.score || 0)
              );

              const image = getListingImage(match);

              const reasons = getReasons(match);

              const listingId =
                listing.id ?? match.listing_id;

              return (
                <article
                  className={`listing-card rank-${
                    index + 1
                  }`}
                  key={`${listingId}-${index}`}
                >
                  <div className="listing-top">
                    <span>
                      {index === 0
                        ? "🏆 Phù hợp nhất"
                        : `â­ ${
                            index + 1
                          } phù hợp`}
                    </span>

                    <b>{score}%</b>
                  </div>

                  <div className="listing-image">
                    {image ? (
                      <img
                        src={image}
                        alt={
                          listing.title ||
                          "Ảnh bất động sản"
                        }
                      />
                    ) : (
                      <div className="no-image">
                        <span>ðŸ </span>
                        Chưa có ảnh
                      </div>
                    )}
                  </div>

                  <div className="listing-content">
                    <div className="listing-price">
                      {formatPrice(listing.price)}
                    </div>

                    <h3>
                      {listing.title ||
                        "Căn hộ phù hợp"}
                    </h3>

                    <p className="listing-location">
                      ðŸ“{" "}
                      {listing.district ||
                        listing.address ||
                        "Đang cập nhật"}
                    </p>

                    <div className="listing-meta">
                      {listing.area ? (
                        <span>
                          📐 {listing.area}m²
                        </span>
                      ) : null}

                      {listing.bedrooms ? (
                        <span>
                          ðŸ› {listing.bedrooms} PN
                        </span>
                      ) : null}

                      {listing.bathrooms ? (
                        <span>
                          ðŸš¿ {listing.bathrooms} WC
                        </span>
                      ) : null}
                    </div>

                    {reasons.length > 0 ? (
                      <div className="reasons">
                        {reasons
                          .slice(0, 4)
                          .map((reason) => (
                            <span key={reason}>
                              âœ“ {reason}
                            </span>
                          ))}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        onOpen(listingId)
                      }
                    >
                      Xem chi tiết tin →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {/* ALL MATCHES */}
      <div className="all-title">
        <div>
          <h3>Tất cả nhà phù hợp</h3>

          <span>
            Danh sách được sắp xếp theo điểm
            matching
          </span>
        </div>
      </div>

      {remainingMatches.length > 0 ? (
        <div className="all-matches">
          {remainingMatches.map(
            (match, index) => {
              const listing =
                match.listing || {};

              const image =
                getListingImage(match);

              const score = Math.round(
                Number(match.score || 0)
              );

              const listingId =
                listing.id ??
                match.listing_id;

              return (
                <div
                  className="all-match"
                  key={`${listingId}-${index}`}
                >
                  <div className="all-image">
                    {image ? (
                      <img
                        src={image}
                        alt={
                          listing.title ||
                          "Ảnh bất động sản"
                        }
                      />
                    ) : (
                      <div className="no-image">
                        ðŸ 
                      </div>
                    )}
                  </div>

                  <div className="all-copy">
                    <strong>
                      {listing.title ||
                        "Căn phù hợp"}
                    </strong>

                    <small>
                      {listing.district ||
                        "Đang cập nhật"}
                      {" · "}
                      {listing.area
                        ? `${listing.area}m²`
                        : "Chưa rõ diện tích"}

                      {listing.bedrooms
                        ? ` · ${listing.bedrooms} PN`
                        : ""}
                    </small>
                  </div>

                  <strong className="all-price">
                    {formatPrice(listing.price)}
                  </strong>

                  <span className="all-score">
                    {score}%
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      onOpen(listingId)
                    }
                  >
                    Xem chi tiết
                  </button>
                </div>
              );
            }
          )}
        </div>
      ) : null}

      {/* EMPTY */}
      {matches.length === 0 ? (
        <div className="empty-matches">
          <span className="empty-match-icon">
            ðŸ 
          </span>

          <strong>
            Chưa tìm thấy căn phù hợp
          </strong>

          <span>
            Hệ thống chưa tìm được căn đáp ứng
            nhu cầu hiện tại.
          </span>
        </div>
      ) : null}
    </section>
  );
}

/* =========================================================
   AI SUMMARY
========================================================= */

function AISummary({ lead }: { lead: Lead }) {
  const items = getSummaryItems(lead);

  return (
    <section className="content-card ai-summary-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker ai-kicker">
            ARTIFICIAL INTELLIGENCE
          </span>

          <h2>AI Summary</h2>
        </div>

        <span className="ai-badge">
          âœ¨ AI
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="summary-list">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>âœ“</span>

              <p>{item}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="summary-empty">
          Chưa có tóm tắt AI.
        </div>
      )}
    </section>
  );
}

/* =========================================================
   ASSIGNMENT
========================================================= */

function AssignmentPanel({
  assignment,
}: {
  assignment: LeadAssignmentResult;
}) {
  return (
    <section className="content-card assignment-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            SALES ASSIGNMENT
          </span>

          <h2>Phân công</h2>
        </div>
      </div>

      <div className="assignment-box">
        <div className="assignment-avatar">
          ðŸ‘¤
        </div>

        <div>
          <small>
            Nhân viên phụ trách
          </small>

          <strong>
            {assignment.assigned_to}
          </strong>

          <p>
            {assignment.assignment_reason}
          </p>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   CARE / CRM
========================================================= */

function CarePanel({
  lead,
  setLead,
  setActivities,
}: {
  lead: Lead;

  setLead: Dispatch<
    SetStateAction<Lead | null>
  >;

  setActivities: Dispatch<
    SetStateAction<LeadActivity[]>
  >;
}) {
  const updateStatus = async (
    nextStatus: string
  ) => {
    try {
      const response = await fetch(
        "/api/leads/status",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            lead_id: lead.id,
            status: nextStatus,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ||
            json.message ||
            "Không cập nhật được trạng thái."
        );
      }

      setLead((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
            }
          : current
      );

      if (json.activity) {
        setActivities((current) => [
          json.activity,
          ...current,
        ]);
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Không cập nhật được trạng thái."
      );
    }
  };

  const zaloValue = lead.zalo
    ? String(lead.zalo).replace(/\D/g, "")
    : "";

  const phoneValue = lead.phone
    ? String(lead.phone).trim()
    : "";

  const facebookValue = lead.facebook
    ? String(lead.facebook).trim()
    : "";

  const facebookHref =
    facebookValue &&
    /^https?:\/\//i.test(facebookValue)
      ? facebookValue
      : facebookValue
      ? `https://www.facebook.com/${facebookValue}`
      : "";

  return (
    <section className="content-card care-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            CRM FOLLOW-UP
          </span>

          <h2>Thông tin chăm sóc</h2>
        </div>
      </div>

      <label className="status-field">
        <small>Trạng thái CRM</small>

        <select
          value={
            lead.status ||
            crmStatuses[0]
          }
          onChange={(event) =>
            void updateStatus(
              event.target.value
            )
          }
        >
          {crmStatuses.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status}
            </option>
          ))}
        </select>
      </label>

      <div className="contact-actions">
        {/* PHONE */}
        <a
          href={
            phoneValue
              ? `tel:${phoneValue}`
              : "#"
          }
          className={
            !phoneValue
              ? "disabled"
              : ""
          }
          onClick={(event) => {
            if (!phoneValue) {
              event.preventDefault();
            }
          }}
        >
          <span>ðŸ“ž</span>
          <small>Gọi điện</small>
        </a>

        {/* ZALO */}
        <a
          href={
            zaloValue
              ? `https://zalo.me/${zaloValue}`
              : "#"
          }
          target="_blank"
          rel="noreferrer"
          className={
            !zaloValue
              ? "disabled"
              : ""
          }
          onClick={(event) => {
            if (!zaloValue) {
              event.preventDefault();
            }
          }}
        >
          <span>ðŸ’¬</span>
          <small>Zalo</small>
        </a>

        {/* FACEBOOK */}
        <a
          href={facebookHref || "#"}
          target="_blank"
          rel="noreferrer"
          className={
            !facebookHref
              ? "disabled"
              : ""
          }
          onClick={(event) => {
            if (!facebookHref) {
              event.preventDefault();
            }
          }}
        >
          <span>â“•</span>
          <small>Facebook</small>
        </a>
      </div>
    </section>
  );
}

/* =========================================================
   TIMELINE
========================================================= */

function Timeline({
  activities,
}: {
  activities: LeadActivity[];
}) {
  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            ACTIVITY HISTORY
          </span>

          <h2>Lịch sử tương tác</h2>
        </div>

        <span className="activity-count">
          {activities.length}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="timeline-empty">
          Chưa có lịch sử tương tác.
        </div>
      ) : (
        <div className="timeline">
          {activities.map((activity) => (
            <div
              className="timeline-item"
              key={activity.id}
            >
              <span className="timeline-dot" />

              <div className="timeline-content">
                <div className="timeline-head">
                  <strong>
                    {activity.type}
                  </strong>

                  <small>
                    {formatDate(
                      activity.created_at
                    )}
                  </small>
                </div>

                <p>
                  {activity.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   MAIN CUSTOMER WORKSPACE
========================================================= */

export function CustomerWorkspace({
  initialId = "",
}: {
  initialId?: string;
}) {
  const router = useRouter();

  /*
   * id = customer đang được mở trên URL.
   * Giữ duy nhất một nguồn dữ liệu cho customer hiện tại.
   */
  const id = String(initialId || "").trim();

  const [lead, setLead] =
    useState<Lead | null>(null);

  const [leads, setLeads] =
    useState<Lead[]>([]);

  const [activities, setActivities] =
    useState<LeadActivity[]>([]);

  const [matches, setMatches] =
    useState<MatchItem[]>([]);

  const [
    fallbackWarning,
    setFallbackWarning,
  ] = useState<string | null>(null);

  const [
    ,
    setNormalizedRequirement,
  ] = useState<ParsedRequirement | null>(
    null
  );

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  /* =======================================================
     ASSIGNMENT
  ======================================================= */

  const assignment =
    useMemo<LeadAssignmentResult>(() => {
      if (!lead) {
        return {
          assigned_to: "Chưa phân công",
          assignment_reason:
            "Chưa đủ dữ liệu.",
        };
      }

      const map =
        buildLeadAssignments([
          {
            id: lead.id,

            preferred_districts:
              lead.preferred_districts,

            lead_temperature:
              getTemperature(lead),

            lead_score:
              lead.lead_score ||
              undefined,
          },
        ]);

      return (
        map[lead.id] || {
          assigned_to:
            "Chưa phân công",

          assignment_reason:
            "Chưa đủ dữ liệu.",
        }
      );
    }, [lead]);

  /* =======================================================
     LOAD SINGLE CUSTOMER
  ======================================================= */

  const loadLead = async (
    targetId: string
  ) => {
    const response = await fetch(
      `/api/leads/${encodeURIComponent(
        targetId
      )}`,
      {
        cache: "no-store",
      }
    );

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(
        json.error ||
          json.message ||
          "Không tải được khách."
      );
    }

    setLead(json.lead as Lead);

    setActivities(
      Array.isArray(json.activities)
        ? json.activities
        : []
    );

    setMatches(
      Array.isArray(json.matches)
        ? json.matches
        : []
    );

    setFallbackWarning(
      typeof json.fallbackWarning ===
        "string"
        ? json.fallbackWarning
        : null
    );

    setNormalizedRequirement(
      json.normalizedRequirement &&
        typeof json.normalizedRequirement ===
          "object"
        ? (json.normalizedRequirement as ParsedRequirement)
        : null
    );
  };

  /* =======================================================
     RELOAD CUSTOMER LIST
  ======================================================= */

  const reloadLeads = async () => {
    const response = await fetch(
      "/api/leads/list",
      {
        cache: "no-store",
      }
    );

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(
        json.error ||
          json.message ||
          "Không tải được danh sách khách."
      );
    }

    const items =
      Array.isArray(json.leads)
        ? json.leads
        : Array.isArray(json.data)
        ? json.data
        : [];

    setLeads(items as Lead[]);
  };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const listResponse =
          await fetch(
            "/api/leads/list",
            {
              cache: "no-store",
            }
          );

        const listJson =
          await listResponse.json();

        if (
          !listResponse.ok ||
          !listJson.success
        ) {
          throw new Error(
            listJson.error ||
              listJson.message ||
              "Không tải được danh sách khách."
          );
        }

        const items =
          Array.isArray(listJson.leads)
            ? listJson.leads
            : Array.isArray(
                listJson.data
              )
            ? listJson.data
            : [];

        if (!mounted) return;

        setLeads(items as Lead[]);

        if (id) {
          await loadLead(id);

          if (!mounted) return;
        } else {
          setLead(null);
          setActivities([]);
          setMatches([]);
          setFallbackWarning(null);
          setNormalizedRequirement(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Không tải được dữ liệu khách."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [id]);

  /* =======================================================
     DELETE CURRENT CUSTOMER
  ======================================================= */

  const deleteCustomer = async () => {
    if (!lead || deleting) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa ${
        lead.fullname ||
        "khách hàng này"
      }?

Toàn bộ hồ sơ khách sẽ bị xóa khỏi CRM.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/leads/${encodeURIComponent(
          lead.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error ||
            json.message ||
            "Không thể xóa khách."
        );
      }

      setLeads((current) =>
        current.filter(
          (item) =>
            item.id !== lead.id
        )
      );

      setLead(null);
      setActivities([]);
      setMatches([]);
      setDeleting(false);

      router.push(
        "/admin/customers"
      );
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Không thể xóa khách."
      );

      setDeleting(false);
    }
  };

  /* =======================================================
     OPEN LISTING
  ======================================================= */

  const openListing = (
    listingId: string | number
  ) => {
    if (
      listingId === undefined ||
      listingId === null ||
      String(listingId).trim() === ""
    ) {
      return;
    }

    router.push(
      `/listing/${encodeURIComponent(
        String(listingId)
      )}?view=admin&from=admin`
    );
  };

  /* =======================================================
     SELECT CUSTOMER
  ======================================================= */

  const selectCustomer = (
    customerId: string
  ) => {
    const nextId = String(
      customerId || ""
    ).trim();

    if (!nextId || nextId === id) {
      return;
    }

    router.push(
      `/admin/customers?customer=${encodeURIComponent(
        nextId
      )}`
    );
  };

  /* =======================================================
     CUSTOMER SAVED
  ======================================================= */

  const handleCustomerSaved =
    async () => {
      await reloadLeads();
    };

  /* =======================================================
     CUSTOMER DELETED FROM SIDEBAR
  ======================================================= */

  const handleCustomerDeleted = (
    deletedId: string
  ) => {
    setLeads((current) =>
      current.filter(
        (item) =>
          item.id !== deletedId
      )
    );

    if (deletedId === id) {
      setLead(null);
      setActivities([]);
      setMatches([]);
      setFallbackWarning(null);

      router.push(
        "/admin/customers"
      );
    }
  };

  /* =======================================================
     FIND HOUSE AGAIN
  ======================================================= */

  const refreshMatches = async () => {
    if (!lead) return;

    try {
      setError("");

      /*
       * Tải lại toàn bộ customer detail.
       * API hiện tại chịu trách nhiệm parse/matching.
       */
      await loadLead(lead.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tìm lại nhà."
      );
    }
  };

  /* =======================================================
     SELECTED ID
  ======================================================= */

  const selectedId = id;

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="customer-workspace loading-state">
        <div className="loading-card">
          <div className="loading-spinner" />

          <strong>
            Đang tải dữ liệu khách hàng...
          </strong>

          <span>
            Hệ thống đang tải hồ sơ,
            nhu cầu và các căn nhà phù hợp.
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error && !lead) {
    return (
      <div className="customer-workspace error-state">
        <div className="error-card">
          <span className="error-icon">
            âš ï¸
          </span>

          <strong>
            Không tải được dữ liệu
          </strong>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     NO CUSTOMER SELECTED
  ======================================================= */

  if (!lead) {
    return (
      <div className="customer-workspace empty-workspace">
        <CustomerSidebar
          leads={leads}
          selectedId={selectedId}
          search={search}
          setSearch={setSearch}
          onSelect={selectCustomer}
          onSaved={handleCustomerSaved}
          onDeleted={
            handleCustomerDeleted
          }
        />

        <main className="customer-detail empty-detail">
          <div className="empty-detail-card">
            <div className="empty-detail-icon">
              ðŸ‘¤
            </div>

            <h2>
              Chưa chọn khách hàng
            </h2>

            <p>
              Chọn một khách ở danh sách
              bên trái để xem chi tiết
              hồ sơ, nhu cầu và nhà phù hợp.
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     MAIN CRM VIEW
  ======================================================= */

  return (
    <div className="customer-workspace">
      {/* LEFT SIDEBAR */}
      <CustomerSidebar
        leads={leads}
        selectedId={selectedId}
        search={search}
        setSearch={setSearch}
        onSelect={selectCustomer}
        onSaved={handleCustomerSaved}
        onDeleted={handleCustomerDeleted}
      />

      {/* RIGHT DETAIL */}
      <main className="customer-detail">
        <ProfileHeader
          lead={lead}
          onDelete={() =>
            void deleteCustomer()
          }
          deleting={deleting}
          onRefresh={() =>
            void refreshMatches()
          }
        />

        {error ? (
          <div className="inline-error">
            âš  {error}
          </div>
        ) : null}

        {/* CUSTOMER PROFILE */}
        <CustomerInfo lead={lead} />

        {/* ORIGINAL CUSTOMER MESSAGE */}
        <RawNote lead={lead} />

        {/* AI REQUIREMENT */}
        <Requirement lead={lead} />

        {/* MATCHING */}
        <Matches
          matches={matches}
          fallbackWarning={
            fallbackWarning
          }
          onOpen={openListing}
        />

        {/* AI SUMMARY */}
        <AISummary lead={lead} />

        {/* ASSIGNMENT */}
        <AssignmentPanel
          assignment={assignment}
        />

        {/* CRM CARE */}
        <CarePanel
          lead={lead}
          setLead={setLead}
          setActivities={setActivities}
        />

        {/* TIMELINE */}
        <Timeline
          activities={activities}
        />
      </main>
    </div>
  );
}
