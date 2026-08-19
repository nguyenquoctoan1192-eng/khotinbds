import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";
import { redirect } from "next/navigation";
import { getServerProfile, type ServerProfile } from "@/lib/serverAuth";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScoring } from "@/lib/leadScoring";
import {
  calculateNextBestAction,
  getNextActionLabel,
  getNextActionPriorityRank,
  type NextBestActionResult,
} from "@/lib/nextBestAction";
import {
  calculateFollowUp,
  getFollowUpPriorityRank,
  type FollowUpEngineResult,
} from "@/lib/followUpEngine";
import {
  buildLeadAssignments,
  type LeadAssignmentResult,
} from "@/lib/leadAssignment";

export const dynamic = "force-dynamic";

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

type LeadWithNextAction = {
  lead: Lead;
  latestActivity: LeadActivity | null;
  nextBestAction: NextBestActionResult;
  followUpPlan: FollowUpEngineResult;
  assignment: LeadAssignmentResult;
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

const getLeadTemperature = (lead: Lead) =>
  lead.lead_temperature ||
  calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_temperature;

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

const getDaysSince = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

const sortByNextAction = (a: LeadWithNextAction, b: LeadWithNextAction) =>
  getNextActionPriorityRank(a.nextBestAction.priority) -
    getNextActionPriorityRank(b.nextBestAction.priority) ||
  getDaysSince(b.latestActivity?.created_at || b.lead.created_at) -
    getDaysSince(a.latestActivity?.created_at || a.lead.created_at);

const isFollowUpDue = (item: LeadWithNextAction, today: number) => {
  if (!item.followUpPlan.next_follow_up_date) {
    return false;
  }

  const date = createLocalDate(item.followUpPlan.next_follow_up_date);

  return Boolean(date && startOfLocalDay(date).getTime() <= today);
};

const sortByFollowUp = (a: LeadWithNextAction, b: LeadWithNextAction) =>
  getFollowUpPriorityRank(a.followUpPlan.priority) -
    getFollowUpPriorityRank(b.followUpPlan.priority) ||
  getDaysSince(b.latestActivity?.created_at || b.lead.created_at) -
    getDaysSince(a.latestActivity?.created_at || a.lead.created_at);

const getLeads = async (profile: ServerProfile) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      leads: [] as Lead[],
      activities: [] as LeadActivity[],
      error: "Thiếu cấu hình Supabase để tải dashboard.",
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let leadQuery = supabase
    .from("leads")
    .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at, assigned_to")
    .order("created_at", { ascending: false });
  if (profile.role === "agent") leadQuery = leadQuery.eq("assigned_to", profile.id);
  const leadSelect = await leadQuery.limit(200);
  let data: any[] | null = leadSelect.data;
  let error = leadSelect.error;

  if (
    error &&
    String(error.message || "").includes("lead_score")
  ) {
    console.error("lead scoring columns missing; loading dashboard leads without score", error);
    let fallbackQuery = supabase
      .from("leads")
      .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at")
      .order("created_at", { ascending: false });
    if (profile.role === "agent") fallbackQuery = fallbackQuery.eq("assigned_to", profile.id);
    const fallbackSelect = await fallbackQuery.limit(200);

    data = fallbackSelect.data;
    error = fallbackSelect.error;
  }

  const leadIds = (data || []).map((lead) => lead.id).filter(Boolean);
  const { data: activities, error: activitiesError } = leadIds.length > 0
    ? await supabase
        .from("lead_activities")
        .select("id, lead_id, type, content, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  return {
    leads: (data || []) as Lead[],
    activities: (activities || []) as LeadActivity[],
    error: error?.message || activitiesError?.message || "",
  };
};

function NextActionList({
  title,
  items,
}: {
  title: string;
  items: LeadWithNextAction[];
}) {
  return (
    <section style={{ background: "#fff", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <span style={{ background: "#e5e7eb", color: "#374151", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {items.slice(0, 6).map((item) => (
            <Link
              key={`${title}-${item.lead.id}`}
              href={`/customers#lead-${item.lead.id}`}
              style={{
                display: "grid",
                gap: 4,
                color: "#111827",
                textDecoration: "none",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{item.lead.fullname || "Chua co ten"}</strong>
                <span
                  style={{
                    color:
                      item.nextBestAction.priority === "High"
                        ? "#991b1b"
                        : item.nextBestAction.priority === "Medium"
                          ? "#1e40af"
                          : "#374151",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {item.nextBestAction.priority}
                </span>
              </div>
              <div style={{ color: "#374151", fontWeight: 700 }}>
                {getNextActionLabel(item.nextBestAction.next_action)}
              </div>
              <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.4 }}>
                {item.nextBestAction.reason}
              </div>
              <div style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.4 }}>
                Follow-up: {item.followUpPlan.next_follow_up_date || "chưa cần"} · {item.followUpPlan.priority}
              </div>
              <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.4 }}>
                {item.followUpPlan.follow_up_reason}
              </div>
              <div style={{ color: "#7c2d12", fontSize: 13, lineHeight: 1.4, fontWeight: 700 }}>
                Phụ trách: {item.assignment.assigned_to}
              </div>
              <div style={{ color: "#9a3412", fontSize: 12, lineHeight: 1.4 }}>
                {item.assignment.assignment_reason}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ color: "#6b7280" }}>Chua co lead trong nhom nay.</div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const profile = await getServerProfile();
  if (!profile || profile.status !== "approved") redirect("/login");
  if (profile.role !== "admin" && profile.role !== "agent") redirect("/login");
  const { leads, activities, error } = await getLeads(profile);
  const today = startOfLocalDay(new Date()).getTime();
  const assignmentMap = buildLeadAssignments(
    leads.map((lead) => ({
      id: lead.id,
      preferred_districts: lead.preferred_districts,
      lead_temperature: getLeadTemperature(lead),
      lead_score: getLeadScore(lead),
    }))
  );
  const leadsWithNextAction = leads.map((lead) => {
    const leadActivities = activities
      .filter((activity) => activity.lead_id === lead.id)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    const latestActivity = leadActivities[0] || null;
    const nextBestAction = calculateNextBestAction({
      lead_score: getLeadScore(lead),
      lead_temperature: getLeadTemperature(lead),
      latest_activity: latestActivity,
      days_since_last_activity: getDaysSince(latestActivity?.created_at || lead.created_at),
      status: lead.status,
      phone: lead.phone,
    });
    const followUpPlan = calculateFollowUp({
      latest_activity: latestActivity,
      days_since_last_activity: getDaysSince(latestActivity?.created_at || lead.created_at),
      status: lead.status,
    });

    return {
      lead,
      latestActivity,
      nextBestAction,
      followUpPlan,
      assignment: assignmentMap[lead.id] || {
        assigned_to: "Chưa phân công",
        assignment_reason: "Chưa đủ dữ liệu để phân công.",
      },
    };
  });
  const leadsWithFollowUp = leads.map((lead) => ({
    lead,
    followUpDate: extractFollowUp(lead.note),
  }));
  const aiFollowUpDueItems = leadsWithNextAction
    .filter((item) => isFollowUpDue(item, today))
    .sort(sortByFollowUp);
  const dueToday = leadsWithFollowUp.filter(
    (item) => item.followUpDate && startOfLocalDay(item.followUpDate).getTime() === today
  );
  const overdue = leadsWithFollowUp.filter(
    (item) => item.followUpDate && startOfLocalDay(item.followUpDate).getTime() < today
  );
  const kpis = [
    { label: "Leads cần chăm sóc hôm nay", value: aiFollowUpDueItems.length },
    { label: "Tổng khách", value: leads.length },
    { label: "Hot leads", value: leads.filter((lead) => getLeadTemperature(lead) === "Hot").length },
    { label: "Warm leads", value: leads.filter((lead) => getLeadTemperature(lead) === "Warm").length },
    { label: "Cold leads", value: leads.filter((lead) => getLeadTemperature(lead) === "Cold").length },
    ...STATUSES.map((status) => ({
      label: status,
      value: leads.filter((lead) => (lead.status || STATUSES[0]) === status).length,
    })),
  ];
  const recentLeads = leads.slice(0, 10);
  const todaysActions = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action !== "wait")
    .sort(sortByNextAction);
  const callNowItems = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action === "call_now")
    .sort(sortByNextAction);
  const followUpItems = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action === "follow_up")
    .sort(sortByNextAction);
  const waitingItems = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action === "wait")
    .sort(sortByNextAction);
  const assignmentStats = Object.values(
    leadsWithNextAction.reduce(
      (acc, item) => {
        const key = item.assignment.assigned_to;

        if (!acc[key]) {
          acc[key] = {
            assigned_to: key,
            count: 0,
            hot: 0,
            sample_reason: item.assignment.assignment_reason,
          };
        }

        acc[key].count += 1;

        if (getLeadTemperature(item.lead) === "Hot") {
          acc[key].hot += 1;
        }

        return acc;
      },
      {} as Record<
        string,
        {
          assigned_to: string;
          count: number;
          hot: number;
          sample_reason: string;
        }
      >
    )
  ).sort((a, b) => b.hot - a.hot || b.count - a.count);

  return (
    <div style={{ fontFamily: "var(--font-inter)", minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />

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

        <section style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Phân công lead</h2>
          {assignmentStats.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {assignmentStats.map((item) => (
                <div key={item.assigned_to} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 12 }}>
                  <strong>{item.assigned_to}</strong>
                  <div style={{ color: "#7c2d12", marginTop: 6 }}>
                    {item.count} lead · {item.hot} Hot
                  </div>
                  <div style={{ color: "#9a3412", fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
                    {item.sample_reason}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>Chưa có lead để phân công.</div>
          )}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 22 }}>
          <NextActionList title="Leads cần chăm sóc hôm nay" items={aiFollowUpDueItems} />
          <NextActionList title="Việc cần làm hôm nay" items={todaysActions} />
          <NextActionList title="Cần gọi ngay" items={callNowItems} />
          <NextActionList title="Cần follow-up" items={followUpItems} />
          <NextActionList title="Chờ phản hồi" items={waitingItems} />
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

