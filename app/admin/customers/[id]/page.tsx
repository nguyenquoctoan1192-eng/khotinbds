"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RoleGate from "@/app/components/role-gate";
import { buildLeadAssignments, type LeadAssignmentResult } from "@/lib/leadAssignment";
import { calculateLeadScoring } from "@/lib/leadScoring";
import {
  formatCustomerBudget,
  formatCustomerDistricts,
  getCustomerAISummary,
  getCustomerMainNeed,
  getCustomerNeedTags,
  getCustomerPriceValue,
  getCustomerRequirementDetails,
  getCustomerSource,
  type CustomerDisplayLead,
} from "@/lib/customerDisplay";

type Lead = CustomerDisplayLead & {
  id: string;
  fullname: string | null;
  phone: string | null;
  preferred_districts: unknown;
  note: string | null;
  max_price: number | string | null;
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
    image_url?: string | null;
    images?: unknown;
    [key: string]: unknown;
  };
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

const checklistItems = [
  "Đã gọi",
  "Đã gửi nhà",
  "Đã hẹn xem",
  "Đã báo giá",
  "Đang chốt",
  "Đã chốt",
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const formatDate = (value: string | null) => {
  if (!value) return "Chưa rõ";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ";

  return date.toLocaleString("vi-VN");
};

const getLeadTemperature = (lead: Lead) => {
  if (lead.lead_temperature === "Hot" || lead.lead_temperature === "Warm" || lead.lead_temperature === "Cold") {
    return lead.lead_temperature;
  }

  return calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_temperature;
};

const getInitials = (lead: Lead) =>
  (lead.fullname || "Khách")
    .trim()
    .slice(0, 1)
    .toUpperCase();

const getZaloHref = (phone: string | null) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://zalo.me/${digits}` : "#";
};

const getListingImage = (match: MatchItem) => {
  const listing = match.listing || {};
  const direct = listing.image_url;

  if (typeof direct === "string" && direct) return direct;
  if (Array.isArray(listing.images) && typeof listing.images[0] === "string") {
    return listing.images[0];
  }

  return "";
};

const formatListingPrice = (value: unknown) => {
  const price = getCustomerPriceValue(value as number | string | null);

  if (price <= 0) return "Liên hệ";
  return `${formatCustomerBudget(price)}/tháng`;
};

const isChecklistDone = (label: string, lead: Lead, activities: LeadActivity[]) => {
  const haystack = normalizeText(
    [lead.status, ...activities.flatMap((activity) => [activity.type, activity.content])].join(" ")
  );

  if (label === "Đã gọi") return /goi|call/.test(haystack);
  if (label === "Đã gửi nhà") return /gui nha|soan tin|match/.test(haystack);
  if (label === "Đã hẹn xem") return /hen xem|di xem|lich hen/.test(haystack);
  if (label === "Đã báo giá") return /bao gia|gia chi tiet/.test(haystack);
  if (label === "Đang chốt") return /dam phan|dang chot/.test(haystack);
  if (label === "Đã chốt") return /da chot|chot/.test(haystack);

  return false;
};

function ProfileCard({
  lead,
  assignment,
  onStatusChange,
}: {
  lead: Lead;
  assignment: LeadAssignmentResult;
  onStatusChange: (status: string) => void;
}) {
  const temperature = getLeadTemperature(lead);

  return (
    <section className="card profile-card">
      <div className="profile-top">
        <div className="avatar">{getInitials(lead)}</div>
        <div>
          <h1>{lead.fullname || "Khách chưa có tên"}</h1>
          <p>{lead.phone || "Chưa có SĐT"}</p>
        </div>
      </div>
      <div className="profile-grid">
        <span>Mức độ<strong className={`temp ${temperature.toLowerCase()}`}>{temperature}</strong></span>
        <span>Nguồn<strong>{getCustomerSource(lead)}</strong></span>
        <span>Ngày tạo<strong>{formatDate(lead.created_at)}</strong></span>
        <span>Nhóm<strong>{getCustomerNeedTags(lead)[0] || "CRM"}</strong></span>
        <span>Môi giới phụ trách<strong>{assignment.assigned_to}</strong></span>
        <label>
          Trạng thái CRM
          <select value={lead.status || crmStatuses[0]} onChange={(event) => onStatusChange(event.target.value)}>
            {crmStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="ghost-button">Chỉnh sửa thông tin</button>
    </section>
  );
}

function QuickActions({ lead }: { lead: Lead }) {
  return (
    <section className="card quick-actions">
      <a href={lead.phone ? `tel:${lead.phone}` : "#"}>Gọi điện</a>
      <a href={getZaloHref(lead.phone)} target="_blank" rel="noreferrer">Zalo</a>
      <a href="#matched-listings">Gửi nhà</a>
      <a href="#timeline">Hẹn xem</a>
      <a href="#timeline">Ghi chú</a>
      <button type="button">Khác</button>
    </section>
  );
}

function RequirementTable({ lead }: { lead: Lead }) {
  const details = getCustomerRequirementDetails(lead);
  const rows = [
    ["Loại hình", details.propertyType],
    ["Khu vực", details.location],
    ["Ngân sách", details.budget],
    ["Ngang", details.width],
    ["Diện tích", details.area],
    ["Mục đích", details.purpose],
    ["Thời gian cần", details.neededTime],
    ["Ghi chú thêm", details.extraNote],
  ];

  return (
    <section className="card">
      <h2>Nhu cầu chính</h2>
      <div className="requirement-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline({ activities }: { activities: LeadActivity[] }) {
  const fallback = [
    { id: "call", type: "Đã gọi điện", content: "Cần xác nhận thêm lịch xem nhà.", created_at: null },
    { id: "sent", type: "Đã gửi 5 căn nhà", content: "Ưu tiên căn đúng khu vực và ngân sách.", created_at: null },
    { id: "wait", type: "Chờ phản hồi", content: "Theo dõi lại trong ngày.", created_at: null },
  ];
  const items = activities.length > 0 ? activities : fallback;

  return (
    <section className="card" id="timeline">
      <h2>Lịch sử tương tác</h2>
      <div className="timeline">
        {items.map((activity) => (
          <div className="timeline-item" key={activity.id}>
            <span />
            <div>
              <strong>{activity.type}</strong>
              <p>{activity.content}</p>
              <small>{formatDate(activity.created_at)}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Matches({ matches }: { matches: MatchItem[] }) {
  return (
    <section className="card" id="matched-listings">
      <h2>Nhà phù hợp</h2>
      <div className="match-list">
        {matches.slice(0, 4).map((match, index) => {
          const listing = match.listing || {};
          const image = getListingImage(match);
          const listingId = listing.id || match.listing_id;

          return (
            <article className="match-item" key={`${listingId}-${index}`}>
              <div className="listing-image">
                {image ? <img src={image} alt="" /> : <span>Ảnh</span>}
              </div>
              <div>
                <strong>{listing.title || "Căn phù hợp nhu cầu khách"}</strong>
                <p>{[listing.district, listing.address].filter(Boolean).join(" - ") || "Khu vực đang cập nhật"}</p>
                <div className="listing-meta">
                  <span>{formatListingPrice(listing.price)}</span>
                  <span>{listing.area ? `${listing.area}m²` : "Diện tích chưa rõ"}</span>
                  <span>Điểm phù hợp {Math.round(match.score)}%</span>
                </div>
              </div>
              <div className="listing-actions">
                <button type="button">Gửi</button>
                <Link href={`/listing/${listingId}`}>Xem</Link>
              </div>
            </article>
          );
        })}
        {matches.length === 0 && <div className="empty-state">Chưa có căn match, có thể bổ sung thêm khu vực/ngân sách.</div>}
      </div>
    </section>
  );
}

function CustomerDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const lead = leads.find((item) => item.id === id) || null;
  const leadActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.lead_id === id)
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        ),
    [activities, id]
  );
  const assignment = useMemo(() => {
    if (!lead) {
      return { assigned_to: "Chưa phân công", assignment_reason: "Chưa đủ dữ liệu." };
    }

    const assignmentMap = buildLeadAssignments([
      {
        id: lead.id,
        preferred_districts: lead.preferred_districts,
        lead_temperature: getLeadTemperature(lead),
        lead_score: lead.lead_score || undefined,
      },
    ]);

    return assignmentMap[lead.id] || {
      assigned_to: "Chưa phân công",
      assignment_reason: "Chưa đủ dữ liệu.",
    };
  }, [lead]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/leads/list")
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        setLeads(Array.isArray(json.leads) ? json.leads : []);
        setActivities(Array.isArray(json.activities) ? json.activities : []);
        setError(json.success ? "" : json.error || "Không tải được hồ sơ khách.");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Không tải được hồ sơ khách.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lead) return;

    const districts = formatCustomerDistricts(lead.preferred_districts)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "match",
        note: getCustomerAISummary(lead).join(" "),
        preferred_districts: districts,
        max_price: getCustomerPriceValue(lead.max_price) || null,
      }),
    })
      .then((res) => res.json())
      .then((json) => setMatches(Array.isArray(json.matches) ? json.matches : []))
      .catch(() => setMatches([]));
  }, [lead]);

  const updateLeadStatus = async (status: string) => {
    if (!lead || status === (lead.status || crmStatuses[0])) return;

    try {
      const res = await fetch("/api/leads/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, status }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không cập nhật được trạng thái.");
      }

      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                status,
                lead_score: json.lead?.lead_score ?? item.lead_score,
                lead_temperature: json.lead?.lead_temperature ?? item.lead_temperature,
              }
            : item
        )
      );
      if (json.activity) {
        setActivities((current) => [json.activity, ...current]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không cập nhật được trạng thái.");
    }
  };

  if (loading) {
    return <div className="page-state">Đang tải hồ sơ khách...</div>;
  }

  if (error || !lead) {
    return (
      <div className="page-state">
        <p>{error || "Không tìm thấy khách hàng."}</p>
        <Link href="/admin/customers">Quay lại CRM</Link>
      </div>
    );
  }

  return (
    <div className="detail-shell">
      <header className="breadcrumb-row">
        <Link className="back-link" href="/admin/customers">
          ← Quay lại CRM
        </Link>
        <div className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/admin/customers">CRM</Link>
          <span>&gt;</span>
          <Link href="/admin/customers">Khách hàng</Link>
          <span>&gt;</span>
          <strong>Hồ sơ khách hàng</strong>
        </div>
      </header>

      <div className="detail-grid">
        <div className="left-col">
          <ProfileCard lead={lead} assignment={assignment} onStatusChange={updateLeadStatus} />
          <QuickActions lead={lead} />
          <section className="card">
            <h2>Tóm tắt AI</h2>
            <ul className="summary-list">
              {getCustomerAISummary(lead).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <RequirementTable lead={lead} />
          <section className="card">
            <h2>AI gợi ý hành động</h2>
            <div className="ai-actions">
              <a href={lead.phone ? `tel:${lead.phone}` : "#"}>Gọi lại ngay</a>
              <a href={getZaloHref(lead.phone)} target="_blank" rel="noreferrer">Soạn tin Zalo</a>
              <a href="#matched-listings">Gửi căn phù hợp</a>
              <a href="#timeline">Đặt lịch hẹn xem</a>
            </div>
          </section>
          <Timeline activities={leadActivities} />
        </div>

        <aside className="right-col">
          <Matches matches={matches} />
          <section className="card">
            <h2>Checklist công việc</h2>
            <div className="checklist">
              {checklistItems.map((item) => (
                <label key={item}>
                  <input type="checkbox" readOnly checked={isChecklistDone(item, lead, leadActivities)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        .detail-shell, .page-state { color: #0f172a; font-family: Arial, sans-serif; }
        .page-state { display: grid; place-items: center; align-content: center; gap: 12px; }
        .page-state a, .breadcrumb a, .listing-actions a, .ai-actions a, .quick-actions a, .back-link { color: #2563eb; text-decoration: none; font-weight: 800; }
        .breadcrumb-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .back-link { background: #fff; border: 1px solid #dbeafe; border-radius: 12px; padding: 10px 13px; box-shadow: 0 8px 22px rgba(15, 23, 42, .05); }
        .breadcrumb { display: flex; align-items: center; gap: 9px; color: #64748b; }
        .breadcrumb strong { color: #0f172a; }
        .detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 430px; gap: 18px; align-items: start; }
        .left-col, .right-col { display: grid; gap: 18px; }
        .card { background: #fff; border: 1px solid #e8eef7; border-radius: 16px; box-shadow: 0 10px 28px rgba(15, 23, 42, .06); padding: 18px; }
        h1, h2 { margin: 0; letter-spacing: 0; }
        h1 { font-size: 26px; }
        h2 { font-size: 18px; margin-bottom: 14px; }
        .profile-card { display: grid; gap: 18px; }
        .profile-top { display: flex; align-items: center; gap: 14px; }
        .profile-top p { margin: 6px 0 0; color: #64748b; }
        .avatar { width: 62px; height: 62px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; display: grid; place-items: center; font-size: 24px; font-weight: 900; }
        .profile-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .profile-grid span, .profile-grid label { border: 1px solid #eef2f7; border-radius: 12px; padding: 12px; color: #64748b; display: grid; gap: 6px; font-size: 13px; }
        .profile-grid strong { color: #0f172a; font-size: 14px; }
        select, button { height: 40px; border-radius: 10px; border: 1px solid #dbe3ef; background: #fff; padding: 0 10px; }
        button { cursor: pointer; font-weight: 800; }
        .ghost-button { justify-self: start; color: #2563eb; }
        .temp { border-radius: 999px; padding: 5px 9px; width: max-content; font-weight: 900; }
        .temp.hot { background: #fee2e2; color: #991b1b; }
        .temp.warm { background: #fef3c7; color: #92400e; }
        .temp.cold { background: #e2e8f0; color: #334155; }
        .quick-actions { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
        .quick-actions a, .quick-actions button, .ai-actions a { min-height: 44px; border-radius: 12px; border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; display: grid; place-items: center; text-align: center; padding: 8px; }
        .summary-list { margin: 0; padding-left: 20px; color: #334155; line-height: 1.7; }
        .requirement-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .requirement-grid div { border: 1px solid #eef2f7; border-radius: 12px; padding: 12px; min-height: 78px; }
        .requirement-grid span { display: block; color: #64748b; font-size: 13px; margin-bottom: 6px; }
        .ai-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .timeline { display: grid; gap: 12px; }
        .timeline-item { display: grid; grid-template-columns: 14px 1fr; gap: 10px; }
        .timeline-item > span { width: 10px; height: 10px; border-radius: 999px; background: #2563eb; margin-top: 5px; }
        .timeline-item p { margin: 4px 0; color: #334155; }
        .timeline-item small { color: #64748b; }
        .match-list { display: grid; gap: 12px; }
        .match-item { display: grid; grid-template-columns: 92px 1fr auto; gap: 12px; align-items: center; border: 1px solid #eef2f7; border-radius: 14px; padding: 10px; }
        .listing-image { width: 92px; aspect-ratio: 4 / 3; border-radius: 12px; background: #e2e8f0; display: grid; place-items: center; color: #64748b; overflow: hidden; }
        .listing-image img { width: 100%; height: 100%; object-fit: cover; }
        .match-item p { margin: 5px 0 8px; color: #64748b; font-size: 13px; }
        .listing-meta { display: flex; flex-wrap: wrap; gap: 6px; }
        .listing-meta span { background: #f8fafc; border: 1px solid #eef2f7; border-radius: 999px; padding: 4px 8px; font-size: 12px; }
        .listing-actions { display: grid; gap: 8px; justify-items: stretch; }
        .listing-actions button { background: #2563eb; color: #fff; border-color: #2563eb; }
        .listing-actions a { border: 1px solid #dbe3ef; border-radius: 10px; min-height: 38px; display: grid; place-items: center; padding: 0 12px; }
        .checklist { display: grid; gap: 10px; }
        .checklist label { display: flex; align-items: center; gap: 10px; border: 1px solid #eef2f7; border-radius: 12px; padding: 12px; }
        .checklist input { width: 18px; height: 18px; accent-color: #2563eb; }
        .empty-state { color: #64748b; padding: 10px; }
        @media (max-width: 1100px) {
          .detail-grid { grid-template-columns: 1fr; }
          .profile-grid, .requirement-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .breadcrumb-row { align-items: stretch; flex-direction: column; }
          .back-link { width: 100%; }
          .breadcrumb { overflow-x: auto; white-space: nowrap; padding-bottom: 2px; }
          .quick-actions, .ai-actions, .profile-grid, .requirement-grid { grid-template-columns: 1fr; }
          .match-item { grid-template-columns: 1fr; }
          .listing-image { width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <RoleGate allowedRoles={["admin", "agent"]}>
      <CustomerDetailContent />
    </RoleGate>
  );
}
