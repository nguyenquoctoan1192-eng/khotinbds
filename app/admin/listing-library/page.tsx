"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/lib/userRole";
import RoleGate from "@/app/components/role-gate";

type ListingLibraryItem = {
  id: string;
  raw_input: string | null;
  title: string | null;
  primary_content: string;
  chotot_title: string | null;
  facebook_title: string | null;
  short_description: string | null;
  seo_description: string | null;
  phone: string | null;
  district: string | null;
  street: string | null;
  price: string | null;
  area: string | null;
  structure: string | null;
  created_at: string | null;
};

type LibraryResponse = {
  success: boolean;
  items: ListingLibraryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
};

const pageSize = 20;

const formatDate = (value: string | null) => {
  if (!value) return "";

  return new Date(value).toLocaleString("vi-VN");
};

function ListingLibraryContent() {
  const router = useRouter();
  const { role, roleLoading } = useUserRole();
  const canAccessLibrary = role === "admin" || role === "agent";
  const canManageLibrary = role === "admin";
  const [items, setItems] = useState<ListingLibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState<ListingLibraryItem | null>(null);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const resultLabel = useMemo(
    () => `${total.toLocaleString("vi-VN")} tin`,
    [total]
  );

  const fetchItems = async () => {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      if (appliedSearch.trim()) {
        params.set("search", appliedSearch.trim());
      }

      const res = await fetch(`/api/listing-library?${params.toString()}`);
      const json = (await res.json()) as LibraryResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không tải được kho tin đăng");
      }

      setItems(json.items || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (error) {
      console.error("Không tải được kho tin đăng:", error);
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setMessage(
        error instanceof Error ? error.message : "Không tải được kho tin đăng."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roleLoading || !canAccessLibrary) return;
    fetchItems();
  }, [page, appliedSearch, roleLoading, canAccessLibrary]);

  const copyText = async (value: string | null) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setMessage("Đã copy.");
    } catch (error) {
      console.error(error);
      setMessage("Chưa copy được, bạn copy thủ công nhé.");
    }
  };

  const deleteItem = async (item: ListingLibraryItem) => {
    if (!confirm("Xóa tin này khỏi kho tin đăng?")) return;

    setMessage("");

    try {
      const res = await fetch(`/api/listing-library/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không xóa được tin");
      }

      setSelectedItem(null);
      setMessage("Đã xóa tin.");
      fetchItems();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Chưa xóa được tin.");
    }
  };

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search);
  };

  if (roleLoading) {
    return <div style={{ padding: 20 }}>Đang kiỒm tra quyền truy cập...</div>;
  }

  if (!canAccessLibrary) {
    return (
      <div style={{ padding: 20 }}>Kho tin đăng chỉ dành cho quản trị viên và môi giới.</div>
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.header}>
        <div>
          <h1 style={styles.title}>Kho tin đăng</h1>
          <p style={styles.subtitle}>Lưu và dùng lại nội dung AI đã tạo.</p>
        </div>
        <button type="button" onClick={() => router.push("/admin/post")} style={styles.primaryButton}>
          Tạo tin mới
        </button>
      </section>

      <section style={styles.toolbar}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") applySearch();
          }}
          placeholder="Tìm theo đường, quận, SĐT, tiêu đề..."
          style={styles.searchInput}
        />
        <button type="button" onClick={applySearch} style={styles.searchButton}>
          Tìm kiếm
        </button>
      </section>

      <div style={styles.metaRow}>
        <span>{resultLabel}</span>
        <span>
          Trang {page}/{totalPages}
        </span>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {loading ? (
        <p>Đang tải...</p>
      ) : items.length === 0 ? (
        <p>Không có tin phù hợp.</p>
      ) : (
        <section style={styles.list}>
          {items.map((item) => (
            <article key={item.id} style={styles.card}>
              <div style={styles.cardMain}>
                <h2 style={styles.cardTitle}>
                  {item.chotot_title || item.facebook_title || item.title || "Tin đã lưu"}
                </h2>
                <p style={styles.cardMeta}>
                  {[item.street, item.district, item.price, item.phone].filter(Boolean).join(" â¬¢ ")}
                </p>
                <p style={styles.preview}>{item.primary_content}</p>
                <p style={styles.date}>{formatDate(item.created_at)}</p>
              </div>
              <div style={styles.actions}>
                <button type="button" onClick={() => copyText(item.primary_content)} style={styles.smallButton}>
                  Copy nội dung
                </button>
                <button type="button" onClick={() => copyText(item.chotot_title || item.facebook_title)} style={styles.smallButton}>
                  Copy tiêu đề
                </button>
                <button type="button" onClick={() => setSelectedItem(item)} style={styles.smallButton}>
                  Xem chi tiết
                </button>
                {canManageLibrary && (
                  <button type="button" onClick={() => deleteItem(item)} style={styles.deleteButton}>
                    Xóa
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <section style={styles.pagination}>
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={!canGoPrevious}
          style={canGoPrevious ? styles.pageButton : styles.disabledButton}
        >
          Trang trước
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => current + 1)}
          disabled={!canGoNext}
          style={canGoNext ? styles.pageButton : styles.disabledButton}
        >
          Trang sau
        </button>
      </section>

      {selectedItem && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedItem(null)}>
          <section style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Chi tiết tin</h2>
              <button type="button" onClick={() => setSelectedItem(null)} style={styles.closeButton}>
                Đóng
              </button>
            </div>
            <Detail label="Nội dung chia sẻ" value={selectedItem.primary_content} onCopy={copyText} />
            <Detail label="Tiêu đề Chợ Tốt" value={selectedItem.chotot_title} onCopy={copyText} />
            <Detail label="Tiêu đề Facebook" value={selectedItem.facebook_title} onCopy={copyText} />
            <Detail label="Mô tả ngắn" value={selectedItem.short_description} onCopy={copyText} />
            <Detail label="SEO description" value={selectedItem.seo_description} onCopy={copyText} />
          </section>
        </div>
      )}
      </div>
  );
}

export default function ListingLibraryPage() {
  return (
    <RoleGate allowedRoles={["admin", "agent"]}>
      <ListingLibraryContent />
    </RoleGate>
  );
}

function Detail({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | null;
  onCopy: (value: string | null) => void;
}) {
  if (!value) return null;

  return (
    <div style={styles.detailBlock}>
      <div style={styles.detailHeader}>
        <strong>{label}</strong>
        <button type="button" onClick={() => onCopy(value)} style={styles.smallButton}>
          Copy
        </button>
      </div>
      <pre style={styles.detailText}>{value}</pre>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: 24,
    fontFamily: "var(--font-inter)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },
  primaryButton: {
    background: "#0f766e",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    padding: "11px 14px",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    flex: 1,
    fontSize: 15,
    padding: 12,
  },
  searchButton: {
    background: "#2563eb",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    padding: "0 16px",
  },
  metaRow: {
    color: "#475569",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  message: {
    background: "#ecfeff",
    border: "1px solid #67e8f9",
    borderRadius: 8,
    color: "#155e75",
    marginBottom: 12,
    padding: 10,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1fr auto",
    padding: 14,
  },
  cardTitle: {
    fontSize: 18,
    margin: "0 0 6px",
  },
  cardMeta: {
    color: "#475569",
    margin: "0 0 8px",
  },
  preview: {
    color: "#111827",
    margin: 0,
    maxHeight: 72,
    overflow: "hidden",
    whiteSpace: "pre-line",
  },
  date: {
    color: "#94a3b8",
    fontSize: 13,
    margin: "8px 0 0",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 132,
  },
  smallButton: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 10px",
  },
  deleteButton: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    color: "#b91c1c",
    cursor: "pointer",
    padding: "8px 10px",
  },
  pagination: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginTop: 20,
  },
  pageButton: {
    background: "#111827",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    padding: "10px 14px",
  },
  disabledButton: {
    background: "#e2e8f0",
    border: "none",
    borderRadius: 8,
    color: "#94a3b8",
    cursor: "not-allowed",
    padding: "10px 14px",
  },
  modalBackdrop: {
    alignItems: "center",
    background: "rgba(15, 23, 42, 0.5)",
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    left: 0,
    padding: 16,
    position: "fixed",
    right: 0,
    top: 0,
    zIndex: 50,
  },
  modal: {
    background: "white",
    borderRadius: 8,
    maxHeight: "88vh",
    maxWidth: 760,
    overflow: "auto",
    padding: 18,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    margin: 0,
  },
  closeButton: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 10px",
  },
  detailBlock: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    marginTop: 12,
  },
  detailHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  detailText: {
    background: "#f8fafc",
    borderRadius: 8,
    fontFamily: "inherit",
    lineHeight: 1.5,
    marginBottom: 0,
    overflow: "auto",
    padding: 12,
    whiteSpace: "pre-wrap",
  },
};

