import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  fullname: string | null;
  phone: string | null;
  preferred_districts: unknown;
  note: string | null;
  max_price: number | string | null;
  status: string | null;
  created_at: string | null;
};

const STATUSES = [
  "Khách mới",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Đã đi xem",
  "Đang đàm phán",
  "Đã chốt",
  "Hủy",
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

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

const parseNeed = (note: string | null) => {
  if (!note) {
    return "";
  }

  const parts = note
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  const needPart = parts.find((part) => /^need\s*=/i.test(part));

  if (needPart) {
    return needPart.replace(/^need\s*=\s*/i, "").trim();
  }

  return parts[0] || note;
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

const extractFollowUp = (note: string | null) => {
  if (!note) {
    return null;
  }

  const normalized = normalizeText(note);
  const labeled = normalized.match(/follow_up_date\s*=\s*(\d{4}-\d{2}-\d{2})/);
  const vietnamese = normalized.match(
    /(?:hen|lich|ngay)?\s*(?:cham soc|goi|lien he|follow[\s-]?up)(?:\s*lai)?\s*:?\s*(\d{4}-\d{2}-\d{2})/
  );
  const fallback = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const value = labeled?.[1] || vietnamese?.[1] || fallback?.[1] || "";

  return createLocalDate(value);
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatDate = (value: string | null) => {
  if (!value) {
    return "Chưa có";
  }

  return new Date(value).toLocaleDateString("vi-VN");
};

const getLeads = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      leads: [] as Lead[],
      error: "Thiếu cấu hình Supabase để tải dashboard.",
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("leads")
    .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at")
    .order("created_at", { ascending: false });

  return {
    leads: (data || []) as Lead[],
    error: error?.message || "",
  };
};

export default async function DashboardPage() {
  const { leads, error } = await getLeads();
  const today = startOfLocalDay(new Date()).getTime();
  const leadsWithFollowUp = leads.map((lead) => ({
    lead,
    followUpDate: extractFollowUp(lead.note),
  }));
  const dueToday = leadsWithFollowUp.filter(
    (item) => item.followUpDate && startOfLocalDay(item.followUpDate).getTime() === today
  );
  const overdue = leadsWithFollowUp.filter(
    (item) => item.followUpDate && startOfLocalDay(item.followUpDate).getTime() < today
  );
  const kpis = [
    { label: "Tổng khách", value: leads.length },
    ...STATUSES.map((status) => ({
      label: status,
      value: leads.filter((lead) => (lead.status || STATUSES[0]) === status).length,
    })),
  ];
  const recentLeads = leads.slice(0, 10);

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
          <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
            Dashboard
          </Link>
          <Link href="/post" style={{ color: "#fff", textDecoration: "none" }}>
            Đăng tin
          </Link>
          <Link href="/customers" style={{ color: "#fff", textDecoration: "none" }}>
            Khách hàng
          </Link>
        </div>
      </div>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>Dashboard CRM</h1>
            <p style={{ marginTop: 0, color: "#6b7280" }}>
              Tổng quan khách hàng, trạng thái chăm sóc và lịch cần xử lý.
            </p>
          </div>
          <Link
            href="/customers"
            style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "11px 16px", borderRadius: 8, fontWeight: 700 }}
          >
            Xem khách hàng
          </Link>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 16 }}>
            Không tải được dashboard: {error}
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginBottom: 22 }}>
          {kpis.map((item) => (
            <div key={item.label} style={{ background: "#fff", borderRadius: 8, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>{item.label}</div>
              <strong style={{ fontSize: 26 }}>{item.value}</strong>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 22 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Cần chăm sóc hôm nay</h2>
            <strong style={{ fontSize: 34, color: "#166534" }}>{dueToday.length}</strong>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Quá hạn chăm sóc</h2>
            <strong style={{ fontSize: 34, color: "#991b1b" }}>{overdue.length}</strong>
          </div>
        </section>

        <section style={{ background: "#fff", borderRadius: 8, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Khách mới gần đây</h2>
          {recentLeads.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 13 }}>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Tên</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>SĐT</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Khu vực</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Nhu cầu</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Trạng thái</th>
                    <th style={{ padding: "10px 8px", borderBottom: "1px solid #e5e7eb" }}>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6", fontWeight: 700 }}>
                        {lead.fullname || "Chưa có tên"}
                      </td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6" }}>{lead.phone || "Chưa có"}</td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatDistricts(lead.preferred_districts) || "Chưa có"}</td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6" }}>{parseNeed(lead.note) || "Chưa có"}</td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6" }}>{lead.status || STATUSES[0]}</td>
                      <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatDate(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "#6b7280", padding: "10px 0" }}>Chưa có khách hàng nào.</div>
          )}
        </section>
      </main>
    </div>
  );
}
