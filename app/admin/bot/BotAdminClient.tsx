"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient, syncServerSession } from "@/lib/userRole";
import styles from "./BotAdminClient.module.css";

type LicenseRow = {
  id: string;
  name: string;
  license_key_prefix: string;
  is_active: boolean;
  max_devices: number;
  max_facebook_accounts: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type DeviceRow = {
  id: string;
  license_id: string;
  device_uid: string;
  device_name: string | null;
  platform: string | null;
  app_version: string | null;
  is_active: boolean;
  last_ip: string | null;
  last_seen_at: string | null;
  token_expires_at: string | null;
  created_at: string;
  current_status: "starting" | "idle" | "syncing" | "processing" | "posting" | "success" | "error" | "stopping" | null;
  status_message: string | null;
  current_job_id: string | null;
  current_step: string | null;
  progress_percent: number | null;
  current_group_count: number | null;
  total_group_count: number | null;
  last_error: string | null;
  activity_updated_at: string | null;
};

type FacebookAccountRow = {
  id: string;
  name: string;
  profile_url: string | null;
  is_active: boolean;
  license_id: string | null;
  last_group_sync_at: string | null;
  synced_group_count: number | null;
  created_at: string;
};

type FacebookGroupRow = {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  facebook_account_id: string | null;
  facebook_group_id: string | null;
  source: string | null;
  last_synced_at: string | null;
};

type JobRow = {
  id: string;
  listing_id: string;
  facebook_account_id: string;
  facebook_group_id: string;
  status: "pending" | "processing" | "posted" | "failed" | "cancelled" | string;
  scheduled_at: string;
  posted_at: string | null;
  last_error: string | null;
  attempt_count: number;
  created_at: string;
};

type DashboardData = {
  licenses: LicenseRow[];
  devices: DeviceRow[];
  accounts: FacebookAccountRow[];
  groups: FacebookGroupRow[];
  jobs: JobRow[];
  serverTime: string;
};

type Tab = "overview" | "licenses" | "devices" | "facebook" | "groups" | "activity";

const navItems = [
  ["/admin", "⌂", "Trang chủ"],
  ["/admin/dashboard", "▣", "Dashboard"],
  ["/admin/social-publishing", "➤", "AI Đăng Tin"],
  ["/admin/bot", "🤖", "Quản lý Bot"],
  ["/admin/post", "✎", "Đăng tin"],
  ["/admin/customers", "♙", "Khách hàng"],
  ["/admin/listing-library", "▤", "Kho tin đăng"],
  ["/admin/agents", "♧", "Quản lý môi giới"],
] as const;

const emptyData: DashboardData = {
  licenses: [],
  devices: [],
  accounts: [],
  groups: [],
  jobs: [],
  serverTime: new Date().toISOString(),
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
}

function isOnline(lastSeenAt: string | null, nowMs: number): boolean {
  if (!lastSeenAt) return false;
  const value = new Date(lastSeenAt).getTime();
  return Number.isFinite(value) && nowMs - value <= 2 * 60 * 1000;
}

function ago(value: string | null, nowMs: number): string {
  if (!value) return "Chưa hoạt động";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";
  const ms = Math.max(0, nowMs - time);
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))} giây trước`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} phút trước`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} giờ trước`;
  return shortDate(value);
}

function jobLabel(status: string): string {
  if (status === "processing") return "Đang đăng";
  if (status === "posted") return "Thành công";
  if (status === "failed") return "Thất bại";
  if (status === "cancelled") return "Đã hủy";
  return "Chờ đăng";
}

export default function BotAdminClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [createdLicenseKey, setCreatedLicenseKey] =
  useState<string | null>(null);
  const [licenseName, setLicenseName] = useState("");
  const [maxDevices, setMaxDevices] = useState(1);
  const [maxFacebookAccounts, setMaxFacebookAccounts] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/bot", { cache: "no-store" });
      const json = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(json.error || "Không tải được dữ liệu Bot");
      setData(json);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được dữ liệu Bot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const navbar = document.querySelector<HTMLElement>(".site-navbar");
    if (!navbar) return;
    const previousDisplay = navbar.style.display;
    navbar.style.display = "none";
    return () => {
      navbar.style.display = previousDisplay;
    };
  }, []);

  const nowMs = Date.now();
  const licenseById = useMemo(() => new Map(data.licenses.map((item) => [item.id, item])), [data.licenses]);
  const accountById = useMemo(() => new Map(data.accounts.map((item) => [item.id, item])), [data.accounts]);
  const groupById = useMemo(() => new Map(data.groups.map((item) => [item.id, item])), [data.groups]);

  const onlineDevices = useMemo(
    () => data.devices.filter((device) => device.is_active && isOnline(device.last_seen_at, nowMs)),
    [data.devices, nowMs],
  );

  const jobCounts = useMemo(
    () => ({
      pending: data.jobs.filter((job) => job.status === "pending").length,
      processing: data.jobs.filter((job) => job.status === "processing").length,
      posted: data.jobs.filter((job) => job.status === "posted").length,
      failed: data.jobs.filter((job) => job.status === "failed").length,
    }),
    [data.jobs],
  );

  const expiring = useMemo(
    () =>
      data.licenses
        .filter((license) => {
          if (!license.is_active || !license.expires_at) return false;
          const remaining = new Date(license.expires_at).getTime() - nowMs;
          return remaining > 0 && remaining <= 14 * 86_400_000;
        })
        .slice(0, 4),
    [data.licenses, nowMs],
  );

  const queueJobs = useMemo(
    () =>
      data.jobs
        .filter((job) => job.status === "pending" || job.status === "processing")
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [data.jobs],
  );

  const filteredGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLocaleLowerCase("vi-VN");
    return data.groups.filter((group) => {
      const matchesSearch = !keyword || group.name.toLocaleLowerCase("vi-VN").includes(keyword);
      const matchesFilter = groupFilter === "all" || (groupFilter === "active" ? group.is_active : !group.is_active);
      return matchesSearch && matchesFilter;
    });
  }, [data.groups, groupFilter, groupSearch]);

  const botCards = useMemo(() => {
    return data.devices.map((device) => {
      const license = licenseById.get(device.license_id);
      const accounts = data.accounts.filter((account) => account.license_id === device.license_id);
      const activeJob = data.jobs.find(
        (job) => job.status === "processing" && accounts.some((account) => account.id === job.facebook_account_id),
      );
      const nextJob = data.jobs.find(
        (job) => job.status === "pending" && accounts.some((account) => account.id === job.facebook_account_id),
      );
      return { device, license, accounts, activeJob, nextJob };
    });
  }, [data.accounts, data.devices, data.jobs, licenseById]);

  async function logout() {
    await Promise.allSettled([authClient.auth.signOut(), syncServerSession()]);
    router.replace("/");
    router.refresh();
  }

  async function createLicense() {
  if (!licenseName.trim()) {
    setMessage(
      "Nhập tên license trước khi tạo.",
    );
    return;
  }

  setBusy("create");

  try {
    const response = await fetch(
      "/api/admin/bot",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: licenseName.trim(),
          licenseType: "admin",
          ownerUserId: null,
          maxDevices,
          maxFacebookAccounts,
          expiresAt: expiresAt || null,
        }),
      },
    );

    const json = (await response.json()) as {
      error?: string;
      licenseKey?: string;
    };

    if (!response.ok) {
      throw new Error(
        json.error ||
          "Không tạo được license",
      );
    }

    const fullLicenseKey = String(
      json.licenseKey ?? "",
    ).trim();

    if (!fullLicenseKey) {
      throw new Error(
        "Đã tạo license nhưng API không trả về key đầy đủ",
      );
    }

    setLicenseName("");
    setExpiresAt("");

    setMessage(
      `LICENSE_KEY=${fullLicenseKey}`,
    );

    await navigator.clipboard
      .writeText(
        `LICENSE_KEY=${fullLicenseKey}`,
      )
      .catch(() => undefined);

    window.alert(
      [
        "Tạo license thành công.",
        "",
        `LICENSE_KEY=${fullLicenseKey}`,
        "",
        "Key đã được tự động copy.",
        "Hãy dán ngay vào file .env của Worker.",
      ].join("\n"),
    );

    await load();
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Không tạo được license";

    setMessage(errorMessage);
    window.alert(errorMessage);
  } finally {
    setBusy(null);
  }
}

  async function updateItem(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const response = await fetch("/api/admin/bot", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Không cập nhật được dữ liệu");
      setMessage("Đã cập nhật thành công.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không cập nhật được dữ liệu");
    } finally {
      setBusy(null);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Tổng quan" },
    { id: "licenses", label: "License" },
    { id: "devices", label: "Thiết bị" },
    { id: "facebook", label: "Facebook" },
    { id: "groups", label: "Nhóm" },
    { id: "activity", label: "Nhật ký hoạt động" },
  ];

  return (
    <div className={styles.shell}>
      {createdLicenseKey && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "rgba(15, 23, 42, 0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        background: "#ffffff",
        borderRadius: 16,
        padding: 28,
        boxShadow: "0 24px 70px rgba(0,0,0,0.3)",
      }}
    >
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: 24,
        }}
      >
        Tạo license thành công
      </h2>

      <p
        style={{
          margin: "0 0 18px",
          color: "#64748b",
        }}
      >
        Key này chỉ hiển thị một lần. Hãy sao chép
        ngay vào file .env của Facebook Worker.
      </p>

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 10,
          background: "#f1f5f9",
          border: "1px solid #cbd5e1",
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 700,
          wordBreak: "break-all",
          marginBottom: 18,
        }}
      >
        {createdLicenseKey}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            void navigator.clipboard.writeText(
              `LICENSE_KEY=${createdLicenseKey}`,
            )
          }
        >
          Copy LICENSE_KEY
        </button>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() =>
            setCreatedLicenseKey(null)
          }
        >
          Đã lưu key
        </button>
      </div>
    </div>
  </div>
)}
      {menuOpen && <button className={styles.overlay} aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🤖</div>
          <div className={styles.brandText}>
            <strong>BDS</strong>
            <span>TRUNG TÂM ĐIỀU KHIỂN</span>
          </div>
        </div>
        <div className={styles.profile}>
          <div className={styles.avatar}>A</div>
          <div className={styles.profileMeta}>
            <strong>Admin</strong>
            <span>Quản trị viên</span>
          </div>
          <span className={styles.onlineDot} />
        </div>
        <nav className={styles.nav}>
          {navItems.map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`${styles.navLink} ${href === "/admin/bot" ? styles.navActive : ""}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.support}>
          <strong>Hỗ trợ kỹ thuật</strong>
          <span>Quản lý license, thiết bị, queue và kết nối Bot.</span>
        </div>
        <button className={styles.navButton} onClick={() => void logout()}>
          <span className={styles.navIcon}>↪</span>
          Đăng xuất
        </button>
        <div className={styles.version}>© 2026 BDS · Control Center 1.1</div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mobileTop}>
          <strong>BDS Bot</strong>
          <button className={styles.menuButton} onClick={() => setMenuOpen(true)}>☰</button>
        </div>

        <header className={styles.header}>
          <div className={styles.title}>
            <span className={styles.eyebrow}>BOT MANAGEMENT</span>
            <h1>Trung tâm điều khiển Bot</h1>
            <p>Giám sát trực tiếp thiết bị, hàng chờ, Facebook và hoạt động đăng bài.</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.autoRefresh}><span className={styles.refreshDot} />Tự động làm mới: 10s</span>
            <button className={styles.button} onClick={() => void load()} disabled={loading}>↻</button>
            <button
              className={styles.primaryButton}
              onClick={() => {
                setTab("overview");
                document.getElementById("create-license")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              ＋ Tạo license mới
            </button>
          </div>
        </header>

        {message && (
          <div className={styles.message}>
            <span>{message}</span>
            <button onClick={() => setMessage("")}>✕</button>
          </div>
        )}

        <section className={styles.kpis}>
          <article className={styles.kpi}>
            <div className={`${styles.kpiIcon} ${styles.kpiGreen}`}>●</div>
            <div><div className={styles.kpiLabel}>Trạng thái Bot</div><div className={styles.kpiValue}>{onlineDevices.length} / {data.devices.length}</div><div className={styles.kpiHint}>{onlineDevices.length} online · {Math.max(0, data.devices.length - onlineDevices.length)} offline</div></div>
          </article>
          <article className={styles.kpi}>
            <div className={`${styles.kpiIcon} ${styles.kpiOrange}`}>⌛</div>
            <div><div className={styles.kpiLabel}>Chờ đăng</div><div className={styles.kpiValue}>{jobCounts.pending}</div><div className={styles.kpiHint}>Đang nằm trong queue</div></div>
          </article>
          <article className={styles.kpi}>
            <div className={`${styles.kpiIcon} ${styles.kpiBlue}`}>↻</div>
            <div><div className={styles.kpiLabel}>Đang đăng</div><div className={styles.kpiValue}>{jobCounts.processing}</div><div className={styles.kpiHint}>Đang xử lý trực tiếp</div></div>
          </article>
          <article className={styles.kpi}>
            <div className={`${styles.kpiIcon} ${styles.kpiPurple}`}>✓</div>
            <div><div className={styles.kpiLabel}>Thành công</div><div className={styles.kpiValue}>{jobCounts.posted}</div><div className={styles.kpiHint}>Theo dữ liệu gần nhất</div></div>
          </article>
          <article className={styles.kpi}>
            <div className={`${styles.kpiIcon} ${styles.kpiRed}`}>!</div>
            <div><div className={styles.kpiLabel}>Thất bại</div><div className={styles.kpiValue}>{jobCounts.failed}</div><div className={styles.kpiHint}>Cần kiỒm tra</div></div>
          </article>
        </section>

        <div className={styles.tabs}>
          {tabs.map((item) => (
            <button key={item.id} className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <section className={styles.sectionBlock}>
              <div className={styles.sectionHeading}>
                <div><h2>Bot đang làm gì</h2><p>Mỗi thiết bị là một card riêng, sẵn sàng mở rộng khi có nhiều môi giới.</p></div>
                <button className={styles.ghostButton} onClick={() => setTab("devices")}>Xem thiết bị</button>
              </div>
              <div className={styles.botGrid}>
                {botCards.slice(0, 6).map(({ device, license, accounts, activeJob, nextJob }) => {
                  const online = device.is_active && isOnline(device.last_seen_at, nowMs);
                  const current = activeJob ?? nextJob;
                  const group = current ? groupById.get(current.facebook_group_id) : undefined;
                  const account = current ? accountById.get(current.facebook_account_id) : accounts[0];
                  return (
                    <article className={styles.botCard} key={device.id}>
                      <div className={styles.botCardTop}>
                        <div className={styles.deviceIcon}>▣</div>
                        <div className={styles.botIdentity}><strong>{device.device_name || "Thiết bị Windows"}</strong><span>{device.device_uid}</span></div>
                        <span className={`${styles.badge} ${online ? styles.badgeGreen : styles.badgeGray}`}>{online ? "Online" : "Offline"}</span>
                      </div>
                      <div className={styles.botMeta}>
                        <span>License <strong>{license?.name || "—"}</strong></span>
                        <span>Facebook <strong>{account?.name || "Chưa kết nối"}</strong></span>
                        <span>Phiên bản <strong>{device.app_version || "Chưa có"}</strong></span>
                        <span>Hoạt động <strong>{ago(device.last_seen_at, nowMs)}</strong></span>
                      </div>
                      <div className={`${styles.liveWork} ${activeJob ? styles.liveWorkActive : ""}`}>
                        <div className={styles.liveWorkHeader}><span>{activeJob ? "Đang đăng bài" : nextJob ? "Đang chờ lịch" : online ? "Đang rảnh" : "Không hoạt động"}</span><strong>{current ? jobLabel(current.status) : "—"}</strong></div>
                        <div className={styles.liveWorkTitle}>{group?.name || "Chưa có công việc mới"}</div>
                        <div className={styles.progressTrack}><span style={{ width: `${device.progress_percent ?? (activeJob ? 68 : nextJob ? 18 : 0)}%` }} /></div>
                        <div className={styles.liveWorkFoot}><span>{current ? `Lịch: ${formatDate(current.scheduled_at)}` : "Chờ job mới"}</span><span>{activeJob ? "Đang xử lý" : nextJob ? "Trong queue" : ""}</span></div>
                      </div>
                    </article>
                  );
                })}
                {!botCards.length && <div className={styles.emptyWide}>Chưa có thiết bị Bot.</div>}
              </div>
            </section>

            <div className={styles.dashboardGrid}>
              <div className={styles.stack}>
                <section className={styles.card}>
                  <div className={styles.cardHeader}><div><h2>Queue đăng bài</h2><p>{queueJobs.length} công việc đang chờ hoặc đang xử lý.</p></div><button className={styles.ghostButton} onClick={() => setTab("activity")}>Xem toàn bộ</button></div>
                  <div className={styles.queueList}>
                    {queueJobs.slice(0, 6).map((job, index) => {
                      const group = groupById.get(job.facebook_group_id);
                      const account = accountById.get(job.facebook_account_id);
                      return (
                        <div className={styles.queueRow} key={job.id}>
                          <div className={styles.queueIndex}>{String(index + 1).padStart(2, "0")}</div>
                          <div className={styles.queueMain}><strong>{group?.name || "Nhóm Facebook"}</strong><span>{account?.name || "Tài khoản Facebook"} · {formatDate(job.scheduled_at)}</span></div>
                          <span className={`${styles.badge} ${job.status === "processing" ? styles.badgeBlue : styles.badgeOrange}`}>{jobLabel(job.status)}</span>
                        </div>
                      );
                    })}
                    {!queueJobs.length && <div className={styles.empty}>Queue đang trống.</div>}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHeader}><div><h2>Hoạt động gần đây</h2><p>8 sự kiện mới nhất của hệ thống.</p></div><button className={styles.ghostButton} onClick={() => setTab("activity")}>Xem nhật ký</button></div>
                  <div className={styles.activityList}>
                    {data.jobs.slice(0, 8).map((job) => {
                      const group = groupById.get(job.facebook_group_id);
                      const ok = job.status === "posted";
                      const fail = job.status === "failed";
                      const processing = job.status === "processing";
                      return (
                        <div className={styles.activityRow} key={job.id}>
                          <span className={styles.activityTime}>{new Date(job.posted_at || job.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className={`${styles.timelineIcon} ${ok ? styles.kpiGreen : fail ? styles.kpiRed : processing ? styles.kpiBlue : styles.kpiOrange}`}>{ok ? "✓" : fail ? "!" : processing ? "↻" : "⌛"}</span>
                          <div className={styles.activityText}><strong>{jobLabel(job.status)}</strong><span>{group?.name || "Nhóm Facebook"}{job.last_error ? ` — ${job.last_error}` : ""}</span></div>
                          <span className={`${styles.badge} ${ok ? styles.badgeGreen : fail ? styles.badgeRed : processing ? styles.badgeBlue : styles.badgeOrange}`}>{job.status}</span>
                        </div>
                      );
                    })}
                    {!data.jobs.length && <div className={styles.empty}>Chưa có hoạt động.</div>}
                  </div>
                </section>
              </div>

              <aside className={styles.stack}>
                <section className={styles.card}>
                  <div className={styles.cardHeader}><h2>License sắp hết hạn</h2><span className={`${styles.badge} ${styles.badgeRed}`}>{expiring.length}</span></div>
                  <div className={styles.cardBody}>
                    {expiring.map((license) => <div className={styles.sideRow} key={license.id}><div><strong>{license.name}</strong><span>{license.license_key_prefix}</span></div><div className={styles.rightText}><strong>{shortDate(license.expires_at)}</strong><span>Cần gia hạn</span></div></div>)}
                    {!expiring.length && <div className={styles.empty}>Không có license sắp hết hạn.</div>}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHeader}><h2>Tài khoản Facebook</h2><span className={`${styles.badge} ${styles.badgeBlue}`}>{data.accounts.length}</span></div>
                  <div className={styles.cardBody}>
                    {data.accounts.slice(0, 5).map((account) => <div className={styles.sideRow} key={account.id}><div><strong>▣ {account.name}</strong><span>{account.synced_group_count ?? 0} nhóm · {account.last_group_sync_at ? ago(account.last_group_sync_at, nowMs) : "Chưa đồng bộ"}</span></div><span className={`${styles.badge} ${account.is_active ? styles.badgeGreen : styles.badgeGray}`}>{account.is_active ? "Bật" : "Tắt"}</span></div>)}
                    {!data.accounts.length && <div className={styles.empty}>Chưa có tài khoản Facebook.</div>}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHeader}><div><h2>Nhóm Facebook</h2><p>Không hiển thị list dài trên dashboard.</p></div><span className={`${styles.badge} ${styles.badgeBlue}`}>{data.groups.length}</span></div>
                  <div className={styles.summaryGrid}>
                    <div><strong>{data.groups.filter((group) => group.is_active).length}</strong><span>Đang bật</span></div>
                    <div><strong>{data.groups.filter((group) => !group.is_active).length}</strong><span>Đang tắt</span></div>
                  </div>
                  <div className={styles.cardFooter}><button className={styles.ghostButton} onClick={() => setTab("groups")}>Tìm kiếm và quản lý nhóm</button></div>
                </section>
              </aside>
            </div>

            <section id="create-license" className={styles.cardCreate}>
              <div className={styles.cardHeader}><div><h2>Tạo license mới</h2><p>License được sinh tự động, không cần nhập hash thủ công.</p></div></div>
              <div className={styles.cardBody}>
                <div className={styles.formGrid}>
                  <input className={styles.input} value={licenseName} onChange={(event) => setLicenseName(event.target.value)} placeholder="Tên môi giới / công ty" />
                  <input className={styles.input} type="number" min={1} value={maxDevices} onChange={(event) => setMaxDevices(Math.max(1, Number(event.target.value) || 1))} title="Thiết bị tối đa" />
                  <input className={styles.input} type="number" min={1} value={maxFacebookAccounts} onChange={(event) => setMaxFacebookAccounts(Math.max(1, Number(event.target.value) || 1))} title="Facebook tối đa" />
                  <input className={styles.input} type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                  <button className={styles.primaryButton} disabled={busy === "create"} onClick={() => void createLicense()}>{busy === "create" ? "Đang tạo..." : "Tạo license"}</button>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "licenses" && <DataCard title="Danh sách license"><table className={styles.table}><thead><tr><th>Tên</th><th>Mã đầu</th><th>Thiết bị</th><th>Facebook</th><th>Hết hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.licenses.map((license) => <tr key={license.id}><td><strong>{license.name}</strong><div className={styles.subText}>Tạo: {formatDate(license.created_at)}</div></td><td>{license.license_key_prefix}</td><td>{license.max_devices}</td><td>{license.max_facebook_accounts}</td><td>{shortDate(license.expires_at)}</td><td><span className={`${styles.badge} ${license.is_active ? styles.badgeGreen : styles.badgeGray}`}>{license.is_active ? "Đang bật" : "Đã khóa"}</span></td><td><button className={license.is_active ? styles.dangerButton : styles.button} disabled={busy === `license-${license.id}`} onClick={() => void updateItem({ type: "license", id: license.id, isActive: !license.is_active }, `license-${license.id}`)}>{license.is_active ? "Khóa" : "Mở lại"}</button></td></tr>)}</tbody></table></DataCard>}

        {tab === "devices" && <DataCard title="Danh sách thiết bị"><table className={styles.table}><thead><tr><th>Thiết bị</th><th>License</th><th>Nền tảng</th><th>Phiên bản</th><th>IP</th><th>Trạng thái</th><th>Lần cuối</th><th>Thao tác</th></tr></thead><tbody>{data.devices.map((device) => { const online = device.is_active && isOnline(device.last_seen_at, nowMs); return <tr key={device.id}><td><strong>{device.device_name || "Thiết bị"}</strong><div className={styles.subText}>{device.device_uid}</div></td><td>{licenseById.get(device.license_id)?.name || "—"}</td><td>{device.platform || "—"}</td><td>{device.app_version || "—"}</td><td>{device.last_ip || "—"}</td><td><span className={`${styles.badge} ${online ? styles.badgeGreen : styles.badgeGray}`}>{online ? "Online" : "Offline"}</span></td><td>{formatDate(device.last_seen_at)}</td><td><div className={styles.actions}><button className={styles.button} disabled={busy === `reset-${device.id}`} onClick={() => void updateItem({ type: "device", id: device.id, isActive: device.is_active, resetToken: true }, `reset-${device.id}`)}>Reset token</button><button className={device.is_active ? styles.dangerButton : styles.button} disabled={busy === `device-${device.id}`} onClick={() => void updateItem({ type: "device", id: device.id, isActive: !device.is_active }, `device-${device.id}`)}>{device.is_active ? "Khóa" : "Mở"}</button></div></td></tr>; })}</tbody></table></DataCard>}

        {tab === "facebook" && <DataCard title="Tài khoản Facebook"><table className={styles.table}><thead><tr><th>Tài khoản</th><th>Nhóm</th><th>License</th><th>Đồng bộ cuối</th><th>Trạng thái</th></tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><div className={styles.subText}>{account.profile_url || "—"}</div></td><td>{account.synced_group_count ?? 0}</td><td>{account.license_id ? licenseById.get(account.license_id)?.name || "—" : "—"}</td><td>{formatDate(account.last_group_sync_at)}</td><td><span className={`${styles.badge} ${account.is_active ? styles.badgeGreen : styles.badgeGray}`}>{account.is_active ? "Đang bật" : "Đã tắt"}</span></td></tr>)}</tbody></table></DataCard>}

        {tab === "groups" && <DataCard title="Nhóm Facebook đã đồng bộ"><div className={styles.filters}><input className={styles.input} value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Tìm tên nhóm..." /><select className={styles.input} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as typeof groupFilter)}><option value="all">Tất cả trạng thái</option><option value="active">Đang bật</option><option value="inactive">Đang tắt</option></select><span className={styles.filterCount}>{filteredGroups.length} nhóm</span></div><table className={styles.table}><thead><tr><th>Tên nhóm</th><th>Tài khoản</th><th>ID</th><th>Nguồn</th><th>Đồng bộ cuối</th><th>Trạng thái</th></tr></thead><tbody>{filteredGroups.map((group) => <tr key={group.id}><td><a href={group.url} target="_blank" rel="noreferrer"><strong>{group.name}</strong></a></td><td>{group.facebook_account_id ? accountById.get(group.facebook_account_id)?.name || "—" : "—"}</td><td>{group.facebook_group_id || "—"}</td><td>{group.source || "—"}</td><td>{formatDate(group.last_synced_at)}</td><td><span className={`${styles.badge} ${group.is_active ? styles.badgeGreen : styles.badgeGray}`}>{group.is_active ? "Đang bật" : "Đã tắt"}</span></td></tr>)}</tbody></table></DataCard>}

        {tab === "activity" && <DataCard title="Nhật ký hoạt động đăng bài"><table className={styles.table}><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Nhóm</th><th>Trạng thái</th><th>Số lần thử</th><th>Lỗi</th></tr></thead><tbody>{data.jobs.map((job) => <tr key={job.id}><td>{formatDate(job.posted_at || job.created_at)}</td><td>{accountById.get(job.facebook_account_id)?.name || "—"}</td><td>{groupById.get(job.facebook_group_id)?.name || job.facebook_group_id}</td><td><span className={`${styles.badge} ${job.status === "posted" ? styles.badgeGreen : job.status === "failed" ? styles.badgeRed : job.status === "processing" ? styles.badgeBlue : styles.badgeOrange}`}>{jobLabel(job.status)}</span></td><td>{job.attempt_count ?? 0}</td><td>{job.last_error || "—"}</td></tr>)}</tbody></table></DataCard>}
      </main>
    </div>
  );

  function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
    return <section className={styles.dataCard}><div className={styles.cardHeader}><h2>{title}</h2><button className={styles.button} onClick={() => void load()}>Làm mới</button></div><div className={styles.tableWrap}>{children}</div></section>;
  }
}

