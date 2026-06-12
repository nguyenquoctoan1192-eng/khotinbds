"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Lead = {
  id: string;
  fullname: string | null;
  phone: string | null;
  preferred_districts: unknown;
  note: string | null;
  max_price: number | string | null;
  created_at: string | null;
};

type FollowUpStatus = "today" | "overdue" | "upcoming" | "none";

type LeadWithFollowUp = {
  lead: Lead;
  crmFields: CrmFields;
  followUpDate: Date | null;
  followUpText: string;
  followUpStatus: FollowUpStatus;
};

type CrmFields = {
  need: string;
  rentalTime: string;
  followUpDate: string;
  note: string;
};

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

const buildRequirementQuery = (lead: Lead, crmFields: CrmFields) =>
  [
    formatDistricts(lead.preferred_districts),
    crmFields.need,
    getPriceValue(lead.max_price) > 0 ? `${getPriceValue(lead.max_price)}` : "",
    crmFields.rentalTime,
  ]
    .filter(Boolean)
    .join(" ");

function CustomerCard({
  item,
  index,
}: {
  item: LeadWithFollowUp;
  index: number;
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

  return (
    <article
      id={`lead-${id}`}
      style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <strong style={{ fontSize: 18 }}>{lead.fullname || "Chưa có tên"}</strong>
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

        <Link
          href={searchHref}
          style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}
        >
          Tìm nhà phù hợp
        </Link>
      </div>
    </article>
  );
}

function ReminderSection({
  title,
  items,
}: {
  title: string;
  items: LeadWithFollowUp[];
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

export default function CustomersPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch("/api/leads/list")
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) {
          return;
        }

        setLeads(Array.isArray(json.leads) ? json.leads : []);
        setError(json.success ? "" : json.error || "Không tải được danh sách khách.");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }

        setLeads([]);
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
  const leadsWithFollowUp = leads.map((lead) => {
    const crmFields = parseCrmFields(lead.note);
    const followUpDate = extractFollowUp(lead.note, crmFields);
    const followUpStatus = getFollowUpStatus(followUpDate, today);

    return {
      lead,
      crmFields,
      followUpDate,
      followUpText: formatFollowUpDate(followUpDate),
      followUpStatus,
    };
  });

  const todayItems = leadsWithFollowUp
    .filter((item) => item.followUpStatus === "today" || item.followUpStatus === "overdue")
    .sort((a, b) => (a.followUpDate?.getTime() || 0) - (b.followUpDate?.getTime() || 0));
  const upcomingItems = leadsWithFollowUp
    .filter((item) => item.followUpStatus === "upcoming")
    .sort((a, b) => (a.followUpDate?.getTime() || 0) - (b.followUpDate?.getTime() || 0));
  const unscheduledItems = leadsWithFollowUp.filter((item) => item.followUpStatus === "none");

  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f3f4f6" }}>
      <div style={{ background: "#111827", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 24, fontWeight: 700 }}>
          BDS
        </Link>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
            Trang chủ
          </Link>
          <Link href="/post" style={{ color: "#fff", textDecoration: "none" }}>
            Đăng tin
          </Link>
          <Link href="/customers" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
            Khách hàng
          </Link>
        </div>
      </div>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>Khách hàng</h1>
            <p style={{ marginTop: 0, color: "#6b7280" }}>
              Danh sách khách đã lưu từ form Lưu khách.
            </p>
          </div>
          <Link
            href="/"
            style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "11px 16px", borderRadius: 8, fontWeight: 700 }}
          >
            Thêm khách
          </Link>
        </div>

        {loading && (
          <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
            Đang tải danh sách khách...
          </div>
        )}

        {!loading && error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 16 }}>
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
            <ReminderSection title="Cần chăm sóc hôm nay" items={todayItems} />
            <ReminderSection title="Sắp tới" items={upcomingItems} />
            <ReminderSection title="Chưa có lịch hẹn" items={unscheduledItems} />
          </div>
        )}
      </main>
    </div>
  );
}
