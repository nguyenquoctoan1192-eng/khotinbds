"use client";

import Link from "next/link";
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
  assigned_to?: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at: string | null;
};

type CrmLead = {
  lead: Lead;
  activities: LeadActivity[];
  assignment: LeadAssignmentResult;
  temperature: "Hot" | "Warm" | "Cold";
  stage: PipelineStage;
  updatedAt: string | null;
};

type PipelineStage =
  | "Hot Lead"
  | "Đang chăm sóc"
  | "Đã gửi nhà"
  | "Hẹn xem"
  | "Đã chốt"
  | "Không tiềm năng";

const pipelineStages: PipelineStage[] = [
  "Hot Lead",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Hẹn xem",
  "Đã chốt",
  "Không tiềm năng",
];

const statusOptions = [
  "Tất cả",
  "Khách mới",
  "Đang chăm sóc",
  "Đã gửi nhà",
  "Đã đi xem",
  "Đang đàm phán",
  "Đã chốt",
  "Hủy",
];

const temperatureOptions = ["Tất cả", "Hot", "Warm", "Cold"];

const menuItems = [
  { label: "Tổng quan", icon: "⌂", href: "/admin/dashboard" },
  { label: "CRM", icon: "☷", href: "/admin/customers", active: true },
  { label: "Khách hàng", icon: "👥", href: "/admin/customers", active: true },
  { label: "Lịch hẹn", icon: "□", href: "/admin/customers?filter=appointments_today" },
  { label: "Công việc", icon: "✓", href: "/admin/customers?filter=today" },
  { label: "Pipeline", icon: "▥", href: "/admin/customers?view=pipeline" },
  { label: "Kho tin", icon: "⌂", href: "/admin/listing-library" },
  { label: "Đăng tin", icon: "+", href: "/admin/post" },
  { label: "Tìm nhà AI", icon: "✦", href: "/tim-nha" },
  { label: "Báo cáo", icon: "◫", href: "/admin/dashboard" },
  { label: "Cài đặt", icon: "⚙", href: "/account" },
];

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const getLeadTemperature = (lead: Lead): CrmLead["temperature"] => {
  if (lead.lead_temperature === "Hot" || lead.lead_temperature === "Warm") {
    return lead.lead_temperature;
  }

  return calculateLeadScoring({
    phone: lead.phone,
    max_price: lead.max_price,
    preferred_districts: lead.preferred_districts,
    note: lead.note,
  }).lead_temperature;
};

const getPipelineStage = (lead: Lead, temperature: CrmLead["temperature"]): PipelineStage => {
  const status = normalizeText(lead.status);

  if (/chot/.test(status)) return "Đã chốt";
  if (/huy|khong|khong tiem nang/.test(status)) return "Không tiềm năng";
  if (/di xem|hen xem|lich hen/.test(status)) return "Hẹn xem";
  if (/gui nha|da gui/.test(status)) return "Đã gửi nhà";
  if (temperature === "Hot" || /khach moi|hot/.test(status)) return "Hot Lead";

  return "Đang chăm sóc";
};

const getDateLabel = (value: string | null) => {
  if (!value) return "Chưa có";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";

  return date.toLocaleDateString("vi-VN");
};

const getInitials = (lead: Lead) =>
  (lead.fullname || "Khách")
    .trim()
    .slice(0, 1)
    .toUpperCase();

const getLatestActivityDate = (lead: Lead, activities: LeadActivity[]) =>
  activities[0]?.created_at || lead.created_at;

function Sidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="brand">
        <span>⌂</span>
        <strong>KhoTinBDS</strong>
      </div>
      <nav>
        {menuItems.map((item) => (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            className={item.active ? "nav-item active" : "nav-item"}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function PipelineCard({ stage, items }: { stage: PipelineStage; items: CrmLead[] }) {
  return (
    <section className="pipeline-col">
      <div className="pipeline-head">
        <strong>{stage}</strong>
        <span>{items.length}</span>
      </div>
      <div className="pipeline-list">
        {items.slice(0, 3).map((item) => (
          <Link
            className="pipeline-lead"
            href={`/admin/customers/${item.lead.id}`}
            key={`${stage}-${item.lead.id}`}
          >
            <div className="mini-avatar">{getInitials(item.lead)}</div>
            <div>
              <strong>{item.lead.fullname || "Khách chưa có tên"}</strong>
              <p>{getCustomerMainNeed(item.lead)}</p>
              <small>{getCustomerNeedTags(item.lead).slice(0, 2).join(" • ") || "Đang bổ sung nhu cầu"}</small>
            </div>
          </Link>
        ))}
        {items.length === 0 && <div className="empty-mini">Chưa có khách.</div>}
      </div>
      <Link className="view-all" href={`/admin/customers?stage=${encodeURIComponent(stage)}`}>
        Xem tất cả
      </Link>
    </section>
  );
}

function CustomerRow({ item }: { item: CrmLead }) {
  const lead = item.lead;
  const tags = getCustomerNeedTags(lead);

  return (
    <tr>
      <td>
        <Link className="customer-cell" href={`/admin/customers/${lead.id}`}>
          <span className="avatar">{getInitials(lead)}</span>
          <span>
            <strong>{lead.fullname || "Khách chưa có tên"}</strong>
            <small>{lead.phone || "Chưa có SĐT"}</small>
          </span>
        </Link>
      </td>
      <td>
        <strong className="need-title">{getCustomerMainNeed(lead)}</strong>
        <div className="tag-row">
          {tags.slice(0, 3).map((tag) => (
            <span key={`${lead.id}-${tag}`}>{tag}</span>
          ))}
        </div>
      </td>
      <td>{formatCustomerDistricts(lead.preferred_districts) || "Chưa rõ"}</td>
      <td>{formatCustomerBudget(lead.max_price)}</td>
      <td>
        <span className={`temp ${item.temperature.toLowerCase()}`}>{item.temperature}</span>
      </td>
      <td>{lead.status || item.stage}</td>
      <td>{item.assignment.assigned_to}</td>
      <td>{getDateLabel(item.updatedAt)}</td>
      <td>
        <div className="actions">
          <Link href={`/admin/customers/${lead.id}`}>Xem</Link>
          {lead.phone && <a href={`tel:${lead.phone}`}>Gọi</a>}
        </div>
      </td>
    </tr>
  );
}

function exportCsv(items: CrmLead[]) {
  const rows = [
    ["Khách hàng", "SĐT", "Nhu cầu", "Khu vực", "Ngân sách", "Mức độ", "Trạng thái"],
    ...items.map((item) => [
      item.lead.fullname || "",
      item.lead.phone || "",
      getCustomerMainNeed(item.lead),
      formatCustomerDistricts(item.lead.preferred_districts),
      formatCustomerBudget(item.lead.max_price),
      item.temperature,
      item.lead.status || item.stage,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "crm-customers.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function CustomersContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Tất cả");
  const [temperature, setTemperature] = useState("Tất cả");
  const [area, setArea] = useState("");
  const [source, setSource] = useState("");
  const [agent, setAgent] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlFilter(params.get("filter") || "");
    setStageFilter(params.get("stage") || "");
  }, []);

  useEffect(() => {
    let mounted = true;

    fetch("/api/leads/list")
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        setLeads(Array.isArray(json.leads) ? json.leads : []);
        setActivities(Array.isArray(json.activities) ? json.activities : []);
        setError(json.success ? "" : json.error || "Không tải được danh sách khách.");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Không tải được danh sách khách.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const crmLeads = useMemo(() => {
    const assignmentMap = buildLeadAssignments(
      leads.map((lead) => ({
        id: lead.id,
        preferred_districts: lead.preferred_districts,
        lead_temperature: getLeadTemperature(lead),
        lead_score: lead.lead_score || undefined,
      }))
    );

    return leads.map((lead) => {
      const leadActivities = activities
        .filter((activity) => activity.lead_id === lead.id)
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        );
      const leadTemperature = getLeadTemperature(lead);

      return {
        lead,
        activities: leadActivities,
        assignment: assignmentMap[lead.id] || {
          assigned_to: "Chưa phân công",
          assignment_reason: "Chưa đủ dữ liệu.",
        },
        temperature: leadTemperature,
        stage: getPipelineStage(lead, leadTemperature),
        updatedAt: getLatestActivityDate(lead, leadActivities),
      };
    });
  }, [activities, leads]);

  const filteredLeads = crmLeads.filter((item) => {
    const searchable = normalizeText([
      item.lead.fullname,
      item.lead.phone,
      getCustomerMainNeed(item.lead),
      getCustomerAISummary(item.lead).join(" "),
      formatCustomerDistricts(item.lead.preferred_districts),
    ].join(" "));
    const matchesSearch = !search || searchable.includes(normalizeText(search));
    const matchesStatus = status === "Tất cả" || (item.lead.status || item.stage) === status;
    const matchesTemp = temperature === "Tất cả" || item.temperature === temperature;
    const matchesArea = !area || normalizeText(formatCustomerDistricts(item.lead.preferred_districts)).includes(normalizeText(area));
    const matchesSource = !source || normalizeText(getCustomerSource(item.lead)).includes(normalizeText(source));
    const matchesAgent = !agent || normalizeText(item.assignment.assigned_to).includes(normalizeText(agent));
    const matchesUrlStage = !stageFilter || item.stage === stageFilter;

    return matchesSearch && matchesStatus && matchesTemp && matchesArea && matchesSource && matchesAgent && matchesUrlStage;
  });

  const hotCount = crmLeads.filter((item) => item.temperature === "Hot").length;
  const nurturingCount = crmLeads.filter((item) => item.stage === "Đang chăm sóc").length;
  const viewingCount = crmLeads.filter((item) => item.stage === "Hẹn xem").length;
  const closedCount = crmLeads.filter((item) => item.stage === "Đã chốt").length;
  const monthlyRevenue = closedCount > 0 ? `${closedCount * 35} triệu` : "0";

  const pipelineGroups = pipelineStages.map((stage) => ({
    stage,
    items: filteredLeads
      .filter((item) => item.stage === stage)
      .sort((a, b) => {
        const tempRank = { Hot: 0, Warm: 1, Cold: 2 };
        return (
          tempRank[a.temperature] - tempRank[b.temperature] ||
          getCustomerPriceValue(b.lead.max_price) - getCustomerPriceValue(a.lead.max_price)
        );
      }),
  }));

  return (
    <div className="crm-shell">
      <Sidebar />
      <main className="crm-main">
        <header className="page-head">
          <div>
            <p>CRM</p>
            <h1>Quản lý và chăm sóc khách hàng</h1>
          </div>
          <Link className="primary-action" href="/tim-nha">
            Tìm nhà AI
          </Link>
        </header>

        {urlFilter && (
          <div className="filter-note">Đang xem bộ lọc: {urlFilter}</div>
        )}

        {error && <div className="error-box">{error}</div>}

        <section className="kpi-grid">
          <KpiCard label="Tổng khách" value={crmLeads.length} sub="Tất cả lead đang quản lý" />
          <KpiCard label="Hot lead" value={hotCount} sub="Cần ưu tiên hôm nay" />
          <KpiCard label="Đang chăm sóc" value={nurturingCount} sub="Có tương tác mở" />
          <KpiCard label="Hẹn xem" value={viewingCount} sub="Lịch hẹn/xem nhà" />
          <KpiCard label="Đã chốt" value={closedCount} sub="Khách đã hoàn tất" />
          <KpiCard label="Doanh số tháng" value={monthlyRevenue} sub="Tạm tính theo deal" />
        </section>

        <section className="filter-bar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tên/SĐT/nhu cầu"
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select value={temperature} onChange={(event) => setTemperature(event.target.value)}>
            {temperatureOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Khu vực" />
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Nguồn" />
          <input value={agent} onChange={(event) => setAgent(event.target.value)} placeholder="Môi giới phụ trách" />
          <button type="button">Bộ lọc</button>
          <button type="button" onClick={() => exportCsv(filteredLeads)}>
            Xuất Excel
          </button>
        </section>

        <section className="pipeline-section">
          <div className="section-title">
            <h2>Pipeline khách hàng</h2>
            <span>{filteredLeads.length} khách phù hợp bộ lọc</span>
          </div>
          <div className="pipeline-grid">
            {pipelineGroups.map((group) => (
              <PipelineCard key={group.stage} stage={group.stage} items={group.items} />
            ))}
          </div>
        </section>

        <section className="table-card">
          <div className="section-title">
            <h2>Bảng khách</h2>
            {loading && <span>Đang tải dữ liệu...</span>}
          </div>
          {!loading && filteredLeads.length === 0 ? (
            <div className="empty-state">Chưa có khách phù hợp bộ lọc.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Nhu cầu chính</th>
                    <th>Khu vực</th>
                    <th>Ngân sách</th>
                    <th>Mức độ</th>
                    <th>Trạng thái</th>
                    <th>Môi giới</th>
                    <th>Cập nhật cuối</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((item) => (
                    <CustomerRow key={item.lead.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <style>{`
        * { box-sizing: border-box; }
        .crm-shell { min-height: 100vh; background: #f4f7fb; display: flex; color: #0f172a; font-family: Arial, sans-serif; }
        .admin-sidebar { width: 248px; flex: 0 0 248px; background: #0f172a; color: #cbd5e1; min-height: 100vh; padding: 22px 16px; position: sticky; top: 0; }
        .brand { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 20px; margin-bottom: 22px; }
        .brand span { width: 36px; height: 36px; border-radius: 12px; background: #2563eb; display: grid; place-items: center; }
        .admin-sidebar nav { display: grid; gap: 6px; }
        .nav-item { color: #cbd5e1; text-decoration: none; display: flex; align-items: center; gap: 11px; padding: 11px 12px; border-radius: 12px; font-size: 14px; }
        .nav-item:hover, .nav-item.active { background: #1e293b; color: #fff; }
        .nav-item.active { box-shadow: inset 3px 0 0 #2563eb; }
        .crm-main { flex: 1; min-width: 0; padding: 28px; }
        .page-head, .section-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 18px; }
        .page-head p { margin: 0 0 6px; color: #2563eb; font-weight: 800; }
        h1, h2 { margin: 0; letter-spacing: 0; }
        h1 { font-size: 28px; }
        h2 { font-size: 20px; }
        .primary-action, .actions a, .view-all { color: #2563eb; text-decoration: none; font-weight: 800; }
        .primary-action { background: #2563eb; color: #fff; padding: 12px 16px; border-radius: 12px; }
        .filter-note, .error-box { border-radius: 14px; padding: 12px 14px; margin-bottom: 16px; }
        .filter-note { background: #eff6ff; color: #1d4ed8; }
        .error-box { background: #fee2e2; color: #991b1b; }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .kpi-card, .pipeline-col, .table-card, .filter-bar { background: #fff; border: 1px solid #e8eef7; border-radius: 16px; box-shadow: 0 10px 28px rgba(15, 23, 42, .06); }
        .kpi-card { padding: 18px; min-height: 124px; }
        .kpi-card span, .kpi-card small, .section-title span { color: #64748b; font-size: 13px; }
        .kpi-card strong { display: block; font-size: 28px; margin: 10px 0 12px; }
        .filter-bar { padding: 14px; display: grid; grid-template-columns: 1.5fr repeat(5, minmax(120px, 1fr)) auto auto; gap: 10px; margin-bottom: 22px; }
        input, select, button { height: 42px; border-radius: 10px; border: 1px solid #dbe3ef; background: #fff; color: #0f172a; padding: 0 12px; font-size: 14px; min-width: 0; }
        button { cursor: pointer; font-weight: 800; }
        button:last-child { background: #2563eb; color: #fff; border-color: #2563eb; }
        .pipeline-section { margin-bottom: 22px; }
        .pipeline-grid { display: grid; grid-template-columns: repeat(6, minmax(190px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .pipeline-col { padding: 14px; min-height: 286px; display: flex; flex-direction: column; }
        .pipeline-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .pipeline-head span { background: #eff6ff; color: #2563eb; border-radius: 999px; padding: 4px 9px; font-weight: 800; font-size: 12px; }
        .pipeline-list { display: grid; gap: 10px; }
        .pipeline-lead { border: 1px solid #edf2f7; border-radius: 12px; padding: 10px; color: inherit; text-decoration: none; display: flex; gap: 10px; min-height: 88px; }
        .pipeline-lead strong, .need-title { display: block; font-size: 14px; }
        .pipeline-lead p, .pipeline-lead small, .customer-cell small { margin: 4px 0 0; color: #64748b; font-size: 12px; display: block; }
        .mini-avatar, .avatar { width: 34px; height: 34px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; display: grid; place-items: center; font-weight: 900; flex: 0 0 auto; }
        .view-all { display: block; text-align: center; margin-top: auto; padding-top: 12px; font-size: 13px; }
        .empty-mini, .empty-state { color: #64748b; padding: 14px; }
        .table-card { padding: 18px; }
        .table-scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 1040px; }
        th { text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 12px 10px; background: #f8fafc; }
        td { border-top: 1px solid #eef2f7; padding: 14px 10px; vertical-align: top; font-size: 14px; }
        .customer-cell { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; }
        .tag-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
        .tag-row span { background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 4px 8px; font-size: 12px; }
        .temp { border-radius: 999px; padding: 5px 9px; font-weight: 800; font-size: 12px; }
        .temp.hot { background: #fee2e2; color: #991b1b; }
        .temp.warm { background: #fef3c7; color: #92400e; }
        .temp.cold { background: #e2e8f0; color: #334155; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 1280px) {
          .kpi-grid { grid-template-columns: repeat(3, 1fr); }
          .filter-bar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .crm-shell { display: block; }
          .admin-sidebar { position: relative; width: 100%; min-height: auto; }
          .crm-main { padding: 18px; }
          .page-head { align-items: flex-start; flex-direction: column; }
          .kpi-grid, .filter-bar { grid-template-columns: 1fr; }
        }
      `}</style>
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
