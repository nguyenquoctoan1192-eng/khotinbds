"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import type { RentalConsultationState } from "@/lib/rentalConsultation";

type LeadQuality = "hot" | "warm" | "cold";

type RentalConsultantResponse = {
  reply: string;
  state: RentalConsultationState;
  next_missing_field: string | null;
  lead_quality: LeadQuality;
  should_handoff: boolean;
  error?: string;
};

const examples = [
  "Cần thuê mặt bằng Quận 1 khoảng 50 triệu",
  "Mở spa Phú Nhuận 80m2 tầm 40tr",
  "Anh là Nam, zalo 0909123456, cần thuê mở cafe Quận 3 100m2 trệt 1 lầu dưới 60tr",
  "Đang lái xe, lát nói",
];

const fieldLabels: Record<string, string> = {
  purpose: "Mục đích thuê",
  business_type: "Lĩnh vực",
  business_category: "Nhóm ngành",
  area: "Khu vực",
  size: "Diện tích",
  structure: "Kết cấu",
  bedroom: "Phòng ngủ",
  wc: "WC",
  budget: "Ngân sách",
  contact: "Liên hệ",
  contact_type: "Loại liên hệ",
  urgent: "Cần gấp",
  pain_point: "Nỗi đau",
  objection: "Lo ngại",
  unclear_fields: "Thông tin chưa rõ",
  notes: "Ghi chú",
};

const leadLabels: Record<LeadQuality, string> = {
  hot: "Nóng",
  warm: "Ấm",
  cold: "Lạnh",
};

const formatValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
};

export default function AiConsultantPage() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [consultState, setConsultState] = useState<RentalConsultationState | null>(null);
  const [result, setResult] = useState<RentalConsultantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const stateEntries = useMemo(() => {
    const state = result?.state || consultState;
    if (!state) return [];

    return Object.entries(state).filter(([key, value]) => {
      if (key === "ask_count") return false;
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    });
  }, [result, consultState]);

  const submitConsultant = async () => {
    const text = message.trim();
    if (!text || loading) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/rental-consultant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          state: consultState,
        }),
      });

      const json = (await res.json()) as RentalConsultantResponse;

      if (!res.ok) {
        setStatus(json.error || "Không xử lý được yêu cầu.");
        return;
      }

      setResult(json);
      setConsultState(json.state);
      setChat((prev) => [
        ...prev,
        { role: "user", text },
        { role: "assistant", text: json.reply },
      ]);
      setMessage("");
    } catch (error) {
      console.error(error);
      setStatus("Không kết nối được AI tư vấn.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitConsultant();
  };

  const resetChat = () => {
    setMessage("");
    setChat([]);
    setConsultState(null);
    setResult(null);
    setStatus("");
  };

  const copyText = async (text: string, successText = "Đã copy") => {
    await navigator.clipboard.writeText(text);
    setStatus(successText);
  };

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>AI</p>
          <h1 style={styles.title}>Tư vấn AI thuê nhà / mặt bằng</h1>
        </div>

        <button type="button" style={styles.secondaryButton} onClick={resetChat}>
          Làm mới
        </button>
      </section>

      <form onSubmit={onSubmit} style={styles.composer}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Nhập tin nhắn của khách..."
          style={styles.textarea}
          rows={5}
        />

        <div style={styles.exampleRow}>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              style={styles.exampleButton}
              onClick={() => setMessage(example)}
            >
              {example}
            </button>
          ))}
        </div>

        <div style={styles.actions}>
          <button type="submit" style={styles.primaryButton} disabled={loading || !message.trim()}>
            {loading ? "Đang xử lý..." : "Gửi"}
          </button>
        </div>
      </form>

      {status && <div style={styles.status}>{status}</div>}

      {chat.length > 0 && (
        <section style={styles.chatBox}>
          {chat.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              style={{
                ...styles.bubble,
                ...(item.role === "user" ? styles.userBubble : styles.assistantBubble),
              }}
            >
              {item.text}
            </div>
          ))}
        </section>
      )}

      {result && (
        <section style={styles.resultGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHead}>
              <span style={styles.badge}>Lead: {leadLabels[result.lead_quality]}</span>
              {result.should_handoff && <span style={styles.handoffBadge}>Cần chuyỒn người thật</span>}
              <button type="button" style={styles.linkButton} onClick={() => copyText(result.reply)}>
                Copy tin nhắn
              </button>
            </div>

            <p style={styles.reply}>{result.reply}</p>

            <div style={styles.metaRow}>
              <span>Thiếu tiếp: {result.next_missing_field || "Đã đủ"}</span>
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Thông tin đã lấy được</h2>

            {stateEntries.length > 0 ? (
              <dl style={styles.filterList}>
                {stateEntries.map(([key, value]) => (
                  <div key={key} style={styles.filterItem}>
                    <dt style={styles.filterKey}>{fieldLabels[key] || key}</dt>
                    <dd style={styles.filterValue}>{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p style={styles.muted}>Chưa có thông tin.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 20,
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    marginBottom: 18,
  },
  eyebrow: {
    margin: "0 0 4px",
    color: "#2563eb",
    fontWeight: 800,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.15,
  },
  composer: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    display: "grid",
    gap: 12,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    lineHeight: 1.5,
    resize: "vertical",
    minHeight: 140,
    outlineColor: "#2563eb",
  },
  exampleRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  exampleButton: {
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    color: "#374151",
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: 8,
    background: "#111827",
    color: "#fff",
    padding: "11px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    color: "#111827",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
  },
  status: {
    marginTop: 12,
    color: "#2563eb",
    fontWeight: 700,
  },
  chatBox: {
    marginTop: 16,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    display: "grid",
    gap: 10,
  },
  bubble: {
    maxWidth: "78%",
    padding: "10px 12px",
    borderRadius: 12,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  userBubble: {
    justifySelf: "end",
    background: "#2563eb",
    color: "#fff",
  },
  assistantBubble: {
    justifySelf: "start",
    background: "#f3f4f6",
    color: "#111827",
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
    marginTop: 16,
  },
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
  },
  panelHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: 18,
  },
  badge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 800,
    fontSize: 13,
  },
  handoffBadge: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 800,
    fontSize: 13,
  },
  reply: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    margin: 0,
  },
  metaRow: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 13,
  },
  filterList: {
    margin: 0,
    display: "grid",
    gap: 8,
  },
  filterItem: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 0.7fr) minmax(0, 1fr)",
    gap: 10,
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 8,
  },
  filterKey: {
    color: "#6b7280",
    fontSize: 13,
  },
  filterValue: {
    margin: 0,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  muted: {
    color: "#6b7280",
    margin: 0,
  },
};

