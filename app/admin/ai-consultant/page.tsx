"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ConsultantIntent =
  | "search_listing"
  | "reply_customer"
  | "save_lead"
  | "follow_up"
  | "explain_match";

type ListingResult = {
  id?: string | number;
  listing_id?: string | number;
  listing?: ListingResult;
  title?: string | null;
  district?: string | null;
  address?: string | null;
  location?: string | null;
  price?: number | string | null;
  area?: number | string | null;
  bedrooms?: number | string | null;
  floors?: number | string | null;
  contact_phone?: string | null;
  phone?: string | null;
  score?: number | string | null;
  reasons?: unknown;
  warnings?: unknown;
  [key: string]: unknown;
};

type ConsultantResponse = {
  success: boolean;
  intent?: ConsultantIntent;
  reply?: string;
  normalizedRequirement?: Record<string, unknown>;
  matches?: ListingResult[];
  warnings?: string[];
  lead?: unknown;
  message?: string;
};

const examples = [
  "Khách cần thuê nhà nguyên căn 3PN Quận 11, tài chính 10tr",
  "Khách nói để anh suy nghĩ thì trả lời sao?",
  "Soạn tin gửi khách cho 3 căn phù hợp nhất",
  "Khách cần mặt bằng ngang 5m Quận 1 giá 50tr",
];

const intentLabels: Record<ConsultantIntent, string> = {
  search_listing: "Tìm nhà",
  reply_customer: "Trả lời khách",
  save_lead: "Lưu CRM",
  follow_up: "Follow-up",
  explain_match: "Giải thích match",
};

const formatValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "");
};

const getListing = (item: ListingResult) => item.listing || item;

const getListingId = (item: ListingResult) => {
  const listing = getListing(item);
  return String(listing.id || item.listing_id || "");
};

const formatPrice = (price: ListingResult["price"]) => {
  const numberValue = Number(price || 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return "Đang cập nhật";
  return `${numberValue.toLocaleString("vi-VN")} VNĐ`;
};

const getReasonLabels = (item: ListingResult) =>
  Array.isArray(item.reasons)
    ? item.reasons.map((reason) => String(reason)).filter(Boolean)
    : [];

export default function AiConsultantPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ConsultantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const filterEntries = useMemo(() => {
    const normalized = result?.normalizedRequirement || {};

    return Object.entries(normalized).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    });
  }, [result]);

  const matches = result?.matches || [];

  const submitConsultant = async (intent?: ConsultantIntent) => {
    const text = message.trim();
    if (!text) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/ai-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, intent }),
      });
      const json = (await res.json()) as ConsultantResponse;

      if (!res.ok || !json.success) {
        setStatus(json.message || "Không xử lý được yêu cầu.");
        return;
      }

      setResult(json);
      setStatus("");
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

  const copyText = async (text: string, successText = "Đã copy") => {
    await navigator.clipboard.writeText(text);
    setStatus(successText);
  };

  const sendHomesText = () =>
    [
      result?.reply || "",
      ...matches.slice(0, 3).map((item, index) => {
        const listing = getListing(item);
        return `${index + 1}. ${listing.title || listing.address || "Căn phù hợp"} - ${formatPrice(listing.price)}${listing.area ? ` - ${listing.area}m2` : ""}`;
      }),
    ]
      .filter(Boolean)
      .join("\n");

  const saveLead = async () => {
    await submitConsultant("save_lead");
    setStatus("Đã gửi yêu cầu lưu khách vào CRM.");
  };

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>AI</p>
          <h1 style={styles.title}>Tư vấn AI</h1>
        </div>
      </section>

      <form onSubmit={onSubmit} style={styles.composer}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Nhập nhu cầu khách hoặc câu hỏi tư vấn..."
          style={styles.textarea}
          rows={7}
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
          <button type="submit" style={styles.primaryButton} disabled={loading}>
            {loading ? "Đang xử lý..." : "Gửi AI"}
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={loading || !message.trim()}
            onClick={() => submitConsultant("search_listing")}
          >
            Tìm lại
          </button>
        </div>
      </form>

      {status && <div style={styles.status}>{status}</div>}

      {result && (
        <section style={styles.resultGrid}>
          <div style={styles.panel}>
            <div style={styles.panelHead}>
              <span style={styles.badge}>
                {result.intent ? intentLabels[result.intent] : "AI"}
              </span>
              <button
                type="button"
                style={styles.linkButton}
                onClick={() => copyText(result.reply || "")}
              >
                Copy tin nhắn
              </button>
            </div>
            <p style={styles.reply}>{result.reply}</p>

            <div style={styles.actionRow}>
              <button type="button" style={styles.secondaryButton} onClick={saveLead}>
                Lưu khách vào CRM
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                disabled={matches.length === 0}
                onClick={() => copyText(sendHomesText(), "Đã copy tin gửi nhà")}
              >
                Gửi nhà
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => submitConsultant("search_listing")}
              >
                Tìm lại
              </button>
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Bộ lọc AI hiểu được</h2>
            {filterEntries.length > 0 ? (
              <dl style={styles.filterList}>
                {filterEntries.map(([key, value]) => (
                  <div key={key} style={styles.filterItem}>
                    <dt style={styles.filterKey}>{key}</dt>
                    <dd style={styles.filterValue}>{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p style={styles.muted}>Chưa có bộ lọc tìm nhà.</p>
            )}
          </div>
        </section>
      )}

      {matches.length > 0 && (
        <section style={styles.matches}>
          <h2 style={styles.sectionTitle}>Căn phù hợp</h2>
          <div style={styles.listingGrid}>
            {matches.map((item, index) => {
              const listing = getListing(item);
              const listingId = getListingId(item);
              const reasons = getReasonLabels(item);

              return (
                <article key={listingId || index} style={styles.listingCard}>
                  <div>
                    <div style={styles.score}>Điểm phù hợp {item.score || 0}</div>
                    <h3 style={styles.listingTitle}>
                      {listing.title || listing.address || "Căn phù hợp"}
                    </h3>
                    <p style={styles.listingMeta}>
                      {listing.district || listing.location || "Chưa có vị trí"} · {formatPrice(listing.price)}
                    </p>
                    <p style={styles.listingMeta}>
                      {listing.area ? `${listing.area}m2` : "Diện tích đang cập nhật"}
                      {listing.bedrooms ? ` · ${listing.bedrooms}PN` : ""}
                      {listing.floors ? ` · ${listing.floors} tầng` : ""}
                    </p>
                  </div>

                  {reasons.length > 0 && (
                    <ul style={styles.reasonList}>
                      {reasons.slice(0, 3).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}

                  <div style={styles.listingActions}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={!listingId}
                      onClick={() => router.push(`/listing/${listingId}?view=admin`)}
                    >
                      Xem nhà
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() =>
                        copyText(
                          `${listing.title || listing.address || "Căn phù hợp"}\nGiá: ${formatPrice(listing.price)}\n${listing.area ? `Diện tích: ${listing.area}m2` : ""}`,
                          "Đã copy căn"
                        )
                      }
                    >
                      Copy
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    letterSpacing: 0,
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
    minHeight: 180,
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
  reply: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    margin: 0,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
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
  matches: {
    marginTop: 20,
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: 22,
  },
  listingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  listingCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 14,
    display: "grid",
    gap: 12,
  },
  score: {
    color: "#047857",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 6,
  },
  listingTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.3,
  },
  listingMeta: {
    margin: "6px 0 0",
    color: "#4b5563",
  },
  reasonList: {
    margin: 0,
    paddingLeft: 18,
    color: "#374151",
    lineHeight: 1.5,
  },
  listingActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
};
