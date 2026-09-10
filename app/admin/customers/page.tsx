"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import RoleGate from "@/app/components/role-gate";

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
    width?: number | string | null;
    length?: number | string | null;
    floors?: number | string | null;
    district?: string | null;
    address?: string | null;
    street?: string | null;
    image_url?: string | null;
    images?: unknown;
    description?: string | null;
    bedrooms?: number | string | null;
    bathrooms?: number | string | null;
    [key: string]: unknown;
  };

  breakdown?: {
    district_score?: number;
    price_score?: number;
    area_score?: number;
    bedroom_score?: number;
    business_score?: number;
    total_score?: number;
    reasons?: string[];
    [key: string]: unknown;
  };

  reasons?: string[];
};

const crmStatuses = [
  "Khách mới",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Đã đi xem",
  "Đang đàm phán",
  "Đã chốt",
  "Hủy",
];

const formatDate = (value: string | null) => {
  if (!value) {
    return "Chưa rõ";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa rõ";
  }

  return date.toLocaleString("vi-VN");
};

const getLeadTemperature = (lead: Lead) => {
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

const getZaloHref = (lead: Lead) => {
  const value = String(lead.zalo || "").trim();

  if (!value) {
    const digits = String(lead.phone || "").replace(/\D/g, "");

    return digits ? `https://zalo.me/${digits}` : "#";
  }

  // Đã là URL đầy đủ
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // zalo.me/xxx hoặc www.zalo.me/xxx
  if (/^(www\.)?zalo\.me\//i.test(value)) {
    return `https://${value.replace(/^https?:\/\//i, "")}`;
  }

  // Chỉ nhập số điện thoại / ID Zalo
  if (/^\d+$/.test(value)) {
    return `https://zalo.me/${value}`;
  }

  // Fallback theo số điện thoại
  const digits = String(lead.phone || "").replace(/\D/g, "");

  return digits ? `https://zalo.me/${digits}` : "#";
};

const getFacebookHref = (
  facebook: string | null | undefined
) => {
  const value = String(facebook || "").trim();

  if (!value) {
    return "#";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(www\.)?(facebook|fb)\.com\//i.test(value)) {
    return `https://${value}`;
  }

  return "#";
};

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

    if (typeof first === "string") {
      return first;
    }

    if (
      first &&
      typeof first === "object" &&
      "url" in first
    ) {
      return String(
        (
          first as {
            url?: unknown;
          }
        ).url || ""
      );
    }
  }

  return "";
};

const formatListingPrice = (value: unknown) => {
  const price = getCustomerPriceValue(
    value as number | string | null
  );

  if (price <= 0) {
    return "Liên hệ";
  }

  return `${formatCustomerBudget(price)}/tháng`;
};

const getReasons = (match: MatchItem) => {
  const reasons =
    match.reasons ||
    match.breakdown?.reasons ||
    [];

  return Array.from(
    new Set(
      reasons.filter(
        (reason): reason is string =>
          Boolean(reason)
      )
    )
  );
};

function ProfileHeader({
  lead,
  assignment,
  onDelete,
  deleting,
}: {
  lead: Lead;
  assignment: LeadAssignmentResult;
  onDelete: () => void;
  deleting: boolean;
}) {
  const temperature = getLeadTemperature(lead);

  return (
    <section className="detail-header card">
      <div>
        <Link
          href="/admin/customers"
          className="back-link"
        >
          ← Quay lại danh sách khách
        </Link>

        <div className="title-row">
          <h1>Chi tiết khách hàng</h1>

          <span
            className={`status-pill ${temperature.toLowerCase()}`}
          >
            {lead.status || "Khách mới"}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="match-button"
          onClick={() => window.location.reload()}
        >
          ↻ Tìm lại nhà phù hợp
        </button>

        <button
          type="button"
          className="delete-button"
          onClick={onDelete}
          disabled={deleting}
        >
          🗑 {deleting ? "Đang xóa..." : "Xóa khách hàng"}
        </button>
      </div>
    </section>
  );
}

function CustomerInfo({
  lead,
  assignment,
}: {
  lead: Lead;
  assignment: LeadAssignmentResult;
}) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Thông tin khách hàng</h2>
      </div>

      <div className="info-grid">
        <div>
          <span>👤 Họ tên</span>
          <strong>
            {lead.fullname || "Chưa có tên"}
          </strong>
        </div>

        <div>
          <span>📞 Số điện thoại</span>
          <strong>
            {lead.phone || "Chưa có SĐT"}
          </strong>
        </div>

        <div>
          <span>💬 Zalo</span>
          <strong>
            {lead.zalo || lead.phone || "Chưa có"}
          </strong>
        </div>

        <div>
          <span>ⓕ Facebook</span>
          <strong>
            {lead.facebook || "Chưa có"}
          </strong>
        </div>

        <div>
          <span>📅 Ngày tạo</span>
          <strong>
            {formatDate(lead.created_at)}
          </strong>
        </div>

        <div>
          <span>◉ Trạng thái</span>
          <strong>
            {lead.status || "Khách mới"}
          </strong>
        </div>

        <div>
          <span>🔗 Nguồn</span>
          <strong>
            {getCustomerSource(lead)}
          </strong>
        </div>

        <div>
          <span>👨‍💼 Môi giới</span>
          <strong>
            {assignment.assigned_to}
          </strong>
        </div>
      </div>
    </section>
  );
}

function RawNote({ lead }: { lead: Lead }) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Nội dung khách gửi</h2>
      </div>

      <div className="raw-note">
        {lead.note || "Khách chưa có nội dung."}
      </div>
    </section>
  );
}

function Requirement({ lead }: { lead: Lead }) {
  const details = getCustomerRequirementDetails(lead);

  const rows: Array<[string, unknown]> = [
    ["📍 Khu vực", details.location],
    ["🏠 Loại hình", details.propertyType],
    ["💵 Ngân sách", details.budget],
    ["🛏️ Phòng ngủ", details.bedrooms],
    ["🚿 Phòng vệ sinh", details.bathrooms],
    ["📐 Diện tích", details.area],
    ["↔️ Ngang", details.width],
    ["💼 Mục đích", details.purpose],
    ["📅 Thời gian cần", details.neededTime],
    ["📝 Ghi chú", details.extraNote],
  ];

  return (
    <section className="card">
      <div className="section-title">
        <h2>Nhu cầu đã phân tích bởi AI</h2>
      </div>

      <div className="requirement-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>

            <strong>
              {value !== null &&
              value !== undefined &&
              String(value).trim() !== ""
                ? String(value)
                : "Chưa xác định"}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Matches({
  matches,
}: {
  matches: MatchItem[];
}) {
  const router = useRouter();

  const topMatches = matches.slice(0, 3);

  const openListing = (
    listingId: string | number
  ) => {
    router.push(
      `/listing/${listingId}?view=admin&from=admin`
    );
  };

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h2>Nhà phù hợp với khách này</h2>

          <p>
            AI tự động đối chiếu nhu cầu với kho
            bất động sản.
          </p>
        </div>

        <span className="result-count">
          {matches.length} kết quả
        </span>
      </div>

      {topMatches.length > 0 && (
        <>
          <h3 className="sub-title">
            Top 3 nhà phù hợp nhất
          </h3>

          <div className="top-matches">
            {topMatches.map((match, index) => {
              const listing = match.listing || {};

              const score = Math.round(
                Number(match.score || 0)
              );

              const image =
                getListingImage(match);

              const reasons =
                getReasons(match);

              const listingId =
                listing.id ?? match.listing_id;

              return (
                <article
                  key={`${listingId}-${index}`}
                  className="listing-card"
                >
                  <div className="rank">
                    #{index + 1}
                  </div>

                  <div className="score">
                    {score}%
                  </div>

                  <div className="listing-image">
                    {image ? (
                      <img
                        src={image}
                        alt={
                          listing.title ||
                          "Bất động sản phù hợp"
                        }
                      />
                    ) : (
                      <span>Chưa có ảnh</span>
                    )}
                  </div>

                  <div className="listing-body">
                    <strong className="price">
                      {formatListingPrice(
                        listing.price
                      )}
                    </strong>

                    <h3>
                      {listing.title ||
                        "Căn phù hợp"}
                    </h3>

                    <p className="location">
                      {[
                        listing.district,
                        listing.address,
                      ]
                        .filter(Boolean)
                        .join(" - ") ||
                        "Đang cập nhật"}
                    </p>

                    <div className="meta">
                      {listing.area ? (
                        <span>
                          {listing.area}m²
                        </span>
                      ) : null}

                      {listing.bedrooms ? (
                        <span>
                          {listing.bedrooms} PN
                        </span>
                      ) : null}

                      {listing.bathrooms ? (
                        <span>
                          {listing.bathrooms} WC
                        </span>
                      ) : null}
                    </div>

                    {reasons.length > 0 && (
                      <div className="reasons">
                        {reasons
                          .slice(0, 4)
                          .map((reason) => (
                            <span
                              key={reason}
                            >
                              ✓ {reason}
                            </span>
                          ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        openListing(listingId)
                      }
                    >
                      Xem chi tiết tin
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <h3 className="sub-title all-title">
        Tất cả nhà phù hợp ({matches.length} kết
        quả)
      </h3>

      <div className="all-matches">
        {matches.slice(3, 30).map((match, index) => {
          const listing = match.listing || {};

          const image = getListingImage(match);

          const score = Math.round(
            Number(match.score || 0)
          );

          const listingId =
            listing.id ?? match.listing_id;

          return (
            <div
              className="all-match"
              key={`${listingId}-${index}`}
            >
              <div className="small-image">
                {image ? (
                  <img
                    src={image}
                    alt={
                      listing.title ||
                      "Bất động sản"
                    }
                  />
                ) : null}
              </div>

              <div>
                <strong>
                  {listing.title ||
                    "Căn phù hợp"}
                </strong>

                <p>
                  {listing.district ||
                    "Đang cập nhật"}
                  {" · "}
                  {listing.area
                    ? `${listing.area}m²`
                    : "Chưa rõ diện tích"}
                </p>
              </div>

              <strong className="all-price">
                {formatListingPrice(
                  listing.price
                )}
              </strong>

              <span className="small-score">
                {score}%
              </span>

              <button
                type="button"
                onClick={() =>
                  openListing(listingId)
                }
              >
                Xem chi tiết
              </button>
            </div>
          );
        })}
      </div>

      {matches.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🏠</div>

          <strong>
            Chưa tìm thấy căn phù hợp
          </strong>

          <p>
            Hệ thống chưa tìm được căn đáp ứng
            nhu cầu hiện tại.
          </p>
        </div>
      )}
    </section>
  );
}

function Timeline({
  activities,
}: {
  activities: LeadActivity[];
}) {
  return (
    <section className="card">
      <div className="section-title">
        <h2>Lịch sử tương tác</h2>
      </div>

      {activities.length === 0 ? (
        <div className="empty">
          Chưa có lịch sử tương tác.
        </div>
      ) : (
        <div className="timeline">
          {activities.map((activity) => (
            <div
              className="timeline-item"
              key={activity.id}
            >
              <span />

              <div>
                <strong>
                  {activity.type}
                </strong>

                <p>{activity.content}</p>

                <small>
                  {formatDate(
                    activity.created_at
                  )}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CustomerDetailContent() {
  const params = useParams<{ id: string }>();

  const id = String(params.id || "");

  const [lead, setLead] =
    useState<Lead | null>(null);

  const [activities, setActivities] =
    useState<LeadActivity[]>([]);

  const [matches, setMatches] =
    useState<MatchItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const assignment = useMemo(() => {
    if (!lead) {
      return {
        assigned_to: "Chưa phân công",
        assignment_reason:
          "Chưa đủ dữ liệu.",
      };
    }

    const map = buildLeadAssignments([
      {
        id: lead.id,
        preferred_districts:
          lead.preferred_districts,
        lead_temperature:
          getLeadTemperature(lead),
        lead_score:
          lead.lead_score || undefined,
      },
    ]);

    return (
      map[lead.id] || {
        assigned_to: "Chưa phân công",
        assignment_reason:
          "Chưa đủ dữ liệu.",
      }
    );
  }, [lead]);

  useEffect(() => {
    let mounted = true;

    if (!id) {
      setError("Thiếu ID khách hàng.");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/leads/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
          }
        );

        const json = await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              "Không tải được khách."
          );
        }

        if (!mounted) {
          return;
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
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Không tải được khách."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [id]);

  const deleteCustomer = async () => {
    if (!lead || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa ${
        lead.fullname || "khách hàng này"
      }?\n\nToàn bộ hồ sơ khách sẽ bị xóa khỏi CRM.`
    );

    if (!confirmed) {
      return;
    }

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

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Không thể xóa khách."
        );
      }

      window.location.href =
        "/admin/customers";
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Không thể xóa khách."
      );

      setDeleting(false);
    }
  };

  const updateStatus = async (
    status: string
  ) => {
    if (!lead || updatingStatus) {
      return;
    }

    const previousStatus =
      lead.status || crmStatuses[0];

    try {
      setUpdatingStatus(true);

      // Optimistic update
      setLead((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          status,
        };
      });

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
            status,
          }),
        }
      );

      const json = await response.json();

      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.error ||
            "Không cập nhật được."
        );
      }

      if (json.activity) {
        setActivities((current) => [
          json.activity,
          ...current,
        ]);
      }
    } catch (err) {
      // Rollback
      setLead((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          status: previousStatus,
        };
      });

      alert(
        err instanceof Error
          ? err.message
          : "Không cập nhật được."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="page-state">
        <div className="spinner" />

        <strong>
          Đang tải hồ sơ khách...
        </strong>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="page-state">
        <strong>
          {error ||
            "Không tìm thấy khách hàng."}
        </strong>

        <Link href="/admin/customers">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <ProfileHeader
        lead={lead}
        assignment={assignment}
        onDelete={deleteCustomer}
        deleting={deleting}
      />

      <div className="detail-grid">
        <main>
          <CustomerInfo
            lead={lead}
            assignment={assignment}
          />

          <RawNote lead={lead} />

          <Requirement lead={lead} />

          <section className="card">
            <div className="section-title">
              <h2>🤖 Tóm tắt AI</h2>
            </div>

            <ul className="summary">
              {getCustomerAISummary(
                lead
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <Timeline
            activities={activities}
          />
        </main>

        <aside>
          <Matches matches={matches} />

          <section className="card care-card">
            <div className="section-title">
              <h2>Thông tin chăm sóc</h2>
            </div>

            <label className="status-label">
              <span>Trạng thái CRM</span>

              <select
                value={
                  lead.status ||
                  crmStatuses[0]
                }
                disabled={updatingStatus}
                onChange={(event) =>
                  updateStatus(
                    event.target.value
                  )
                }
              >
                {crmStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              {updatingStatus && (
                <small className="saving">
                  Đang cập nhật...
                </small>
              )}
            </label>

            <div className="contact-actions">
              <a
                href={
                  lead.phone
                    ? `tel:${lead.phone}`
                    : "#"
                }
              >
                📞 Gọi điện
              </a>

              <a
                href={getZaloHref(lead)}
                target="_blank"
                rel="noreferrer"
              >
                💬 Zalo
              </a>

              <a
                href={getFacebookHref(
                  lead.facebook
                )}
                target="_blank"
                rel="noreferrer"
              >
                ⓕ Facebook
              </a>
            </div>
          </section>
        </aside>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          color: #10203a;
          padding-bottom: 40px;
        }

        .card {
          background: white;
          border: 1px solid #e4ebf5;
          border-radius: 16px;
          padding: 18px;
          box-shadow:
            0 8px 24px rgba(15, 23, 42, 0.05);
          margin-bottom: 16px;
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .back-link {
          color: #2563eb;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        h1 {
          font-size: 24px;
          margin: 0;
        }

        h2 {
          margin: 0;
          font-size: 18px;
        }

        h3 {
          margin: 6px 0;
        }

        .status-pill {
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          background: #dcfce7;
          color: #15803d;
        }

        .status-pill.hot {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-pill.warm {
          background: #fef3c7;
          color: #92400e;
        }

        .status-pill.cold {
          background: #e2e8f0;
          color: #475569;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .header-actions button {
          border: 0;
          border-radius: 9px;
          padding: 11px 15px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .header-actions button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .match-button {
          color: white;
          background: #2563eb;
        }

        .delete-button {
          color: white;
          background: #e11d48;
        }

        .delete-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .detail-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            430px;
          gap: 16px;
          align-items: start;
        }

        .section-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
        }

        .section-title p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .info-grid {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          border-top: 1px solid #edf2f7;
          border-left: 1px solid #edf2f7;
          border-radius: 8px;
          overflow: hidden;
        }

        .info-grid > div {
          padding: 13px;
          border-right: 1px solid #edf2f7;
          border-bottom: 1px solid #edf2f7;
          min-width: 0;
        }

        .info-grid span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .info-grid strong {
          display: block;
          font-size: 13px;
          word-break: break-word;
        }

        .raw-note {
          white-space: pre-wrap;
          line-height: 1.7;
          background: #f4f8ff;
          border: 1px solid #cfe0ff;
          border-radius: 9px;
          padding: 14px;
          font-size: 13px;
        }

        .requirement-grid {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          border-top: 1px solid #edf2f7;
          border-left: 1px solid #edf2f7;
          border-radius: 8px;
          overflow: hidden;
        }

        .requirement-grid div {
          padding: 12px;
          min-height: 75px;
          border-right: 1px solid #edf2f7;
          border-bottom: 1px solid #edf2f7;
        }

        .requirement-grid span {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .requirement-grid strong {
          display: block;
          font-size: 13px;
          line-height: 1.4;
        }

        .summary {
          margin: 0;
          padding-left: 20px;
          line-height: 1.8;
        }

        .summary li {
          margin-bottom: 4px;
        }

        .top-matches {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 10px;
        }

        .listing-card {
          position: relative;
          border: 1px solid #dbe5f2;
          border-radius: 12px;
          overflow: hidden;
          background: white;
        }

        .rank {
          position: absolute;
          z-index: 2;
          top: 8px;
          left: 8px;
          background: #fff4cc;
          padding: 5px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 900;
        }

        .score {
          position: absolute;
          z-index: 2;
          top: 8px;
          right: 8px;
          background: #16a34a;
          color: white;
          padding: 5px 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 900;
        }

        .listing-image {
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #e2e8f0;
          display: grid;
          place-items: center;
          color: #64748b;
          overflow: hidden;
        }

        .listing-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .listing-body {
          padding: 10px;
        }

        .listing-body .price {
          color: #2563eb;
          font-size: 15px;
        }

        .listing-body h3 {
          font-size: 13px;
          line-height: 1.4;
          min-height: 36px;
        }

        .location {
          color: #64748b;
          font-size: 11px;
          margin: 5px 0;
          line-height: 1.4;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .meta span {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 3px 6px;
          font-size: 10px;
        }

        .reasons {
          display: grid;
          gap: 3px;
          margin: 8px 0;
        }

        .reasons span {
          color: #15803d;
          font-size: 10px;
          line-height: 1.35;
        }

        .listing-body button,
        .all-match button {
          width: 100%;
          border: 1px solid #9dbfff;
          background: white;
          color: #2563eb;
          border-radius: 7px;
          padding: 7px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .listing-body button:hover,
        .all-match button:hover {
          background: #eff6ff;
        }

        .sub-title {
          font-size: 13px;
          margin: 12px 0;
        }

        .all-title {
          border-top: 1px solid #edf2f7;
          padding-top: 15px;
        }

        .all-matches {
          display: grid;
        }

        .all-match {
          display: grid;
          grid-template-columns:
            62px
            minmax(0, 1fr)
            110px
            50px
            90px;
          gap: 10px;
          align-items: center;
          padding: 9px 0;
          border-top: 1px solid #edf2f7;
        }

        .small-image {
          width: 62px;
          height: 48px;
          border-radius: 7px;
          overflow: hidden;
          background: #e2e8f0;
        }

        .small-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .all-match strong {
          font-size: 12px;
        }

        .all-match p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 11px;
        }

        .all-price {
          color: #2563eb;
        }

        .small-score {
          background: #dcfce7;
          color: #15803d;
          padding: 4px 5px;
          border-radius: 999px;
          text-align: center;
          font-size: 10px;
          font-weight: 900;
        }

        .result-count {
          flex-shrink: 0;
          color: #2563eb;
          background: #eff6ff;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-label {
          display: grid;
          gap: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .status-label select {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          padding: 0 10px;
          background: white;
          color: #10203a;
          outline: none;
        }

        .status-label select:focus {
          border-color: #2563eb;
          box-shadow:
            0 0 0 3px
            rgba(37, 99, 235, 0.1);
        }

        .status-label select:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .saving {
          color: #2563eb;
          font-size: 11px;
        }

        .contact-actions {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 7px;
          margin-top: 12px;
        }

        .contact-actions a {
          text-align: center;
          text-decoration: none;
          color: #2563eb;
          background: #eff6ff;
          border-radius: 8px;
          padding: 9px 5px;
          font-size: 11px;
          font-weight: 800;
          transition:
            background 0.15s ease,
            transform 0.15s ease;
        }

        .contact-actions a:hover {
          background: #dbeafe;
          transform: translateY(-1px);
        }

        .timeline {
          display: grid;
          gap: 13px;
        }

        .timeline-item {
          display: grid;
          grid-template-columns:
            10px
            1fr;
          gap: 10px;
        }

        .timeline-item > span {
          width: 9px;
          height: 9px;
          margin-top: 5px;
          border-radius: 50%;
          background: #2563eb;
        }

        .timeline-item p {
          margin: 3px 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .timeline-item small {
          color: #64748b;
          font-size: 11px;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #64748b;
        }

        .empty-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .empty strong {
          display: block;
          color: #334155;
          margin-bottom: 5px;
        }

        .empty p {
          margin: 0;
          font-size: 12px;
        }

        .page-state {
          min-height: 60vh;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          text-align: center;
        }

        .page-state a {
          color: #2563eb;
          font-weight: 800;
          text-decoration: none;
        }

        .page-state a:hover {
          text-decoration: underline;
        }

        .spinner {
          width: 34px;
          height: 34px;
          border: 3px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation:
            spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }

          .info-grid,
          .requirement-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .top-matches {
            grid-template-columns:
              repeat(3, 1fr);
          }
        }

        @media (max-width: 760px) {
          .page {
            padding-bottom: 20px;
          }

          .card {
            padding: 14px;
            border-radius: 12px;
          }

          .detail-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .header-actions button {
            padding: 10px 8px;
            font-size: 12px;
          }

          h1 {
            font-size: 21px;
          }

          .info-grid,
          .requirement-grid,
          .top-matches {
            grid-template-columns: 1fr;
          }

          .section-title {
            align-items: flex-start;
          }

          .result-count {
            font-size: 10px;
          }

          .all-match {
            grid-template-columns:
              52px
              minmax(0, 1fr);
            gap: 8px;
          }

          .small-image {
            width: 52px;
            height: 44px;
          }

          .all-price,
          .small-score,
          .all-match button {
            grid-column: 2;
          }

          .all-price {
            margin-top: 2px;
          }

          .small-score {
            width: fit-content;
            min-width: 48px;
          }

          .contact-actions {
            grid-template-columns:
              repeat(3, 1fr);
          }
        }

        @media (max-width: 480px) {
          .header-actions {
            grid-template-columns: 1fr;
          }

          .contact-actions {
            grid-template-columns: 1fr;
          }

          .title-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .result-count {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <RoleGate
      allowedRoles={["admin", "agent"]}
    >
      <CustomerDetailContent />
    </RoleGate>
  );
}