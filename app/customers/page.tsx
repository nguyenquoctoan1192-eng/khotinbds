import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  fullname: string | null;
  phone: string | null;
  preferred_districts: unknown;
  note: string | null;
  max_price: number | string | null;
  created_at: string | null;
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

const getPriceValue = (price: Lead["max_price"]) => {
  const value = Number(price || 0);

  return Number.isFinite(value) ? value : 0;
};

const formatPrice = (price: Lead["max_price"]) => {
  const value = getPriceValue(price);

  if (value <= 0) {
    return "Chưa có";
  }

  return `${value.toLocaleString("vi-VN")} VNĐ`;
};

const extractFollowUp = (note: string | null) => {
  if (!note) {
    return "";
  }

  const match = note.match(/Hen cham soc lai:\s*([^|]+)/i);

  return match?.[1]?.trim() || "";
};

const buildRequirementQuery = (lead: Lead) =>
  [
    formatDistricts(lead.preferred_districts),
    lead.note || "",
    getPriceValue(lead.max_price) > 0 ? `${getPriceValue(lead.max_price)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

const formatDate = (value: string | null) => {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có";
  }

  return date.toLocaleDateString("vi-VN");
};

export default async function CustomersPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let leads: Lead[] = [];
  let loadError = "";

  if (!supabaseUrl || !serviceRoleKey) {
    loadError = "Thiếu cấu hình Supabase để tải danh sách khách.";
  } else {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from("leads")
      .select("id, fullname, phone, preferred_districts, note, max_price, created_at")
      .order("created_at", { ascending: false });

    leads = (data || []) as Lead[];
    loadError = error?.message || "";
  }

  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f3f4f6" }}>
      <div style={{ background: "#111827", color: "#fff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 24, fontWeight: 700 }}>
          BDS
        </Link>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
            Trang chủ
          </Link>
          <Link href="/post" style={{ color: "#fff", textDecoration: "none" }}>
            Đăng tin
          </Link>
          <Link href="/customers" style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>
            Khách hàng
          </Link>
        </div>
      </div>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>Khách hàng</h1>
            <p style={{ marginTop: 0, color: "#6b7280" }}>
              Danh sách khách đã lưu từ form Lưu khách.
            </p>
          </div>
          <Link
            href="/"
            style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "11px 16px", borderRadius: 8, fontWeight: 700 }}
          >
            Thêm khách
          </Link>
        </div>

        {loadError && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 16 }}>
            Không tải được danh sách khách: {loadError}
          </div>
        )}

        {!loadError && leads.length === 0 && (
          <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
            Chưa có khách hàng nào được lưu.
          </div>
        )}

        {!loadError && leads.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {leads.map((lead) => {
              const districts = formatDistricts(lead.preferred_districts);
              const followUp = extractFollowUp(lead.note);
              const requirementQuery = buildRequirementQuery(lead);
              const searchHref = requirementQuery
                ? `/?q=${encodeURIComponent(requirementQuery)}`
                : "/";

              return (
                <article
                  id={`lead-${lead.id}`}
                  key={lead.id}
                  style={{ background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "start" }}>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Tên khách</p>
                      <strong>{lead.fullname || "Chưa có tên"}</strong>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>SĐT</p>
                      <span>{lead.phone || "Chưa có"}</span>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Khu vực</p>
                      <span>{districts || "Chưa có"}</span>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Ngân sách</p>
                      <span>{formatPrice(lead.max_price)}</span>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Ngày tạo</p>
                      <span>
                        {formatDate(lead.created_at)}
                      </span>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Hẹn chăm sóc lại</p>
                      <span>{followUp || "Chưa có"}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <p style={{ margin: "0 0 4px", color: "#6b7280", fontSize: 13 }}>Nhu cầu / ghi chú</p>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>{lead.note || "Chưa có ghi chú"}</p>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    <details>
                      <summary style={{ cursor: "pointer", background: "#f3f4f6", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}>
                        Xem chi tiết
                      </summary>
                      <div style={{ marginTop: 10, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
                        <p style={{ marginTop: 0 }}>ID: {lead.id}</p>
                        <p>Khách: {lead.fullname || "Chưa có tên"}</p>
                        <p>SĐT: {lead.phone || "Chưa có"}</p>
                        <p>Khu vực: {districts || "Chưa có"}</p>
                        <p style={{ marginBottom: 0 }}>Ghi chú: {lead.note || "Chưa có"}</p>
                      </div>
                    </details>

                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        style={{ background: "#16a34a", color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}
                      >
                        Gọi điện
                      </a>
                    )}

                    <Link
                      href={searchHref}
                      style={{ background: "#2563eb", color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, fontWeight: 700 }}
                    >
                      Tìm nhà phù hợp
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
