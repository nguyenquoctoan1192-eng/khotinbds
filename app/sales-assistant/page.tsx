"use client";

import { useState } from "react";

type SalesAssistantResult = {
  detectedIntent: string;
  emotion: string;
  nextGoal: string;
  suggestedReply: string;
  followUpQuestion: string;
};

const stageOptions = [
  "",
  "new_lead",
  "viewed_images",
  "repeated_consulting",
  "scheduled_viewing",
  "after_viewing",
  "interested_not_closed",
  "deposit_stage",
  "rejected",
];

export default function SalesAssistantPage() {
  const [customerMessage, setCustomerMessage] = useState("ĐỒ anh suy nghĩ");
  const [customerStage, setCustomerStage] = useState("after_viewing");
  const [type, setType] = useState("mặt bằng kinh doanh");
  const [business, setBusiness] = useState("spa");
  const [district, setDistrict] = useState("Phú Nhuận");
  const [budget, setBudget] = useState("50000000");
  const [minArea, setMinArea] = useState("80");
  const [viewedListings, setViewedListings] = useState("3");
  const [rejectedReasons, setRejectedReasons] = useState("giá cao, ít chỗ đậu xe");
  const [lastAction, setLastAction] = useState("đã đi xem nhà");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SalesAssistantResult | null>(null);

  const runAssistant = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/sales-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerMessage,
          customerStage: customerStage || null,
          customerNeed: {
            type,
            business,
            district,
            budget: Number(budget) || undefined,
            minArea: Number(minArea) || undefined,
          },
          viewedListings: Number(viewedListings) || 0,
          rejectedReasons: rejectedReasons
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          lastAction,
        }),
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Không tạo được gợi ý phản hồi.");
      }

      setResult(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tạo được gợi ý phản hồi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.header}>
          <h1 style={styles.title}>AI tư vấn môi giới</h1>
          <p style={styles.subtitle}>
            Test phản hồi theo ngữ cảnh khách thuê bất động sản.
          </p>
        </div>

        <div style={styles.grid}>
          <div style={styles.form}>
            <label style={styles.label}>
              Tin nhắn khách
              <textarea
                value={customerMessage}
                onChange={(event) => setCustomerMessage(event.target.value)}
                style={styles.textarea}
              />
            </label>

            <label style={styles.label}>
              Giai đoạn khách
              <select
                value={customerStage}
                onChange={(event) => setCustomerStage(event.target.value)}
                style={styles.input}
              >
                {stageOptions.map((stage) => (
                  <option key={stage || "auto"} value={stage}>
                    {stage || "Tự phát hiện"}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                Loại nhu cầu
                <input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Ngành
                <input
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                Quận/khu vực
                <input
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Ngân sách
                <input
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                Diện tích tối thiểu
                <input
                  value={minArea}
                  onChange={(event) => setMinArea(event.target.value)}
                  style={styles.input}
                />
              </label>
              <label style={styles.label}>
                Số căn đã xem
                <input
                  value={viewedListings}
                  onChange={(event) => setViewedListings(event.target.value)}
                  style={styles.input}
                />
              </label>
            </div>

            <label style={styles.label}>
              Lý do từ chối/lăn tăn
              <input
                value={rejectedReasons}
                onChange={(event) => setRejectedReasons(event.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Hành động gần nhất
              <input
                value={lastAction}
                onChange={(event) => setLastAction(event.target.value)}
                style={styles.input}
              />
            </label>

            <button
              type="button"
              onClick={runAssistant}
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? "Đang tạo gợi ý..." : "Tạo gợi ý phản hồi"}
            </button>
          </div>

          <div style={styles.result}>
            <h2 style={styles.resultTitle}>Kết quả</h2>

            {error && <div style={styles.error}>{error}</div>}

            {!result && !error && (
              <div style={styles.empty}>Nhập ngữ cảnh rồi bấm tạo gợi ý.</div>
            )}

            {result && (
              <div style={styles.resultStack}>
                <InfoRow label="Intent" value={result.detectedIntent} />
                <InfoRow label="Emotion" value={result.emotion} />
                <InfoRow label="Next goal" value={result.nextGoal} />
                <div>
                  <div style={styles.outputLabel}>Suggested reply</div>
                  <div style={styles.replyBox}>{result.suggestedReply}</div>
                </div>
                <InfoRow
                  label="Follow-up question"
                  value={result.followUpQuestion}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    color: "#111827",
    fontFamily: "var(--font-inter)",
    padding: 16,
  },
  shell: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#4b5563",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)",
    gap: 16,
    alignItems: "start",
  },
  form: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: 12,
    minHeight: 110,
    fontSize: 15,
    resize: "vertical",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  button: {
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "white",
    padding: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonDisabled: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },
  result: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
  },
  resultTitle: {
    margin: "0 0 12px",
    fontSize: 20,
  },
  resultStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  infoRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  infoValue: {
    fontSize: 15,
  },
  outputLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: 700,
    marginBottom: 6,
  },
  replyBox: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    borderRadius: 8,
    padding: 12,
  },
  empty: {
    color: "#6b7280",
    border: "1px dashed #d1d5db",
    borderRadius: 8,
    padding: 14,
  },
  error: {
    color: "#b91c1c",
    border: "1px solid #fecaca",
    background: "#fee2e2",
    borderRadius: 8,
    padding: 12,
  },
};

