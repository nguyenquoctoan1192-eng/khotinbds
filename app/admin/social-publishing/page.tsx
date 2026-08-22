"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PromoteQueueButton,
  ResetQueueButton,
} from "./QueueControls";
type Account = {
  id: string;
  name: string;
  profile_url: string;
  is_active: boolean;
  posting_mode: "live" | "scheduled";
  start_time: string;
  end_time: string;
  interval_min_minutes: number;
  interval_max_minutes: number;
  max_posts_per_day: number;
};

type Progress = {
  accountId: string;
  pending: number;
  processing: number;
  posted: number;
  failed: number;
  total: number;
};

type Group = {
  id: string;
  name: string;
  url: string;
  district: string | null;
  category: string;
  priority: number;
};

type Job = {
  id: string;
  status: string;
  scheduled_at: string;
  listing_id: string;
  content?: string | null;
  facebook_accounts?: { name: string } | null;
  facebook_groups?: {
    name: string;
    url: string;
    district: string | null;
  } | null;
};

type GroupScanRequest = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  found_count: number;
  saved_count: number;
  last_error: string | null;
};

const panel: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
};

const input: React.CSSProperties = {
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "7px 9px",
  width: "100%",
  boxSizing: "border-box",
};

const button: React.CSSProperties = {
  minHeight: 38,
  border: "1px solid #0f172a",
  borderRadius: 8,
  padding: "7px 12px",
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const danger: React.CSSProperties = {
  ...button,
  minHeight: 32,
  padding: "5px 10px",
  background: "#dc2626",
  borderColor: "#dc2626",
  fontSize: 13,
};

export default function SocialPublishingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    posted: 0,
    failed: 0,
  });

  const [newName, setNewName] = useState("");
  const [newProfileUrl, setNewProfileUrl] = useState("");
  const [groupForm, setGroupForm] = useState({
    name: "",
    url: "",
    district: "",
    category: "general",
    priority: 100,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [groupScan, setGroupScan] = useState<GroupScanRequest | null>(null);
  const [scanningGroups, setScanningGroups] = useState(false);

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.accountId, item])),
    [progress],
  );

  const queueListings = useMemo(() => {
    const byListing = new Map<string, Job & { groupCount: number }>();

    for (const job of jobs) {
      const current = byListing.get(job.listing_id);

      if (!current) {
        byListing.set(job.listing_id, { ...job, groupCount: 1 });
      } else {
        current.groupCount += 1;

        if (job.status === "processing") {
          current.status = "processing";
        }
      }
    }

    return [...byListing.values()];
  }, [jobs]);

  async function load() {
    try {
      const response = await fetch("/api/social/dashboard", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không tải được dữ liệu");
      }

      setAccounts(data.accounts ?? []);
      setProgress(data.progress ?? []);
      setGroups(data.groups ?? []);
      setJobs(data.jobs ?? []);
      setStats(
        data.stats ?? {
          pending: 0,
          processing: 0,
          posted: 0,
          failed: 0,
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được dữ liệu",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void loadGroupScanStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [accounts]);

  function updateAccount(id: string, patch: Partial<Account>) {
    setAccounts((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  async function saveAccount(account: Account) {
    setBusyId(account.id);
    const response = await fetch("/api/social/accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: account.id,
        name: account.name,
        isActive: account.is_active,
        postingMode: account.posting_mode,
        startTime: account.start_time?.slice(0, 5),
        endTime: account.end_time?.slice(0, 5),
        intervalMinMinutes: account.interval_min_minutes,
        intervalMaxMinutes: account.interval_max_minutes,
        maxPostsPerDay: account.max_posts_per_day,
      }),
    });
    const data = await response.json();
    setBusyId(null);

    if (!response.ok) {
      setMessage(data.error || "Không lưu được cấu hình");
      return;
    }

    setMessage(`Đã lưu cấu hình ${account.name}`);
    await load();
  }

  async function addAccount() {
    if (!newName.trim()) return;

    const response = await fetch("/api/social/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        postingMode: accounts.length ? "scheduled" : "live",
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Không thêm được nick");
      return;
    }

    setNewName("");
    setNewProfileUrl("");
    await load();
  }

  async function addGroup() {
    if (!groupForm.name.trim() || !groupForm.url.trim()) {
      setMessage("Nhập tên nhóm và link nhóm");
      return;
    }

    setBusyId("add-group");

    const response = await fetch("/api/social/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(groupForm),
    });
    const data = await response.json();
    setBusyId(null);

    if (!response.ok) {
      setMessage(data.error || "Không thêm được nhóm");
      return;
    }

    setGroupForm({
      name: "",
      url: "",
      district: "",
      category: "general",
      priority: 100,
    });
    setMessage("Đã thêm nhóm Facebook");
    await load();
  }

  async function deleteGroup(group: Group) {
    if (!window.confirm(`Xóa nhóm "${group.name}"?`)) return;

    setBusyId(group.id);
    const response = await fetch(
      `/api/social/groups?id=${encodeURIComponent(group.id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    setBusyId(null);

    if (!response.ok) {
      setMessage(data.error || "Không xóa được nhóm");
      return;
    }

    setMessage(`Đã xóa nhóm ${group.name}`);
    await load();
  }

  async function deleteJob(job: Job) {
    if (job.status === "processing") {
      setMessage("Tin đang được worker xử lý, chưa thể xóa.");
      return;
    }

    if (!window.confirm("Xóa tin này khỏi hàng chờ?")) return;

    setBusyId(job.id);
    const response = await fetch(
      `/api/social/jobs?listingId=${encodeURIComponent(job.listing_id)}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    setBusyId(null);

    if (!response.ok) {
      setMessage(data.error || "Không xóa được tin");
      return;
    }

    setMessage("Đã xóa toàn bộ lịch đăng của tin khỏi hàng chờ");
    await load();
  }


  async function loadGroupScanStatus() {
    const accountId = accounts.find((item) => item.is_active)?.id || accounts[0]?.id;
    if (!accountId) return;

    const response = await fetch(
      `/api/social/group-scan/request?accountId=${encodeURIComponent(accountId)}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setGroupScan(data.request ?? null);
      setScanningGroups(
        data.request?.status === "pending" || data.request?.status === "processing",
      );
      if (data.request?.status === "completed") {
        await load();
      }
    }
  }

  async function requestGroupScan() {
    const accountId = accounts.find((item) => item.is_active)?.id || accounts[0]?.id;
    if (!accountId) {
      setMessage("Chưa có tài khoản Facebook để quét nhóm.");
      return;
    }

    setScanningGroups(true);
    const response = await fetch("/api/social/group-scan/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setScanningGroups(false);
      setMessage(data.error || "Không tạo được yêu cầu quét nhóm");
      return;
    }

    setGroupScan(data.request ?? null);
    setMessage("Đã gửi yêu cầu. Worker sẽ mở Facebook và quét toàn bộ nhóm đã tham gia.");
  }

  return (
    <main
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        padding: 24,
        fontFamily: "var(--font-inter)",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>AI Social Publisher</h1>
          <p style={{ color: "#64748b" }}>
            Quản lý nick, nhóm Facebook và hàng chờ đăng.
          </p>
        </div>
        <button style={button} onClick={() => void load()}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {message ? (
        <div style={{ ...panel, marginBottom: 16, background: "#f8fafc" }}>
          {message}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(150px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} style={panel}>
            <strong style={{ fontSize: 28 }}>{value}</strong>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              {key === "pending"
                ? "Chờ đăng"
                : key === "processing"
                  ? "Đang đăng"
                  : key === "posted"
                    ? "Đã đăng"
                    : "Thất bại"}
            </div>
          </div>
        ))}
      </section>

      <section style={{ ...panel, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Thêm nick Facebook</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px,1fr) minmax(320px,2fr) auto",
            gap: 8,
          }}
        >
          <input
            style={input}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Tên nick, ví dụ: Facebook chính"
          />
          <input
            style={input}
            value={newProfileUrl}
            onChange={(event) => setNewProfileUrl(event.target.value)}
            placeholder="Link nick đã đăng nhập: https://www.facebook.com/..."
          />
          <button style={button} onClick={() => void addAccount()}>
            Thêm nick
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 14, marginBottom: 16 }}>
        {accounts.map((account) => {
          const row = progressMap.get(account.id);
          const isLive = account.posting_mode === "live";

          return (
            <article key={account.id} style={panel}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{account.name}</h2>
                  <a
                    href={account.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 5,
                      color: "#2563eb",
                      fontSize: 13,
                    }}
                  >
                    {account.profile_url || "Chưa có link Facebook"}
                  </a>
                  <div
                    style={{
                      marginTop: 6,
                      color: isLive ? "#15803d" : "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    {isLive
                      ? "🟢 LIVE – tin tới là đăng ngay"
                      : "🕒 Scheduled"}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  Đã đăng {row?.posted ?? 0}/{row?.total ?? 0} · Chờ{" "}
                  {row?.pending ?? 0} · Đang đăng {row?.processing ?? 0}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <label style={{ gridColumn: "span 2" }}>
                  <span>Link Facebook đã đăng nhập</span>
                  <input
                    style={input}
                    value={account.profile_url || ""}
                    onChange={(event) =>
                      updateAccount(account.id, {
                        profile_url: event.target.value,
                      })
                    }
                    placeholder="https://www.facebook.com/..."
                  />
                </label>

                <label>
                  <span>Chế độ</span>
                  <select
                    style={input}
                    value={account.posting_mode}
                    onChange={(event) =>
                      updateAccount(account.id, {
                        posting_mode:
                          event.target.value as Account["posting_mode"],
                      })
                    }
                  >
                    <option value="live">LIVE</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </label>

                <label>
                  <span>Hoạt động</span>
                  <select
                    style={input}
                    value={account.is_active ? "on" : "off"}
                    onChange={(event) =>
                      updateAccount(account.id, {
                        is_active: event.target.value === "on",
                      })
                    }
                  >
                    <option value="on">Bật</option>
                    <option value="off">Tắt</option>
                  </select>
                </label>

                {!isLive ? (
                  <>
<label>
                      <span>Bắt đầu</span>
                      <input
                        type="time"
                        style={input}
                        value={account.start_time?.slice(0, 5)}
                        onChange={(event) =>
                          updateAccount(account.id, {
                            start_time: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Kết thúc</span>
                      <input
                        type="time"
                        style={input}
                        value={account.end_time?.slice(0, 5)}
                        onChange={(event) =>
                          updateAccount(account.id, {
                            end_time: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Tối đa bài/ngày</span>
                      <input
                        type="number"
                        min={1}
                        style={input}
                        value={account.max_posts_per_day}
                        onChange={(event) =>
                          updateAccount(account.id, {
                            max_posts_per_day: Number(
                              event.target.value,
                            ),
                          })
                        }
                      />
                    </label>
                  </>
                ) : null}

                <label>
                  <span>Khoảng cách tối thiểu (phút)</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    style={input}
                    value={account.interval_min_minutes || 1}
                    onChange={(event) =>
                      updateAccount(account.id, {
                        interval_min_minutes: Math.min(
                          6,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      })
                    }
                  />
                </label>

                <label>
                  <span>Khoảng cách tối đa (phút)</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    style={input}
                    value={account.interval_max_minutes || 6}
                    onChange={(event) =>
                      updateAccount(account.id, {
                        interval_max_minutes: Math.min(
                          6,
                          Math.max(
                            account.interval_min_minutes || 1,
                            Number(event.target.value) || 6,
                          ),
                        ),
                      })
                    }
                  />
                </label>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    style={{ ...button, width: "100%" }}
                    disabled={busyId === account.id}
                    onClick={() => void saveAccount(account)}
                  >
                    {busyId === account.id
                      ? "Đang lưu..."
                      : "Lưu cấu hình"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section style={{ ...panel, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Thêm nhóm Facebook</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "2fr 3fr 1.2fr 1.2fr 90px auto",
            gap: 8,
            alignItems: "end",
          }}
        >
          <label>
            <span>Tên nhóm</span>
            <input
              style={input}
              value={groupForm.name}
              onChange={(event) =>
                setGroupForm({ ...groupForm, name: event.target.value })
              }
              placeholder="Tên nhóm"
            />
          </label>

          <label>
            <span>Link nhóm</span>
            <input
              style={input}
              value={groupForm.url}
              onChange={(event) =>
                setGroupForm({ ...groupForm, url: event.target.value })
              }
              placeholder="https://www.facebook.com/groups/..."
            />
          </label>

          <label>
            <span>Quận áp dụng</span>
            <input
              style={input}
              value={groupForm.district}
              onChange={(event) =>
                setGroupForm({
                  ...groupForm,
                  district: event.target.value,
                })
              }
              placeholder="Phú Nhuận"
            />
          </label>

          <label>
            <span>Loại nhóm</span>
            <select
              style={input}
              value={groupForm.category}
              onChange={(event) =>
                setGroupForm({
                  ...groupForm,
                  category: event.target.value,
                })
              }
            >
              <option value="general">Tổng hợp</option>
              <option value="whole-house">Nhà nguyên căn</option>
              <option value="frontage">Mặt tiền</option>
              <option value="business">Mặt bằng</option>
              <option value="office">Văn phòng</option>
              <option value="room">Phòng trọ</option>
            </select>
          </label>

          <label>
            <span>Ưu tiên</span>
            <input
              type="number"
              min={1}
              style={input}
              value={groupForm.priority}
              onChange={(event) =>
                setGroupForm({
                  ...groupForm,
                  priority: Number(event.target.value) || 100,
                })
              }
            />
          </label>

          <button
            style={button}
            disabled={busyId === "add-group"}
            onClick={() => void addGroup()}
          >
            {busyId === "add-group" ? "Đang thêm..." : "Thêm nhóm"}
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
          gap: 16,
        }}
      >
        <div style={panel}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>
              Nhóm đang hoạt động ({groups.length})
            </h2>

            <button
              type="button"
              style={{ ...button, background: "#0f766e", borderColor: "#0f766e" }}
              disabled={scanningGroups || !accounts.length}
              onClick={() => void requestGroupScan()}
            >
              {scanningGroups ? "Đang quét nhóm..." : "Quét tất cả nhóm Facebook"}
            </button>
          </div>

          {groupScan ? (
            <div
              style={{
                marginBottom: 10,
                padding: "9px 10px",
                borderRadius: 8,
                background: "#f0fdfa",
                color: groupScan.status === "failed" ? "#b91c1c" : "#115e59",
                fontSize: 13,
              }}
            >
              {groupScan.status === "pending"
                ? "Đang chờ worker nhận yêu cầu quét nhóm..."
                : groupScan.status === "processing"
                  ? "Worker đang mở Facebook và quét danh sách nhóm..."
                  : groupScan.status === "completed"
                    ? `Đã quét ${groupScan.found_count} nhóm, tự động lưu ${groupScan.saved_count} nhóm.`
                    : `Quét nhóm thất bại: ${groupScan.last_error || "Không rõ lỗi"}`}
            </div>
          ) : null}

          <div style={{ maxHeight: 500, overflow: "auto" }}>
            {groups.map((group) => (
              <div
                key={group.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <strong>{group.name}</strong>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {group.district || "Tự đọc quận từ tên nhóm"} ·{" "}
                    {group.category} · ưu tiên {group.priority}
                  </div>
                  <a href={group.url} target="_blank" rel="noreferrer">
                    Mở nhóm
                  </a>
                </div>

                <button
                  style={danger}
                  disabled={busyId === group.id}
                  onClick={() => void deleteGroup(group)}
                >
                  {busyId === group.id ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={panel}>
          <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  }}
>
  <h2 style={{ margin: 0 }}>
    Hàng chờ ({queueListings.length} tin)
  </h2>

  <ResetQueueButton
    onChanged={load}
    setMessage={setMessage}
  />
</div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th align="left">Thời gian</th>
                  <th align="left">Nội dung tin</th>
                  <th align="left">Nhóm</th>
                  <th align="left">Trạng thái</th>
                  <th align="right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {queueListings.map((job) => {
                  const lines = String(job.content || "")
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);

                  const title =
                    lines[0] || "Tin chưa có nội dung";

                  const preview =
                    lines.slice(1, 3).join(" · ");

                  return (
                    <tr
                      key={job.id}
                      style={{
                        borderTop: "1px solid #e2e8f0",
                        verticalAlign: "top",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 4px",
                          width: 130,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(
                          job.scheduled_at,
                        ).toLocaleString("vi-VN")}
                      </td>

                      <td
                        style={{
                          padding: "10px 8px",
                          minWidth: 320,
                          maxWidth: 440,
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            lineHeight: 1.4,
                          }}
                        >
                          {title}
                        </strong>

                        {preview ? (
                          <div
                            style={{
                              marginTop: 5,
                              color: "#64748b",
                              fontSize: 12,
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {preview}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 6,
                            color: "#64748b",
                            fontSize: 12,
                          }}
                        >
                          Nick:{" "}
                          {job.facebook_accounts?.name ||
                            "-"}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setViewingJob(job)
                          }
                          style={{
                            marginTop: 7,
                            border: "none",
                            background: "transparent",
                            color: "#2563eb",
                            padding: 0,
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Xem toàn bộ nội dung
                        </button>
                      </td>

                      <td
                        style={{
                          padding: "10px 8px",
                          minWidth: 220,
                        }}
                      >
                        {job.facebook_groups?.name || "-"}
                        {job.groupCount > 1 ? (
                          <div style={{ marginTop: 5, color: "#64748b", fontSize: 12 }}>
                            Tổng cộng {job.groupCount} nhóm
                          </div>
                        ) : null}
                      </td>

                      <td
                        style={{
                          padding: "10px 8px",
                        }}
                      >
                        {job.status === "pending"
                          ? "Chờ đăng"
                          : job.status ===
                              "processing"
                            ? "Đang đăng"
                            : job.status === "failed"
                              ? "Thất bại"
                              : job.status}
                      </td>



                      <td
                        align="right"
                        style={{
                          padding: "10px 4px",
                          minWidth: 190,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <PromoteQueueButton
                            listingId={job.listing_id}
                            disabled={
                              job.status === "processing" ||
                              busyId === job.id
                            }
                            onChanged={load}
                            setMessage={setMessage}
                          />

                          <button
                            type="button"
                            style={danger}
                            disabled={
                              job.status === "processing" ||
                              busyId === job.id
                            }
                            onClick={() => void deleteJob(job)}
                          >
                            {busyId === job.id
                              ? "Đang xóa..."
                              : "Xóa tin"}
                          </button>
                        </div>
                      </td>
</tr>
                  );
                })}

                {!queueListings.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      Hàng chờ đang trống
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {viewingJob ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setViewingJob(null)}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "86vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              padding: 20,
              boxShadow:
                "0 24px 70px rgba(0,0,0,0.3)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0 }}>
                Nội dung tin đăng
              </h2>

              <button
                type="button"
                onClick={() =>
                  setViewingJob(null)
                }
                style={{
                  width: 38,
                  height: 38,
                  border: "none",
                  borderRadius: 9,
                  background: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 23,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.65,
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#f8fafc",
                padding: 16,
              }}
            >
              {viewingJob.content ||
                "Tin này chưa có nội dung"}
            </div>

            <div
              style={{
                marginTop: 12,
                color: "#64748b",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div>
                Nick:{" "}
                {viewingJob
                  .facebook_accounts?.name || "-"}
              </div>
              <div>
                Nhóm:{" "}
                {viewingJob
                  .facebook_groups?.name || "-"}
              </div>
              <div>
                Trạng thái:{" "}
                {viewingJob.status}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                style={button}
                onClick={() =>
                  setViewingJob(null)
                }
              >
                Đóng
              </button>

              {viewingJob.status !==
              "processing" ? (
                <button
                  type="button"
                  style={danger}
                  disabled={
                    busyId === viewingJob.id
                  }
                  onClick={async () => {
                    const current =
                      viewingJob;
                    await deleteJob(current);
                    setViewingJob(null);
                  }}
                >
                  {busyId === viewingJob.id
                    ? "Đang xóa..."
                    : "Xóa tin này"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}

