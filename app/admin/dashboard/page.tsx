import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getServerProfile, type ServerProfile } from "@/lib/serverAuth";
import { calculateLeadScoring } from "@/lib/leadScoring";
import {
  calculateNextBestAction,
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
import {
  formatCustomerDistricts,
  getCustomerMainNeed,
  getCustomerNeedTags,
} from "@/lib/customerDisplay";

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

type KpiCard = {
  label: string;
  value: number | string;
  icon: string;
  change: string;
  href: string;
  tone: "blue" | "green" | "orange" | "purple" | "red";
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

const parseNeed = (note: string | null) => {
  if (!note) return "";

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

  if (!match) return null;

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
  if (!note) return null;

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

const getDaysSince = (value: string | null | undefined) => {
  if (!value) return 0;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 0;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

const sortByNextAction = (a: LeadWithNextAction, b: LeadWithNextAction) =>
  getNextActionPriorityRank(a.nextBestAction.priority) -
    getNextActionPriorityRank(b.nextBestAction.priority) ||
  getDaysSince(b.latestActivity?.created_at || b.lead.created_at) -
    getDaysSince(a.latestActivity?.created_at || a.lead.created_at);

const isFollowUpDue = (item: LeadWithNextAction, today: number) => {
  if (!item.followUpPlan.next_follow_up_date) return false;

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
    .select(
      "id, fullname, phone, preferred_districts, note, max_price, status, lead_score, lead_temperature, created_at, assigned_to"
    )
    .order("created_at", { ascending: false });

  if (profile.role === "agent") {
    leadQuery = leadQuery.eq("assigned_to", profile.id);
  }

  const leadSelect = await leadQuery.limit(200);
  let data: any[] | null = leadSelect.data;
  let error = leadSelect.error;

  if (error && String(error.message || "").includes("lead_score")) {
    console.error("lead scoring columns missing; loading dashboard leads without score", error);
    let fallbackQuery = supabase
      .from("leads")
      .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at")
      .order("created_at", { ascending: false });

    if (profile.role === "agent") {
      fallbackQuery = fallbackQuery.eq("assigned_to", profile.id);
    }

    const fallbackSelect = await fallbackQuery.limit(200);
    data = fallbackSelect.data;
    error = fallbackSelect.error;
  }

  const leadIds = (data || []).map((lead) => lead.id).filter(Boolean);
  const { data: activities, error: activitiesError } =
    leadIds.length > 0
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

const toneMap = {
  blue: { bg: "#eff6ff", text: "#2563eb", light: "#dbeafe" },
  green: { bg: "#ecfdf5", text: "#16a34a", light: "#dcfce7" },
  orange: { bg: "#fff7ed", text: "#ea580c", light: "#ffedd5" },
  purple: { bg: "#f5f3ff", text: "#7c3aed", light: "#ede9fe" },
  red: { bg: "#fef2f2", text: "#dc2626", light: "#fee2e2" },
};

const appointments = [
  // TODO: connect real data from appointments/tasks once scheduling tables are available.
  { time: "09:00", title: "Xem nhà", name: "Nguyễn Văn A", place: "MT Lê Văn Sỹ, Q.3" },
  { time: "10:30", title: "Xem nhà", name: "Trần Thị Bích Ngọc", place: "Nhà HXH CMT8, Q.10" },
  { time: "14:00", title: "Ký gửi", name: "Lê Hoàng Nam", place: "Nhà nguyên căn Q.11" },
  { time: "16:00", title: "Gọi điện", name: "Võ Thành Đạt", place: "Follow-up báo giá" },
];

const funnelData = [
  // TODO: connect real data from CRM funnel metrics.
  { label: "Khách mới", value: 200, width: "100%", color: "#60a5fa" },
  { label: "Đang tư vấn", value: 150, width: "82%", color: "#67e8f9" },
  { label: "Đã gửi nhà", value: 80, width: "66%", color: "#86efac" },
  { label: "Đã xem nhà", value: 40, width: "50%", color: "#fde047" },
  { label: "Đàm phán", value: 15, width: "35%", color: "#fb923c" },
  { label: "Đã chốt", value: 7, width: "23%", color: "#f87171" },
];

const weeklyData = [
  // TODO: connect real data from weekly sales performance.
  { day: "T2", new: 28, tour: 18, deal: 5 },
  { day: "T3", new: 38, tour: 16, deal: 6 },
  { day: "T4", new: 27, tour: 19, deal: 9 },
  { day: "T5", new: 41, tour: 22, deal: 10 },
  { day: "T6", new: 43, tour: 24, deal: 13 },
  { day: "T7", new: 34, tour: 19, deal: 4 },
];

const sourceData = [
  // TODO: connect real data from customer acquisition sources.
  { label: "Zalo", value: "40%", color: "#2563eb" },
  { label: "Facebook", value: "25%", color: "#10b981" },
  { label: "Website", value: "20%", color: "#f59e0b" },
  { label: "Giới thiệu", value: "10%", color: "#8b5cf6" },
  { label: "Khác", value: "5%", color: "#94a3b8" },
];

const aiInsightLinks = [
  "/admin/customers?filter=overdue",
  "/admin/customers?filter=new_matches",
  "/admin/customers?max_price=20000000",
  "/admin/customers?temperature=Hot",
];

const formatShortName = (lead: Lead) => lead.fullname || "Khách AI Chat";

const buildSubtitle = (item: LeadWithNextAction) => {
  const need = getCustomerMainNeed(item.lead);
  const tags = getCustomerNeedTags(item.lead);
  const district = formatCustomerDistricts(item.lead.preferred_districts);
  const days = getDaysSince(item.latestActivity?.created_at || item.lead.created_at);

  if (need) {
    const cleanNeed = [need, tags.slice(0, 2).join(", ")].filter(Boolean).join(" - ");
    return cleanNeed.length > 58 ? `${cleanNeed.slice(0, 58)}...` : cleanNeed;
  }
  if (district) return `Quan tâm ${district}`;
  return `${days} ngày chưa liên hệ`;
};

function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <section className="kpi-grid">
      {cards.map((card) => {
        const tone = toneMap[card.tone];
        return (
          <Link key={card.label} href={card.href} className="kpi-card">
            <div className="kpi-icon" style={{ background: tone.bg, color: tone.text }}>
              {card.icon}
            </div>
            <div>
              <div className="kpi-label">{card.label}</div>
              <strong className="kpi-value">{card.value}</strong>
              <div className="kpi-change">↑ {card.change}</div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function LeadMiniCard({
  item,
  badge,
  actionIcon,
}: {
  item: LeadWithNextAction;
  badge: string;
  actionIcon: string;
}) {
  return (
    <Link href={`/admin/customers/${item.lead.id}`} className="lead-mini-card">
      <div className="avatar">{formatShortName(item.lead).slice(0, 1).toUpperCase()}</div>
      <div className="lead-mini-body">
        <div className="lead-mini-top">
          <strong>{formatShortName(item.lead)}</strong>
          <span className="lead-badge">{badge}</span>
        </div>
        <p>{buildSubtitle(item)}</p>
        {item.nextBestAction.reason && <em>{item.nextBestAction.reason.slice(0, 58)}</em>}
      </div>
      <span className="action-pill">{actionIcon}</span>
    </Link>
  );
}

function ActionColumn({
  title,
  subtitle,
  tone,
  items,
  badgeBuilder,
  actionIcon,
  viewAllHref,
}: {
  title: string;
  subtitle: string;
  tone: "red" | "orange" | "blue" | "purple";
  items: LeadWithNextAction[];
  badgeBuilder: (item: LeadWithNextAction) => string;
  actionIcon: string;
  viewAllHref: string;
}) {
  const toneStyle =
    tone === "red"
      ? { background: "#fff1f2", color: "#dc2626" }
      : tone === "orange"
        ? { background: "#fff7ed", color: "#ea580c" }
        : tone === "blue"
          ? { background: "#eff6ff", color: "#2563eb" }
          : { background: "#f5f3ff", color: "#7c3aed" };

  return (
    <div className="action-column" style={{ background: toneStyle.background }}>
      <div className="action-column-head" style={{ color: toneStyle.color }}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="action-column-list">
        {items.slice(0, 3).map((item) => (
          <LeadMiniCard
            key={`${title}-${item.lead.id}`}
            item={item}
            badge={badgeBuilder(item)}
            actionIcon={actionIcon}
          />
        ))}
        {items.length === 0 && <div className="empty-note">Chưa có lead trong nhóm này.</div>}
      </div>
      <Link href={viewAllHref} className="view-all">Xem tất cả ({items.length})</Link>
    </div>
  );
}

function TodaySchedule() {
  return (
    <section className="card schedule-card">
      <div className="section-title">📅 Lịch hẹn hôm nay</div>
      <div className="timeline">
        {appointments.map((item) => (
          <Link href="/admin/customers" className="timeline-row" key={`${item.time}-${item.name}`}>
            <div className="timeline-time">{item.time}</div>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <strong>{item.title}</strong>
              <span>{item.name}</span>
              <p>{item.place}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/admin/customers?filter=appointments_today" className="view-all">Xem lịch đầy đủ →</Link>
    </section>
  );
}

function FunnelCard() {
  return (
    <section className="card report-card">
      <div className="section-header">
        <h3>Phễu giao dịch</h3>
        <button>Tháng này⌄</button>
      </div>
      <div className="funnel-wrap">
        <div className="funnel-bars">
          {funnelData.map((item) => (
            <div key={item.label} className="funnel-line" style={{ width: item.width, background: item.color }} />
          ))}
        </div>
        <div className="funnel-labels">
          {funnelData.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeeklyPerformance() {
  return (
    <section className="card report-card">
      <div className="section-header">
        <h3>Hiệu suất tuần này</h3>
        <button>Tuần này⌄</button>
      </div>
      <div className="legend">
        <span><i style={{ background: "#2563eb" }} />Khách mới</span>
        <span><i style={{ background: "#10b981" }} />Lịch xem</span>
        <span><i style={{ background: "#f59e0b" }} />Đã chốt</span>
      </div>
      <div className="bar-chart">
        {weeklyData.map((item) => (
          <div className="bar-day" key={item.day}>
            <div className="bar-group">
              <span style={{ height: item.new * 2.2, background: "#2563eb" }} />
              <span style={{ height: item.tour * 2.2, background: "#10b981" }} />
              <span style={{ height: item.deal * 2.2, background: "#f59e0b" }} />
            </div>
            <small>{item.day}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceCard({ total }: { total: number }) {
  return (
    <section className="card report-card">
      <h3>Nguồn khách hàng</h3>
      <div className="source-layout">
        <div className="donut">
          <strong>{total}</strong>
          <span>Tổng khách</span>
        </div>
        <div className="source-list">
          {sourceData.map((item) => (
            <div key={item.label}>
              <span><i style={{ background: item.color }} />{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AIInsight({
  overdueCount,
  newMatchCount,
  hotCount,
}: {
  overdueCount: number;
  newMatchCount: number;
  hotCount: number;
}) {
  const insights = [
    { icon: "⚠", text: `${overdueCount} khách chưa được chăm sóc quá hạn`, sub: "Có nguy cơ mất khách cao" },
    { icon: "🏠", text: `${newMatchCount} khách có nhà mới phù hợp`, sub: "Nên gửi ngay để tăng tỷ lệ chốt" },
    { icon: "💳", text: "12 khách ngân sách < 20 triệu", sub: "Thị trường đang có nhiều lựa chọn tốt" },
    { icon: "✅", text: `${hotCount} khách có khả năng chốt cao`, sub: "Ưu tiên tập trung chốt" },
  ];

  return (
    <section className="card insight-card">
      <h3>✨ AI Insight</h3>
      <div className="insight-list">
        {insights.map((item, index) => (
          <Link key={item.text} href={aiInsightLinks[index]} className="insight-item">
            <span>{item.icon}</span>
            <div>
              <strong>{item.text}</strong>
              <p>{item.sub}</p>
            </div>
            <em>⬺</em>
          </Link>
        ))}
      </div>
      <Link href="/admin/customers" className="view-all">Xem tất cả insight →</Link>
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
  const overdue = leadsWithFollowUp.filter(
    (item) => item.followUpDate && startOfLocalDay(item.followUpDate).getTime() < today
  );
  const todaysActions = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action !== "wait")
    .sort(sortByNextAction);
  const callNowItems = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action === "call_now")
    .sort(sortByNextAction);
  const followUpItems = leadsWithNextAction
    .filter((item) => item.nextBestAction.next_action === "follow_up")
    .sort(sortByNextAction);
  const highPriorityItems = [...callNowItems, ...aiFollowUpDueItems]
    .filter((item, index, array) => array.findIndex((x) => x.lead.id === item.lead.id) === index)
    .sort(sortByNextAction);
  const hotItems = leadsWithNextAction
    .filter((item) => getLeadTemperature(item.lead) === "Hot")
    .sort((a, b) => getLeadScore(b.lead) - getLeadScore(a.lead));
  const warmItems = leadsWithNextAction
    .filter((item) => getLeadTemperature(item.lead) === "Warm")
    .sort(sortByNextAction);
  const newMatchItems = warmItems.length > 0 ? warmItems : leadsWithNextAction.slice(0, 5);

  const hotCount = leads.filter((lead) => getLeadTemperature(lead) === "Hot").length;
  const negotiatingCount = leads.filter((lead) => (lead.status || "") === "Đang đàm phán").length;
  const closedCount = leads.filter((lead) => (lead.status || "") === "Đã chốt").length;

  const kpiCards: KpiCard[] = [
    { label: "Cần gọi hôm nay", value: callNowItems.length, icon: "☎", change: "33% so với hôm qua", href: "/admin/customers?filter=call_now", tone: "blue" },
    { label: "Có nhà mới phù hợp", value: Math.min(newMatchItems.length, 5), icon: "🏠", change: "25% so với hôm qua", href: "/admin/customers?filter=new_matches", tone: "green" },
    { label: "Lịch xem hôm nay", value: 2, icon: "📅", change: "Không đổi", href: "/admin/customers?filter=appointments_today", tone: "orange" },
    { label: "Khách nóng (Hot)", value: hotCount, icon: "👥", change: "20% so với tuần trước", href: "/admin/customers?temperature=Hot", tone: "purple" },
    { label: "Đàm phán", value: negotiatingCount, icon: "💼", change: "50% so với tuần trước", href: "/admin/customers?status=Đang%20đàm%20phán", tone: "red" },
    { label: "Đã chốt tháng này", value: closedCount, icon: "✓", change: "75% so với tháng trước", href: "/admin/customers?status=Đã%20chốt", tone: "green" },
  ];

  return (
    <div className="dashboard-page">
        <header className="crm-header">
          <div>
            <h1>Xin chào, Toàn 👋</h1>
            <p>AI đã sẵn sàng hỗ trợ bạn chốt nhiều giao dịch hôm nay!</p>
          </div>
          <div className="header-actions">
            <div className="search-box">⌕ <span>Tìm khách hàng, SĐT, nhu cầu, dự án...</span><kbd>⌘K</kbd></div>
            <div className="bell">🔔<sup>12</sup></div>
            <div className="user-chip">
              <div className="avatar">T</div>
              <div><strong>Toàn</strong><span>Sales</span></div>
            </div>
          </div>
        </header>

        {error && <div className="error-box">Không tải được dashboard: {error}</div>}

        <KpiCards cards={kpiCards} />

        <section className="top-grid">
          <div className="card action-center">
            <h2>AI Gợi ý việc cần làm</h2>
            <p>AI đã phân tích và sắp xếp theo mức độ ưu tiên</p>
            <div className="action-grid">
              <ActionColumn
                title={`🔥 Ưu tiên cao (${highPriorityItems.length})`}
                subtitle="Cần xử lý trước"
                tone="red"
                items={highPriorityItems}
                badgeBuilder={(item) => `${Math.min(99, Math.max(10, getLeadScore(item.lead)))}%`}
                actionIcon="☎"
                viewAllHref="/admin/customers?filter=high_priority"
              />
              <ActionColumn
                title={`📞 Nên làm hôm nay (${todaysActions.length})`}
                subtitle="Không để nguội lead"
                tone="orange"
                items={todaysActions}
                badgeBuilder={(item) => item.nextBestAction.priority}
                actionIcon="✉"
                viewAllHref="/admin/customers?filter=today"
              />
              <ActionColumn
                title={`🏠 Có nhà mới (${Math.min(newMatchItems.length, 5)})`}
                subtitle="Gợi ý gửi khách"
                tone="blue"
                items={newMatchItems}
                badgeBuilder={() => "Mới"}
                actionIcon="⬺"
                viewAllHref="/admin/customers?filter=new_matches"
              />
              <ActionColumn
                title={`⏰ Theo dõi (${followUpItems.length})`}
                subtitle="Cần nhắc lại"
                tone="purple"
                items={followUpItems}
                badgeBuilder={(item) => `${getDaysSince(item.latestActivity?.created_at || item.lead.created_at)} ngày`}
                actionIcon="💬"
                viewAllHref="/admin/customers?filter=follow_up"
              />
            </div>
          </div>
          <TodaySchedule />
        </section>

        <section className="report-grid">
          <FunnelCard />
          <WeeklyPerformance />
          <SourceCard total={leads.length} />
          <AIInsight overdueCount={overdue.length} newMatchCount={Math.min(newMatchItems.length, 5)} hotCount={hotCount} />
        </section>

        <section className="quick-card card">
          <h3>Thao tác nhanh</h3>
          <div className="quick-actions">
            <Link href="/admin/customers">👤 Thêm khách hàng</Link>
            <Link href="/admin/post">🏠 Thêm nhà mới</Link>
            <Link href="/admin/dashboard">☑ Tạo công việc</Link>
            <Link href="/admin/dashboard">📅 Lịch hẹn</Link>
            <Link href="/admin/dashboard">✈ Gửi tin hàng loạt</Link>
            <Link href="/admin/dashboard">📊 Báo cáo nhanh</Link>
          </div>
        </section>

      <style>{`
        * { box-sizing: border-box; }
        .dashboard-page { color: #0f172a; font-family: var(--font-inter), sans-serif; overflow: hidden; }
        .crm-header { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 22px; }
        .crm-header h1 { margin: 0 0 6px; font-size: 25px; }
        .crm-header p { margin: 0; color: #64748b; }
        .header-actions { display: flex; align-items: center; gap: 14px; }
        .search-box { width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; color: #64748b; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 14px rgba(15,23,42,.04); }
        .search-box span { flex: 1; font-size: 14px; }
        .search-box kbd { border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px 7px; color: #64748b; background: #f8fafc; }
        .bell { position: relative; width: 42px; height: 42px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 4px 14px rgba(15,23,42,.05); }
        .bell sup { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; border-radius: 999px; padding: 2px 5px; font-size: 10px; }
        .user-chip { display: flex; align-items: center; gap: 10px; }
        .user-chip span { display: block; color: #64748b; font-size: 12px; }
        .avatar { width: 36px; height: 36px; border-radius: 999px; background: linear-gradient(135deg, #bfdbfe, #2563eb); color: #fff; display: grid; place-items: center; font-weight: 800; flex: 0 0 auto; }
        .error-box { background: #fee2e2; color: #991b1b; padding: 14px; border-radius: 12px; margin-bottom: 16px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
        .kpi-card { background: #fff; border-radius: 16px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; box-shadow: 0 8px 28px rgba(15,23,42,.06); border: 1px solid #eef2f7; color: inherit; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(15,23,42,.1); }
        .kpi-icon { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; font-size: 24px; }
        .kpi-label { color: #475569; font-size: 13px; font-weight: 700; margin-bottom: 7px; }
        .kpi-value { display: block; font-size: 28px; }
        .kpi-change { color: #16a34a; font-size: 12px; margin-top: 12px; white-space: nowrap; }
        .card { background: #fff; border-radius: 16px; box-shadow: 0 8px 28px rgba(15,23,42,.06); border: 1px solid #eef2f7; }
        .top-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; margin-bottom: 18px; }
        .action-center { padding: 20px; }
        .action-center h2 { margin: 0 0 5px; font-size: 22px; }
        .action-center > p { margin: 0 0 18px; color: #64748b; }
        .action-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .action-column { border-radius: 14px; padding: 14px; min-height: 310px; display: flex; flex-direction: column; }
        .action-column-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; }
        .action-column-head span { font-size: 12px; opacity: .8; }
        .action-column-list { display: grid; gap: 10px; }
        .lead-mini-card { background: #fff; border: 1px solid #edf2f7; border-radius: 12px; padding: 10px; display: flex; gap: 10px; color: #0f172a; text-decoration: none; align-items: center; box-shadow: 0 4px 14px rgba(15,23,42,.04); }
        .lead-mini-card .avatar { width: 34px; height: 34px; font-size: 13px; }
        .lead-mini-body { min-width: 0; flex: 1; }
        .lead-mini-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
        .lead-mini-top strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-badge { background: #fee2e2; color: #dc2626; border-radius: 999px; padding: 3px 7px; font-size: 11px; font-weight: 800; }
        .lead-mini-card p { margin: 4px 0 0; color: #64748b; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lead-mini-card em { display: block; margin-top: 4px; color: #ea580c; font-style: normal; font-size: 11px; }
        .action-pill { width: 32px; height: 32px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: grid; place-items: center; }
        .empty-note { color: #64748b; font-size: 13px; padding: 16px 4px; }
        .view-all { margin-top: auto; text-align: center; color: #2563eb; text-decoration: none; font-weight: 700; font-size: 14px; padding-top: 12px; display: block; }
        .schedule-card { padding: 20px; }
        .section-title { font-weight: 800; font-size: 18px; margin-bottom: 18px; }
        .timeline { border: 1px solid #eef2f7; border-radius: 14px; padding: 14px; }
        .timeline-row { display: grid; grid-template-columns: 50px 14px 1fr; gap: 10px; padding: 8px 0; color: inherit; text-decoration: none; }
        .timeline-row:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
        .timeline-time { font-size: 13px; color: #0f172a; font-weight: 700; }
        .timeline-dot { width: 8px; height: 8px; background: #2563eb; border-radius: 999px; margin-top: 5px; }
        .timeline-content strong { display: block; font-size: 14px; }
        .timeline-content span { display: block; margin-top: 4px; color: #334155; font-size: 13px; }
        .timeline-content p { margin: 3px 0 0; color: #64748b; font-size: 13px; }
        .report-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 18px; margin-bottom: 18px; }
        .report-card { padding: 18px; min-height: 250px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
        .section-header h3, .report-card h3, .quick-card h3 { margin: 0; font-size: 18px; }
        .section-header button { border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 8px 10px; color: #64748b; }
        .funnel-wrap { display: grid; grid-template-columns: 1fr 150px; gap: 14px; align-items: center; }
        .funnel-bars { display: grid; gap: 6px; justify-items: center; }
        .funnel-line { height: 24px; clip-path: polygon(8% 0, 92% 0, 100% 100%, 0 100%); }
        .funnel-labels { display: grid; gap: 11px; font-size: 13px; }
        .funnel-labels div { display: flex; justify-content: space-between; gap: 10px; }
        .legend { display: flex; gap: 14px; font-size: 12px; color: #64748b; margin-bottom: 16px; }
        .legend span, .source-list span { display: flex; align-items: center; gap: 7px; }
        .legend i, .source-list i { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
        .bar-chart { height: 160px; display: flex; align-items: end; justify-content: space-between; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-top: 16px; }
        .bar-day { flex: 1; display: grid; justify-items: center; gap: 8px; }
        .bar-group { height: 125px; display: flex; align-items: end; gap: 5px; }
        .bar-group span { width: 8px; border-radius: 999px 999px 0 0; display: block; }
        .bar-day small { color: #64748b; }
        .source-layout { display: grid; grid-template-columns: 145px 1fr; gap: 16px; align-items: center; margin-top: 26px; }
        .donut { width: 140px; height: 140px; border-radius: 50%; background: conic-gradient(#2563eb 0 40%, #10b981 40% 65%, #f59e0b 65% 85%, #8b5cf6 85% 95%, #94a3b8 95% 100%); position: relative; display: grid; place-items: center; }
        .donut:after { content: ""; position: absolute; width: 82px; height: 82px; border-radius: 50%; background: #fff; }
        .donut strong, .donut span { position: relative; z-index: 1; }
        .donut strong { font-size: 24px; align-self: end; }
        .donut span { font-size: 12px; color: #64748b; align-self: start; }
        .source-list { display: grid; gap: 12px; font-size: 13px; }
        .source-list div { display: flex; justify-content: space-between; gap: 12px; }
        .insight-card { padding: 18px; }
        .insight-card h3 { color: #8b5cf6; margin-bottom: 16px; }
        .insight-list { display: grid; gap: 10px; }
        .insight-item { border: 1px solid #eef2f7; border-radius: 12px; padding: 12px; display: grid; grid-template-columns: 34px 1fr 12px; gap: 10px; align-items: center; color: inherit; text-decoration: none; }
        .insight-item:hover { background: #f8fafc; }
        .insight-item > span { width: 34px; height: 34px; border-radius: 11px; background: #f8fafc; display: grid; place-items: center; }
        .insight-item strong { font-size: 13px; }
        .insight-item p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
        .insight-item em { color: #94a3b8; font-style: normal; font-size: 20px; }
        .quick-card { padding: 16px; }
        .quick-actions { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
        .quick-actions a { border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #0f172a; text-decoration: none; padding: 12px; text-align: center; font-weight: 700; font-size: 13px; }
        @media (max-width: 1280px) {
          .kpi-grid { grid-template-columns: repeat(3, 1fr); }
          .top-grid, .report-grid { grid-template-columns: 1fr; }
          .action-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 860px) {
          .crm-header, .header-actions { display: grid; width: 100%; }
          .search-box { width: 100%; }
          .kpi-grid, .action-grid, .quick-actions { grid-template-columns: 1fr; }
          .source-layout, .funnel-wrap { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

