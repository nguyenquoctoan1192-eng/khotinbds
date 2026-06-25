"use client";

import SiteNavbar from "@/app/components/site-navbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  calculateLeadScoring,
  getLeadTemperatureLabel,
  getLeadTemperatureRank,
} from "@/lib/leadScoring";
import {
  calculateNextBestAction,
  getNextActionLabel,
} from "@/lib/nextBestAction";
import {
  calculateFollowUp,
  type FollowUpEngineResult,
} from "@/lib/followUpEngine";
import RoleGate from "@/app/components/role-gate";
import {
  buildLeadAssignments,
  type LeadAssignmentResult,
} from "@/lib/leadAssignment";

type Lead = {
  id: string;
  fullname: string | null;
  phone: string | null;
  preferred_districts: unknown;
  note: string | null;
  max_price: number | string | null;
  status: string | null;
  lead_score: number | null;
  lead_temperature: string | null;
  created_at: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at: string | null;
};

type FollowUpStatus = "today" | "overdue" | "upcoming" | "none";

type LeadWithFollowUp = {
  lead: Lead;
  crmFields: CrmFields;
  followUpDate: Date | null;
  followUpText: string;
  followUpStatus: FollowUpStatus;
  followUpPlan: FollowUpEngineResult;
  assignment: LeadAssignmentResult;
  activities: LeadActivity[];
};

type CrmFields = {
  need: string;
  rentalTime: string;
  followUpDate: string;
  note: string;
};

type ComposeState = {
  open: boolean;
  message: string;
  copyMessage: string;
};

type NoteModalState = {
  open: boolean;
  leadId: string;
  type: string;
  content: string;
  saving: boolean;
  error: string;
};

type SalesAssistantResult = {
  known_requirements: Record<string, string | null>;
  missing_requirements: string[];
  customer_intent: string;
  objection: string | null;
  suggested_replies: string[];
  next_best_question: string;
};

const SALES_REQUIREMENT_LABELS: Record<string, string> = {
  business: "Business",
  location: "Location",
  budget: "Budget",
  area: "Area",
  structure: "Structure",
  frontage: "Frontage",
  move_in_time: "Move-in time",
};

const SALES_REQUIREMENT_ORDER = [
  "business",
  "location",
  "budget",
  "area",
  "structure",
  "frontage",
  "move_in_time",
];

const LEAD_STATUSES = [
  "Khách mới",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Đã đi xem",
  "Đang đàm phán",
  "Đã chốt",
  "Hủy",
];

const ACTIVITY_TYPES = [
  "Gọi điện",
  "Đã gửi nhà",
  "Đã đi xem",
  "Ghi chú",
];

const formatDistricts = (districts: Lead["preferred_districts"]) => {
  if (Array.isArray(districts)) {
    return districts.filter(Boolean).map(String).join(", ");
  }

  if (typeof districts === "string") {
    return districts;
  }

  if (districts && typeof districts === "object") {
    return Object.values(districts)
      .filter(Boolean)
      .map(String)
      .join(", ");
  }

  return "";
};

const getPriceValue = (price: Lead["max_price"]) => {
  const value = Number(price || 0);

  return Number.isFinite(value) ? value : 0;
};

const formatPrice = (price: Lead["max_price"]) => {
  const value = getPriceValue(price);

  if (value <= 0) {
    return "Chưa có";
  }

  return `${value.toLocaleString("vi-VN")} VNĐ`;
};

const getLeadScore = (lead: Lead) => {
  const storedScore = Number(lead.lead_score);

  if (Number.isFinite(storedScore) && storedScore >= 0) {
    return storedScore;
  }

  return calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_score;
};

const getLeadTemperature = (lead: Lead) =>
  lead.lead_temperature ||
  calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_temperature;

const compareLeadTemperature = (a: LeadWithFollowUp, b: LeadWithFollowUp) => {
  const temperatureDiff =
    getLeadTemperatureRank(getLeadTemperature(a.lead)) -
    getLeadTemperatureRank(getLeadTemperature(b.lead));

  if (temperatureDiff !== 0) {
    return temperatureDiff;
  }

  return (
    new Date(b.lead.created_at || 0).getTime() -
    new Date(a.lead.created_at || 0).getTime()
  );
};

const formatListingPrice = (price: unknown) => {
  const value = Number(price || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return "Liên hệ";
  }

  return `${value.toLocaleString("vi-VN")} VNĐ`;
};

const getReasonLabels = (item: any) => {
  const breakdown = item.breakdown;
  const reasons = item.reasons || breakdown?.reasons || [];
  const labels: string[] = [];

  if (breakdown?.district_score > 0 || reasons.some((reason: string) => reason.includes("District"))) {
    labels.push("Đúng quận");
  }

  if (breakdown?.price_score > 0 || reasons.some((reason: string) => reason.includes("Giá"))) {
    labels.push("Giá gần ngân sách");
  }

  if (breakdown?.area_score > 0 || reasons.some((reason: string) => reason.includes("Area"))) {
    labels.push("Diện tích phù hợp");
  }

  if (breakdown?.business_score > 0) {
    const businessReason = reasons.find((reason: string) =>
      /spa|cafe|office|restaurant|business|MT\/MB|VP|frontage|Premise/i.test(reason)
    );
    const businessType =
      businessReason?.match(/spa|cafe|office|restaurant/i)?.[0] || "kinh doanh";

    labels.push(`Phù hợp ${businessType}`);
  }

  return labels;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const stripKnownPrefix = (value: string) => {
  const normalized = normalizeText(value);
  const colonIndex = value.indexOf(":");

  if (
    colonIndex >= 0 &&
    /^(nhu\s*cau|need|thoi\s*gian.*(?:thue|mua)|rental_time|hen\s*cham\s*soc\s*lai|follow_up_date|ghi\s*chu|note)\s*:/.test(normalized)
  ) {
    return value.slice(colonIndex + 1).trim();
  }

  return value.trim();
};

const parseCrmFields = (note: string | null): CrmFields => {
  const fields: CrmFields = {
    need: "",
    rentalTime: "",
    followUpDate: "",
    note: "",
  };

  if (!note) {
    return fields;
  }

  const unlabeledParts: string[] = [];
  const parts = note
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const keyValueMatch = part.match(/^\s*([a-z_]+)\s*=\s*(.+)\s*$/i);

    if (keyValueMatch) {
      const key = keyValueMatch[1].toLowerCase();
      const value = stripKnownPrefix(keyValueMatch[2]);

      if (key === "need") {
        fields.need = value;
      } else if (key === "rental_time") {
        fields.rentalTime = value;
      } else if (key === "follow_up_date") {
        fields.followUpDate = value;
      } else if (key === "note") {
        fields.note = value;
      }

      continue;
    }

    const normalized = normalizeText(part);

    if (/^nhu\s*cau\s*:/.test(normalized)) {
      fields.need = stripKnownPrefix(part);
    } else if (/^thoi\s*gian.*(?:thue|mua)\s*:/.test(normalized)) {
      fields.rentalTime = stripKnownPrefix(part);
    } else if (/^hen\s*cham\s*soc\s*lai\s*:/.test(normalized)) {
      fields.followUpDate = stripKnownPrefix(part);
    } else if (/^ghi\s*chu\s*:/.test(normalized)) {
      fields.note = stripKnownPrefix(part);
    } else {
      unlabeledParts.push(stripKnownPrefix(part));
    }
  }

  if (!fields.need && unlabeledParts.length > 0) {
    fields.need = unlabeledParts.join(" | ");
  } else if (unlabeledParts.length > 0) {
    fields.note = [fields.note, ...unlabeledParts].filter(Boolean).join(" | ");
  }

  return fields;
};

const createLocalDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const extractFollowUp = (note: string | null, crmFields?: CrmFields) => {
  if (crmFields?.followUpDate) {
    return createLocalDate(crmFields.followUpDate);
  }

  if (!note) {
    return null;
  }

  const normalized = normalizeText(note);
  const labelMatch = normalized.match(
    /(?:hen|lich|ngay)?\s*(?:cham soc|goi|lien he|follow[\s-]?up)(?:\s*lai)?\s*:?\s*(\d{4}-\d{2}-\d{2})/
  );
  const fallbackMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const value = labelMatch?.[1] || fallbackMatch?.[1] || "";

  return createLocalDate(value);
};

const formatFollowUpDate = (date: Date | null) => {
  if (!date) {
    return "Chưa có";
  }

  return date.toLocaleDateString("vi-VN");
};

const getFollowUpStatus = (date: Date | null, today: Date): FollowUpStatus => {
  if (!date) {
    return "none";
  }

  const followUpDay = startOfLocalDay(date).getTime();
  const todayDay = startOfLocalDay(today).getTime();

  if (followUpDay < todayDay) {
    return "overdue";
  }

  if (followUpDay === todayDay) {
    return "today";
  }

  return "upcoming";
};

const getStatusLabel = (status: FollowUpStatus) => {
  if (status === "today") {
    return "Hôm nay";
  }

  if (status === "overdue") {
    return "Quá hạn";
  }

  if (status === "upcoming") {
    return "Sắp tới";
  }

  return "";
};

const getStatusStyle = (status: FollowUpStatus) => {
  if (status === "overdue") {
    return { background: "#fee2e2", color: "#991b1b" };
  }

  if (status === "today") {
    return { background: "#dcfce7", color: "#166534" };
  }

  return { background: "#dbeafe", color: "#1e40af" };
};

const formatActivityDate = (value: string | null) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("vi-VN");
};

const getDaysSince = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const diff = Date.now() - date.getTime();

  return Math.max(0, Math.floor(diff / 86400000));
};

const buildRequirementQuery = (lead: Lead, crmFields: CrmFields) =>
  [
    formatDistricts(lead.preferred_districts),
    crmFields.need,
    getPriceValue(lead.max_price) > 0 ? `${getPriceValue(lead.max_price)}` : "",
    crmFields.rentalTime,
  ]
    .filter(Boolean)
    .join(" ");

const buildNeedSummary = (lead: Lead, crmFields: CrmFields) => {
  const parts = [
    formatDistricts(lead.preferred_districts)
      ? `khu vực ${formatDistricts(lead.preferred_districts)}`
      : "",
    crmFields.need ? `nhu cầu ${crmFields.need}` : "",
    getPriceValue(lead.max_price) > 0
      ? `ngân sách tối đa ${formatPrice(lead.max_price)}`
      : "",
    crmFields.rentalTime ? `thời gian thuê/mua ${crmFields.rentalTime}` : "",
  ].filter(Boolean);

  return parts.join(", ") || "nhu cầu đang tìm";
};

const buildCustomerShareMessage = (
  item: LeadWithFollowUp,
  matches: any[]
) => {
  const topMatches = matches.slice(0, 3);
  const lines = [
    `Em gửi anh/chị một số căn phù hợp với ${buildNeedSummary(item.lead, item.crmFields)}:`,
    "",
    ...topMatches.flatMap((match, index) => {
      const listing = match.listing || match;
      const reasons = getReasonLabels(match);
      const location = [listing.district, listing.address].filter(Boolean).join(" - ");

      return [
        `${index + 1}. ${listing.title || "Bất động sản phù hợp"}`,
        location ? `Khu vực: ${location}` : "",
        `Giá: ${formatListingPrice(listing.price)}`,
        listing.area ? `Diện tích: ${listing.area}m²` : "",
        reasons.length > 0
          ? `Lý do phù hợp: ${reasons.join(", ")}`
          : "Lý do phù hợp: phù hợp với nhu cầu đã lưu",
        "",
      ].filter(Boolean);
    }),
    "Anh/chị xem qua, nếu ưng căn nào em gửi thêm hình ảnh và hẹn lịch xem nhà.",
  ];

  return lines.join("\n");
};

function CustomerCard({
  item,
  index,
  composing,
  onComposeMessage,
  onFindMatches,
  onOpenNote,
  onStatusChange,
  onAssistantProfileSaved,
}: {
  item: LeadWithFollowUp;
  index: number;
  composing: boolean;
  onComposeMessage: (item: LeadWithFollowUp) => void;
  onFindMatches: (item: LeadWithFollowUp, href: string) => void;
  onOpenNote: (item: LeadWithFollowUp) => void;
  onStatusChange: (item: LeadWithFollowUp, status: string) => void;
  onAssistantProfileSaved: (
    leadId: string,
    updatedNote: string | null,
    activity?: LeadActivity,
    leadScoring?: { lead_score?: number; lead_temperature?: string }
  ) => void;
}) {
  const lead = item.lead;
  const crmFields = item.crmFields;
  const id = lead.id || `lead-${index}`;
  const districts = formatDistricts(lead.preferred_districts);
  const requirementQuery = buildRequirementQuery(lead, crmFields);
  const searchHref = requirementQuery
    ? `/?q=${encodeURIComponent(requirementQuery)}`
    : "/";
  const statusLabel = getStatusLabel(item.followUpStatus);
  const leadStatus = lead.status || LEAD_STATUSES[0];
  const temperature = getLeadTemperature(lead);
  const leadScore = getLeadScore(lead);
  const latestActivity = item.activities[0] || null;
  const nextBestAction = calculateNextBestAction({
    lead_score: leadScore,
    lead_temperature: temperature,
    latest_activity: latestActivity,
    days_since_last_activity: getDaysSince(latestActivity?.created_at || lead.created_at),
    status: lead.status,
    phone: lead.phone,
  });
  const followUpPlan = item.followUpPlan;
  const [customerMessage, setCustomerMessage] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantResult, setAssistantResult] =
    useState<SalesAssistantResult | null>(null);
  const [copiedReplyIndex, setCopiedReplyIndex] = useState<number | null>(null);

  const requestAssistant = async () => {
    if (!customerMessage.trim()) {
      setAssistantError("Nhập tin nhắn khách vừa gửi.");
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");
    setCopiedReplyIndex(null);

    try {
      const res = await fetch("/api/ai-sales-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: customerMessage,
          lead,
          history: item.activities.map((activity) => ({
            type: activity.type,
            content: activity.content,
            created_at: activity.created_at,
          })),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không tạo được gợi ý trả lời.");
      }

      setAssistantResult(json.assistant);

      if (json.updated_note || json.activity || json.lead_scoring) {
        onAssistantProfileSaved(lead.id, json.updated_note || lead.note, json.activity, json.lead_scoring);
      }
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : "Không tạo được gợi ý trả lời.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const copySuggestedReply = async (reply: string, index: number) => {
    await navigator.clipboard.writeText(reply);
    setCopiedReplyIndex(index);
  };

  return (
    <article
      id={`lead-${id}`}
      style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <strong style={{ fontSize: 18 }}>{lead.fullname || "Chưa có tên"}</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span
            title={`Lead score: ${leadScore}`}
            style={{
              background: temperature === "Hot" ? "#fee2e2" : temperature === "Warm" ? "#fef3c7" : "#f3f4f6",
              color: temperature === "Hot" ? "#991b1b" : temperature === "Warm" ? "#92400e" : "#374151",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {getLeadTemperatureLabel(temperature)}
          </span>
        {statusLabel && (
          <span
            style={{
              ...getStatusStyle(item.followUpStatus),
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {statusLabel}
          </span>
        )}
          <span
            title={nextBestAction.reason}
            style={{
              background:
                nextBestAction.priority === "High"
                  ? "#fee2e2"
                  : nextBestAction.priority === "Medium"
                    ? "#dbeafe"
                    : "#f3f4f6",
              color:
                nextBestAction.priority === "High"
                  ? "#991b1b"
                  : nextBestAction.priority === "Medium"
                    ? "#1e40af"
                    : "#374151",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {getNextActionLabel(nextBestAction.next_action)}
          </span>
        </div>
      </div>

      <div
        style={{
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
          next_action - {nextBestAction.priority}
        </div>
        <strong>{getNextActionLabel(nextBestAction.next_action)}</strong>
        <div style={{ color: "#4b5563", marginTop: 4, lineHeight: 1.4 }}>
          {nextBestAction.reason}
        </div>
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
          AI follow-up - {followUpPlan.priority}
        </div>
        <strong>
          {followUpPlan.next_follow_up_date
            ? `Chăm sóc: ${followUpPlan.next_follow_up_date}`
            : "Chưa cần chăm sóc"}
        </strong>
        <div style={{ color: "#4b5563", marginTop: 4, lineHeight: 1.4 }}>
          {followUpPlan.follow_up_reason}
        </div>
      </div>

      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ color: "#9a3412", fontSize: 13, marginBottom: 4 }}>
          Phân công phụ trách
        </div>
        <strong>{item.assignment.assigned_to}</strong>
        <div style={{ color: "#7c2d12", marginTop: 4, lineHeight: 1.4 }}>
          {item.assignment.assignment_reason}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "grid", gap: 5, minWidth: 220 }}>
          <span style={{ color: "#6b7280", fontSize: 13 }}>Trạng thái CRM</span>
          <select
            value={leadStatus}
            onChange={(event) => onStatusChange(item, event.target.value)}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "start" }}>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Tên</p>
          <span>{lead.fullname || "Chưa có tên"}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>SĐT</p>
          <span>{lead.phone || "Chưa có"}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Khu vực</p>
          <span>{districts || "Chưa có"}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Nhu cầu</p>
          <span>{crmFields.need || "Chưa có"}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Thời gian thuê/mua</p>
          <span>{crmFields.rentalTime || "Chưa có"}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Ngân sách</p>
          <span>{formatPrice(lead.max_price)}</span>
        </div>
        <div>
          <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Ngày hẹn chăm sóc</p>
          <span>{item.followUpText}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            style={{ background: "#16a34a", color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}
          >
            Gọi điện
          </a>
        )}

        <a
          href={searchHref}
          onClick={(event) => {
            event.preventDefault();
            onFindMatches(item, searchHref);
          }}
          style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}
        >
          Tìm nhà phù hợp
        </a>

        <button
          type="button"
          onClick={() => onComposeMessage(item)}
          disabled={composing}
          style={{ background: "#111827", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700, cursor: composing ? "default" : "pointer", opacity: composing ? 0.7 : 1 }}
        >
          {composing ? "Đang soạn..." : "Soạn tin gửi khách"}
        </button>

        <button
          type="button"
          onClick={() => onOpenNote(item)}
          style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          + Ghi chú chăm sóc
        </button>
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 14, paddingTop: 12 }}>
        <p style={{ margin: "0 0 8px", color: "#374151", fontWeight: 700 }}>Hoạt động gần nhất</p>
        {item.activities.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {item.activities.slice(0, 3).map((activity) => (
              <div key={activity.id} style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <strong>{activity.type}</strong>
                  <span style={{ color: "#6b7280", fontSize: 12 }}>
                    {formatActivityDate(activity.created_at)}
                  </span>
                </div>
                <div style={{ color: "#374151", lineHeight: 1.45 }}>{activity.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#6b7280" }}>Chưa có hoạt động.</p>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 14, paddingTop: 12 }}>
        <p style={{ margin: "0 0 8px", color: "#374151", fontWeight: 700 }}>AI gợi ý trả lời</p>
        <textarea
          placeholder="Tin nhắn khách vừa gửi"
          value={customerMessage}
          onChange={(event) => {
            setCustomerMessage(event.target.value);
            setAssistantError("");
          }}
          style={{ width: "100%", boxSizing: "border-box", minHeight: 92, padding: 12, borderRadius: 8, border: "1px solid #d1d5db", lineHeight: 1.5, fontSize: 15 }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <button
            type="button"
            onClick={requestAssistant}
            disabled={assistantLoading}
            style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700, cursor: assistantLoading ? "default" : "pointer", opacity: assistantLoading ? 0.7 : 1 }}
          >
            {assistantLoading ? "Đang gợi ý..." : "AI gợi ý trả lời"}
          </button>
          {assistantError && (
            <span style={{ color: "#991b1b", fontWeight: 700 }}>{assistantError}</span>
          )}
        </div>

        {assistantResult && (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                <div>
                  <strong>Ý định khách</strong>
                  <p style={{ margin: "5px 0 0", color: "#374151" }}>{assistantResult.customer_intent || "Chưa rõ"}</p>
                </div>
                <div>
                  <strong>Phản đối</strong>
                  <p style={{ margin: "5px 0 0", color: "#374151" }}>{assistantResult.objection || "Không có"}</p>
                </div>
                <div>
                  <strong>Câu hỏi nên hỏi tiếp</strong>
                  <p style={{ margin: "5px 0 0", color: "#374151" }}>{assistantResult.next_best_question}</p>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <strong>Known Requirements</strong>
                  <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                    {SALES_REQUIREMENT_ORDER.filter(
                      (key) => assistantResult.known_requirements[key]
                    ).map((key) => (
                      <div key={key} style={{ color: "#374151" }}>
                        {SALES_REQUIREMENT_LABELS[key]}: {assistantResult.known_requirements[key]}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>Missing Requirements</strong>
                  <div style={{ display: "grid", gap: 5, marginTop: 6, color: "#6b7280" }}>
                    {assistantResult.missing_requirements.length > 0 ? (
                      assistantResult.missing_requirements.map((requirement) => (
                        <div key={requirement}>{requirement}</div>
                      ))
                    ) : (
                      <div>Không còn thiếu thông tin chính.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {assistantResult.suggested_replies.map((reply, replyIndex) => (
              <div key={`${replyIndex}-${reply}`} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                <p style={{ marginTop: 0, lineHeight: 1.5 }}>{reply}</p>
                <button
                  type="button"
                  onClick={() => copySuggestedReply(reply, replyIndex)}
                  style={{ background: "#111827", color: "#fff", border: "none", padding: "8px 10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                >
                  {copiedReplyIndex === replyIndex ? "Đã copy" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ReminderSection({
  title,
  items,
  composingLeadId,
  onComposeMessage,
  onFindMatches,
  onOpenNote,
  onStatusChange,
  onAssistantProfileSaved,
}: {
  title: string;
  items: LeadWithFollowUp[];
  composingLeadId: string;
  onComposeMessage: (item: LeadWithFollowUp) => void;
  onFindMatches: (item: LeadWithFollowUp, href: string) => void;
  onOpenNote: (item: LeadWithFollowUp) => void;
  onStatusChange: (item: LeadWithFollowUp, status: string) => void;
  onAssistantProfileSaved: (
    leadId: string,
    updatedNote: string | null,
    activity?: LeadActivity,
    leadScoring?: { lead_score?: number; lead_temperature?: string }
  ) => void;
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        <span style={{ background: "#e5e7eb", color: "#374151", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item, index) => (
            <CustomerCard
              key={item.lead.id || `${title}-${index}`}
              item={item}
              index={index}
              composing={composingLeadId === item.lead.id}
              onComposeMessage={onComposeMessage}
              onFindMatches={onFindMatches}
              onOpenNote={onOpenNote}
              onStatusChange={onStatusChange}
              onAssistantProfileSaved={onAssistantProfileSaved}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, color: "#6b7280" }}>
          Không có khách trong nhóm này.
        </div>
      )}
    </section>
  );
}

function CustomersContent() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composeState, setComposeState] = useState<ComposeState>({
    open: false,
    message: "",
    copyMessage: "",
  });
  const [composingLeadId, setComposingLeadId] = useState("");
  const [noteModal, setNoteModal] = useState<NoteModalState>({
    open: false,
    leadId: "",
    type: ACTIVITY_TYPES[0],
    content: "",
    saving: false,
    error: "",
  });

  useEffect(() => {
    let mounted = true;

    fetch("/api/leads/list")
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) {
          return;
        }

        setLeads(Array.isArray(json.leads) ? json.leads : []);
        setActivities(Array.isArray(json.activities) ? json.activities : []);
        setError(json.success ? "" : json.error || "Không tải được danh sách khách.");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }

        setLeads([]);
        setActivities([]);
        setError(err instanceof Error ? err.message : "Không tải được danh sách khách.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const today = new Date();
  const assignmentMap = buildLeadAssignments(
    leads.map((lead) => ({
      id: lead.id,
      preferred_districts: lead.preferred_districts,
      lead_temperature: getLeadTemperature(lead),
      lead_score: getLeadScore(lead),
    }))
  );
  const leadsWithFollowUp = leads.map((lead) => {
    const crmFields = parseCrmFields(lead.note);
    const followUpDate = extractFollowUp(lead.note, crmFields);
    const followUpStatus = getFollowUpStatus(followUpDate, today);
    const leadActivities = activities
      .filter((activity) => activity.lead_id === lead.id)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    const latestActivity = leadActivities[0] || null;
    const followUpPlan = calculateFollowUp({
      latest_activity: latestActivity,
      days_since_last_activity: getDaysSince(latestActivity?.created_at || lead.created_at),
      status: lead.status,
    });

    return {
      lead,
      crmFields,
      followUpDate,
      followUpText: formatFollowUpDate(followUpDate),
      followUpStatus,
      followUpPlan,
      assignment: assignmentMap[lead.id] || {
        assigned_to: "Chưa phân công",
        assignment_reason: "Chưa đủ dữ liệu để phân công.",
      },
      activities: leadActivities,
    };
  });

  const statusCounts = LEAD_STATUSES.map((status) => ({
    status,
    count: leads.filter((lead) => (lead.status || LEAD_STATUSES[0]) === status).length,
  }));

  const todayItems = leadsWithFollowUp
    .filter((item) => item.followUpStatus === "today" || item.followUpStatus === "overdue")
    .sort((a, b) => compareLeadTemperature(a, b) || (a.followUpDate?.getTime() || 0) - (b.followUpDate?.getTime() || 0));
  const upcomingItems = leadsWithFollowUp
    .filter((item) => item.followUpStatus === "upcoming")
    .sort((a, b) => compareLeadTemperature(a, b) || (a.followUpDate?.getTime() || 0) - (b.followUpDate?.getTime() || 0));
  const unscheduledItems = leadsWithFollowUp
    .filter((item) => item.followUpStatus === "none")
    .sort(compareLeadTemperature);
  const followUpDueTodayCount = leadsWithFollowUp.filter(
    (item) =>
      item.followUpPlan.next_follow_up_date &&
      createLocalDate(item.followUpPlan.next_follow_up_date) &&
      startOfLocalDay(createLocalDate(item.followUpPlan.next_follow_up_date)!).getTime() <=
        startOfLocalDay(today).getTime()
  ).length;

  const addActivity = async (leadId: string, type: string, content: string) => {
    const res = await fetch("/api/lead-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_id: leadId,
        type,
        content,
      }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Không lưu được hoạt động.");
    }

    if (json.activity) {
      setActivities((current) => [json.activity, ...current]);
    }

    return json.activity as LeadActivity | undefined;
  };

  const updateLeadStatus = async (item: LeadWithFollowUp, status: string) => {
    const lead = item.lead;

    if (!lead.id || status === (lead.status || LEAD_STATUSES[0])) {
      return;
    }

    try {
      const res = await fetch("/api/leads/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: lead.id,
          status,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không cập nhật được trạng thái.");
      }

      setLeads((current) =>
        current.map((currentLead) =>
          currentLead.id === lead.id
            ? {
                ...currentLead,
                status,
                lead_score: json.lead?.lead_score ?? currentLead.lead_score,
                lead_temperature: json.lead?.lead_temperature ?? currentLead.lead_temperature,
              }
            : currentLead
        )
      );

      if (json.activity) {
        setActivities((current) => [json.activity, ...current]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không cập nhật được trạng thái.");
    }
  };

  const openNoteModal = (item: LeadWithFollowUp) => {
    setNoteModal({
      open: true,
      leadId: item.lead.id,
      type: ACTIVITY_TYPES[0],
      content: "",
      saving: false,
      error: "",
    });
  };

  const saveNoteActivity = async () => {
    if (!noteModal.content.trim()) {
      setNoteModal((current) => ({
        ...current,
        error: "Nhập nội dung chăm sóc.",
      }));
      return;
    }

    setNoteModal((current) => ({
      ...current,
      saving: true,
      error: "",
    }));

    try {
      await addActivity(noteModal.leadId, noteModal.type, noteModal.content.trim());
      setNoteModal({
        open: false,
        leadId: "",
        type: ACTIVITY_TYPES[0],
        content: "",
        saving: false,
        error: "",
      });
    } catch (err) {
      setNoteModal((current) => ({
        ...current,
        saving: false,
        error: err instanceof Error ? err.message : "Không lưu được ghi chú.",
      }));
    }
  };

  const findMatchesForLead = async (item: LeadWithFollowUp, href: string) => {
    try {
      await addActivity(item.lead.id, "Ghi chú", "Tìm nhà phù hợp");
    } catch (err) {
      console.error(err);
    } finally {
      router.push(href);
    }
  };

  const updateAssistantProfileState = (
    leadId: string,
    updatedNote: string | null,
    activity?: LeadActivity,
    leadScoring?: { lead_score?: number; lead_temperature?: string }
  ) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              note: updatedNote,
              lead_score: leadScoring?.lead_score ?? lead.lead_score,
              lead_temperature: leadScoring?.lead_temperature ?? lead.lead_temperature,
            }
          : lead
      )
    );

    if (activity) {
      setActivities((current) => [activity, ...current]);
    }
  };

  const openCustomerMessage = async (item: LeadWithFollowUp) => {
    const lead = item.lead;
    const districts = formatDistricts(lead.preferred_districts)
      .split(",")
      .map((district) => district.trim())
      .filter(Boolean);

    setComposingLeadId(lead.id);

    try {
      try {
        await addActivity(lead.id, "Đã gửi nhà", "Soạn tin gửi khách");
      } catch (err) {
        console.error(err);
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "match",
          note: [item.crmFields.need, item.crmFields.rentalTime]
            .filter(Boolean)
            .join(" ") || null,
          preferred_districts: districts,
          max_price: getPriceValue(lead.max_price) > 0
            ? getPriceValue(lead.max_price)
            : null,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không soạn được nội dung.");
      }

      setComposeState({
        open: true,
        message: buildCustomerShareMessage(item, json.matches || []),
        copyMessage: "",
      });
    } catch (err) {
      setComposeState({
        open: true,
        message: err instanceof Error ? err.message : "Không soạn được nội dung.",
        copyMessage: "",
      });
    } finally {
      setComposingLeadId("");
    }
  };

  const copyCustomerMessage = async () => {
    await navigator.clipboard.writeText(composeState.message);
    setComposeState((current) => ({
      ...current,
      copyMessage: "Đã copy nội dung",
    }));
  };

  return (
  <div
    style={{
      fontFamily: "Arial",
      minHeight: "100vh",
      background: "#f3f4f6",
    }}
  >
    <SiteNavbar />

    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Khách hàng</h1>
          <p style={{ marginTop: 0, color: "#6b7280" }}>
            Danh sách khách đã lưu từ form Lưu khách.
          </p>
        </div>

        <Link
          href="/agent/customers"
          style={{
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
            padding: "11px 16px",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          Thêm khách
        </Link>
      </div>

      {!loading && !error && leads.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
              Leads cần chăm sóc hôm nay
            </div>
            <strong style={{ fontSize: 24 }}>{followUpDueTodayCount}</strong>
          </div>

          {statusCounts.map((item) => (
            <div
              key={item.status}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
                {item.status}
              </div>
              <strong style={{ fontSize: 24 }}>{item.count}</strong>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
          Đang tải danh sách khách...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 14,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          Không tải được danh sách khách: {error}
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
          Chưa có khách hàng nào được lưu.
        </div>
      )}

      {!loading && !error && leads.length > 0 && (
        <div style={{ display: "grid", gap: 24 }}>
          <ReminderSection
            title="Cần chăm sóc hôm nay"
            items={todayItems}
            composingLeadId={composingLeadId}
            onComposeMessage={openCustomerMessage}
            onFindMatches={findMatchesForLead}
            onOpenNote={openNoteModal}
            onStatusChange={updateLeadStatus}
            onAssistantProfileSaved={updateAssistantProfileState}
          />

          <ReminderSection
            title="Sắp tới"
            items={upcomingItems}
            composingLeadId={composingLeadId}
            onComposeMessage={openCustomerMessage}
            onFindMatches={findMatchesForLead}
            onOpenNote={openNoteModal}
            onStatusChange={updateLeadStatus}
            onAssistantProfileSaved={updateAssistantProfileState}
          />

          <ReminderSection
            title="Chưa có lịch hẹn"
            items={unscheduledItems}
            composingLeadId={composingLeadId}
            onComposeMessage={openCustomerMessage}
            onFindMatches={findMatchesForLead}
            onOpenNote={openNoteModal}
            onStatusChange={updateLeadStatus}
            onAssistantProfileSaved={updateAssistantProfileState}
          />
        </div>
      )}
    </main>
  </div>
);

      {noteModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(94vw, 520px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>+ Ghi chú chăm sóc</h3>
            <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              <span style={{ color: "#374151", fontWeight: 700 }}>Loại hoạt động</span>
              <select
                value={noteModal.type}
                onChange={(event) =>
                  setNoteModal((current) => ({
                    ...current,
                    type: event.target.value,
                    error: "",
                  }))
                }
                style={{ padding: 12, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#374151", fontWeight: 700 }}>Nội dung</span>
              <textarea
                value={noteModal.content}
                onChange={(event) =>
                  setNoteModal((current) => ({
                    ...current,
                    content: event.target.value,
                    error: "",
                  }))
                }
                style={{ width: "100%", boxSizing: "border-box", minHeight: 150, padding: 12, borderRadius: 8, border: "1px solid #d1d5db", lineHeight: 1.5, fontSize: 15 }}
              />
            </label>
            {noteModal.error && (
              <p style={{ color: "#991b1b", fontWeight: 700, marginBottom: 0 }}>
                {noteModal.error}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <button
                onClick={() =>
                  setNoteModal({
                    open: false,
                    leadId: "",
                    type: ACTIVITY_TYPES[0],
                    content: "",
                    saving: false,
                    error: "",
                  })
                }
                disabled={noteModal.saving}
                style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 14px", borderRadius: 8, cursor: noteModal.saving ? "default" : "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={saveNoteActivity}
                disabled={noteModal.saving}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, cursor: noteModal.saving ? "default" : "pointer", fontWeight: 700, opacity: noteModal.saving ? 0.7 : 1 }}
              >
                {noteModal.saving ? "Đang lưu..." : "Lưu ghi chú"}
              </button>
            </div>
          </div>
        </div>
      )}

      {composeState.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(94vw, 640px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>Soạn tin gửi khách</h3>
            <textarea
              value={composeState.message}
              onChange={(e) =>
                setComposeState((current) => ({
                  ...current,
                  message: e.target.value,
                  copyMessage: "",
                }))
              }
              style={{ width: "100%", boxSizing: "border-box", minHeight: 300, padding: 12, borderRadius: 8, border: "1px solid #d1d5db", lineHeight: 1.5, fontSize: 15 }}
            />
            {composeState.copyMessage && (
              <p style={{ color: "#15803d", fontWeight: 700, marginBottom: 0 }}>
                {composeState.copyMessage}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <button
                onClick={copyCustomerMessage}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}
              >
                Copy nội dung
              </button>
              <button
                onClick={() =>
                  setComposeState({
                    open: false,
                    message: "",
                    copyMessage: "",
                  })
                }
                style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RoleGate allowedRoles={["admin", "agent"]}>
      <CustomersContent />
    </RoleGate>
  );
}
