"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AGENT_AREAS,
  PROFILE_STATUSES,
  PROFILE_STATUS_LABELS,
  type ProfileStatus,
} from "@/lib/agentProfile";

type Agent = {
  id: string;
  full_name: string | null;
  phone: string | null;
  zalo: string | null;
  email: string | null;
  area: string | null;
  status: ProfileStatus;
  created_at: string;
};

const actions: Record<ProfileStatus, { label: string; status: ProfileStatus }[]> = {
  pending: [
    { label: "Duyệt", status: "approved" },
    { label: "Từ chối", status: "rejected" },
    { label: "Tạm khóa", status: "suspended" },
  ],
  approved: [{ label: "Tạm khóa", status: "suspended" }],
  rejected: [{ label: "Duyệt", status: "approved" }],
  suspended: [{ label: "Mở lại", status: "approved" }],
};

export default function AgentsManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    if (area) params.set("area", area);
    if (status) params.set("status", status);
    if (appliedKeyword) params.set("keyword", appliedKeyword);

    try {
      const response = await fetch(`/api/admin/agents?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error);
      setAgents(result.agents || []);
    } catch (error) {
      setAgents([]);
      setMessage(error instanceof Error ? error.message : "Không tải được danh sách môi giới.");
    } finally {
      setLoading(false);
    }
  }, [area, status, appliedKeyword]);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedKeyword(keyword.trim());
  };

  const updateStatus = async (id: string, nextStatus: ProfileStatus) => {
    setUpdatingId(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error);
      setAgents((current) =>
        current.map((agent) => agent.id === id ? { ...agent, status: nextStatus } : agent)
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không cập nhật được trạng thái.");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <section>
      <form className="agents-filters" onSubmit={submitSearch}>
        <select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Lọc khu vực">
          <option value="">Tất cả khu vực</option>
          {AGENT_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái">
          <option value="">Tất cả trạng thái</option>
          {PROFILE_STATUSES.map((item) => <option key={item} value={item}>{PROFILE_STATUS_LABELS[item]}</option>)}
        </select>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tên, điện thoại, Zalo, email..."
          aria-label="Từ khóa"
        />
        <button type="submit">Tìm kiếm</button>
      </form>

      {message && <div className="agents-message">{message}</div>}

      <div className="agents-table-wrap">
        <table className="agents-table">
          <thead>
            <tr>
              <th>Họ tên</th><th>Điện thoại</th><th>Zalo</th><th>Email</th>
              <th>Khu vực</th><th>Trạng thái</th><th>Ngày đăng ký</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Đang tải danh sách...</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={8}>Không có môi giới phù hợp.</td></tr>
            ) : agents.map((agent) => (
              <tr key={agent.id}>
                <td><strong>{agent.full_name || "—"}</strong></td>
                <td>{agent.phone || "—"}</td><td>{agent.zalo || "—"}</td>
                <td>{agent.email || "—"}</td><td>{agent.area || "—"}</td>
                <td><span className={`status-badge status-badge--${agent.status}`}>{PROFILE_STATUS_LABELS[agent.status]}</span></td>
                <td>{new Date(agent.created_at).toLocaleDateString("vi-VN")}</td>
                <td>
                  <div className="agent-actions">
                    {actions[agent.status].map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        disabled={updatingId === agent.id}
                        onClick={() => void updateStatus(agent.id, action.status)}
                        className={`agent-action agent-action--${action.status}`}
                      >{action.label}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
