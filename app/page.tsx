"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";
import { noSearchResultsMessage } from "@/lib/searchNormalization";
import SiteNavbar from "@/app/components/site-navbar";
import RentedStamp from "@/app/components/rented-stamp";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type PublicChatProfile = {
  name: string | null;
  phone: string | null;
  purpose: string | null;
  business_type: string | null;
  business: string | null;
  location: string | null;
  primary_location: string | null;
  alternative_locations: string[];
  budget: string | null;
  area: string | null;
  structure: string | null;
  frontage: string | null;
  move_in_time: string | null;
};

type PublicChatMessage = {
  role: "assistant" | "user";
  content: string;
  reply_parts?: string[];
  suggestion_followup_parts?: string[];
  property_suggestions?: PropertySuggestion[];
};

type PropertySuggestion = {
  area_label: string;
  structure_label: string;
  price_label: string;
  comment_label?: string;
};

const emptyPublicChatProfile = (): PublicChatProfile => ({
  name: null,
  phone: null,
  purpose: null,
  business_type: null,
  business: null,
  location: null,
  primary_location: null,
  alternative_locations: [],
  budget: null,
  area: null,
  structure: null,
  frontage: null,
  move_in_time: null,
});

export default function Home() {
  const router = useRouter();
  const aiChatContainerRef = useRef<HTMLDivElement | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [queryReady, setQueryReady] = useState(false);
  const [parsedFilters, setParsedFilters] =
    useState<ParsedRequirementFilters | null>(null);
  const [searchWarning, setSearchWarning] = useState("");
  const [showTopButton, setShowTopButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveFullname, setSaveFullname] = useState("");
  const [savePhone, setSavePhone] = useState("");
  const [saveDistrict, setSaveDistrict] = useState("");
  const [saveNeed, setSaveNeed] = useState("");
  const [saveTimeframe, setSaveTimeframe] = useState("");
  const [saveBudget, setSaveBudget] = useState("");
  const [saveFollowUpAt, setSaveFollowUpAt] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showCustomerMessage, setShowCustomerMessage] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<PublicChatMessage[]>([
    {
      role: "assistant",
      content:
        "Em chào anh/chị, em là trợ lý AI tư vấn nhà/mặt bằng. Mình đang cần tìm khu vực nào và dùng để ở hay kinh doanh ạ?",
    },
  ]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatProfile, setAiChatProfile] = useState<PublicChatProfile>(
    emptyPublicChatProfile()
  );
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatError, setAiChatError] = useState("");
  const [aiChatLeadCreated, setAiChatLeadCreated] = useState(false);
  const aiPropertySuggestionsKey = aiChatMessages
    .map((message) => `${message.property_suggestions?.length || 0}:${message.suggestion_followup_parts?.length || 0}`)
    .join("|");

  const scrollChatToBottom = () => {
    const el = aiChatContainerRef.current;

    if (!el) {
      return;
    }

    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (!showAiChat || !aiChatContainerRef.current) {
      return;
    }

    scrollChatToBottom();
    const timer = window.setTimeout(scrollChatToBottom, 80);

    return () => window.clearTimeout(timer);
  }, [aiChatMessages, aiChatLoading, aiPropertySuggestionsKey, showAiChat]);

  const getListingFromResult = (item: any) => item.listing || item;

  const getExistingMatches = () =>
    listings
      .map((item) => {
        const listing = getListingFromResult(item);

        return {
          listing_id: item.listing_id || listing?.id,
          score: item.score,
          breakdown: item.breakdown,
          reasons: item.reasons || item.breakdown?.reasons || [],
        };
      })
      .filter((match) => match.listing_id);

  const getReasonLabels = (item: any) => {
    const breakdown = item.breakdown;
    const reasons = item.reasons || breakdown?.reasons || [];
    const labels: string[] = [];

    if (breakdown?.district_score > 0 || reasons.some((reason: string) => reason.includes("District"))) {
      labels.push("Đúng quận");
    }

    if (breakdown?.price_score > 0 || reasons.some((reason: string) => reason.includes("Giá"))) {
      labels.push("Giá gần ngân sách");
    }

    if (breakdown?.area_score > 0 || reasons.some((reason: string) => reason.includes("Area"))) {
      labels.push("Diện tích phù hợp");
    }

    if (breakdown?.business_score > 0) {
      const businessReason = reasons.find((reason: string) =>
        /spa|cafe|office|restaurant|business|MT\/MB|VP|frontage|Premise/i.test(reason)
      );
      const businessType =
        businessReason?.match(/spa|cafe|office|restaurant/i)?.[0] || "kinh doanh";

      labels.push(`Phù hợp ${businessType}`);
    }

    return labels;
  };

  const formatListingPrice = (price: unknown) => {
    const value = Number(price || 0);

    if (!Number.isFinite(value) || value <= 0) {
      return "Liên hệ";
    }

    return `${value.toLocaleString("vi-VN")} VNĐ`;
  };

  const buildNeedSummary = (filters: ParsedRequirementFilters | null) => {
    const parts = [
      filters?.preferred_districts?.length
        ? `khu vực ${filters.preferred_districts.join(", ")}`
        : "",
      filters?.max_price
        ? `ngân sách tối đa ${filters.max_price.toLocaleString("vi-VN")} VNĐ`
        : "",
      filters?.min_area ? `diện tích từ ${filters.min_area}m²` : "",
      filters?.note ? `nhu cầu ${filters.note}` : "",
    ].filter(Boolean);

    return parts.join(", ") || search.trim() || "nhu cầu đang tìm";
  };

  const buildCustomerShareMessage = () => {
    const filters = parsedFilters || parseVietnameseRequirement(search);
    const topMatches = listings.slice(0, 3);
    const lines = [
      `Em gửi anh/chị một số căn phù hợp với ${buildNeedSummary(filters)}:`,
      "",
      ...topMatches.flatMap((item, index) => {
        const listing = getListingFromResult(item);
        const reasons = getReasonLabels(item);
        const location = [listing.district, listing.address].filter(Boolean).join(" - ");

        return [
          `${index + 1}. ${listing.title || "Bất động sản phù hợp"}`,
          location ? `Khu vực: ${location}` : "",
          `Giá: ${formatListingPrice(listing.price)}`,
          listing.area ? `Diện tích: ${listing.area}m²` : "",
          reasons.length > 0
            ? `Lý do phù hợp: ${reasons.join(", ")}`
            : "Lý do phù hợp: phù hợp với nhu cầu đã tìm",
          "",
        ].filter(Boolean);
      }),
      "Anh/chị xem qua, nếu ưng căn nào em gửi thêm hình ảnh và hẹn lịch xem nhà.",
    ];

    return lines.join("\n");
  };

  const openCustomerMessage = () => {
    setCustomerMessage(buildCustomerShareMessage());
    setCopyMessage("");
    setShowCustomerMessage(true);
  };

  const copyCustomerMessage = async () => {
    await navigator.clipboard.writeText(customerMessage);
    setCopyMessage("Đã copy nội dung");
  };

  const sendAiChatMessage = async () => {
    const message = aiChatInput.trim();

    if (!message || aiChatLoading) {
      return;
    }

    const nextMessages: PublicChatMessage[] = [
      ...aiChatMessages,
      { role: "user", content: message },
    ];

    setAiChatMessages(nextMessages);
    setAiChatInput("");
    setAiChatLoading(true);
    setAiChatError("");

    try {
      const res = await fetch("/api/public-ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: nextMessages,
          profile: aiChatProfile,
          lead_created: aiChatLeadCreated,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "AI chưa phản hồi được.");
      }

      setAiChatProfile(json.profile || emptyPublicChatProfile());
      setAiChatLeadCreated((current) => current || Boolean(json.lead_created));
      setAiChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: json.reply,
          reply_parts: Array.isArray(json.reply_parts)
            ? json.reply_parts.filter(
                (part: unknown): part is string => typeof part === "string" && Boolean(part.trim())
              )
            : undefined,
          suggestion_followup_parts: Array.isArray(json.suggestion_followup_parts)
            ? json.suggestion_followup_parts.filter(
                (part: unknown): part is string => typeof part === "string" && Boolean(part.trim())
              )
            : undefined,
          property_suggestions: Array.isArray(json.property_suggestions)
            ? json.property_suggestions.slice(0, 3)
            : [],
        },
      ]);
    } catch (err) {
      console.error("public AI chat request failed", err);
      setAiChatError("");
      setAiChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Dạ em nhận được tin nhắn của anh rồi. Em kiểm tra lại nhu cầu và gửi mình hướng phù hợp ngay nhé.",
        },
      ]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const replaceSearchQuery = (value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (value.trim()) {
      url.searchParams.set("q", value);
    } else {
      url.searchParams.delete("q");
    }

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    replaceSearchQuery(value);
  };

  const clearSearch = () => {
    updateSearch("");
  };

  const buildListingUrl = (listingId: string) => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("fromSearch", search.trim());
    }

    const query = params.toString();
    return query ? `/listing/${listingId}?${query}` : `/listing/${listingId}`;
  };

  const fetchListings = async () => {
    setLoading(true);
    setSaveMessage("");
    setSearchWarning("");

    if (search.trim()) {
      const parsed = parseVietnameseRequirement(search);

      setParsedFilters(parsed);

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "match",
          note: parsed.note || null,
          preferred_districts: parsed.preferred_districts,
          max_price: parsed.max_price,
          min_area: parsed.min_area,
          keywordSearch: parsed.keywordSearch,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setListings([]);
        setLoading(false);
        return;
      }

      const matches = json.matches || [];
      setListings(matches);
      setSearchWarning(
        json.fallbackWarning ||
          json.message ||
          (matches.length === 0 ? noSearchResultsMessage : "")
      );
      setLoading(false);
      return;
    }

    setParsedFilters(null);
    setSearchWarning("");

    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      setListings([]);
      setLoading(false);
      return;
    }

    setListings(data || []);
    setLoading(false);
  };

  const parseBudgetValue = (value: string) => {
    const normalized = value
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/,/g, "")
      .trim();
    const match = normalized.match(/(\d+(?:\.\d+)?)/);

    if (!match) {
      return null;
    }

    const amount = Number(match[1]);

    if (!Number.isFinite(amount)) {
      return null;
    }

    if (/tr|triệu|trieu/.test(normalized)) {
      return amount * 1000000;
    }

    if (/tỷ|ty|tỉ|ti/.test(normalized)) {
      return amount * 1000000000;
    }

    return amount;
  };

  const cleanCrmValue = (value: string) =>
    value
      .replace(/^\s*(?:nhu\s*cau|nhu\s*cầu|need)\s*:\s*/i, "")
      .replace(/^\s*(?:thoi\s*gian\s*can\s*thue\/mua|thoi\s*gian\s*thue\/mua|thời\s*gian\s*cần\s*thuê\/mua|thời\s*gian\s*thuê\/mua|rental_time)\s*:\s*/i, "")
      .replace(/^\s*(?:hen\s*cham\s*soc\s*lai|hẹn\s*chăm\s*sóc\s*lại|follow_up_date)\s*:\s*/i, "")
      .replace(/^\s*(?:ghi\s*chu|ghi\s*chú|note)\s*:\s*/i, "")
      .trim();

  const buildCrmNote = (fallbackNote?: string) =>
    [
      cleanCrmValue(saveNeed || fallbackNote || "")
        ? `need=${cleanCrmValue(saveNeed || fallbackNote || "")}`
        : "",
      cleanCrmValue(saveTimeframe) ? `rental_time=${cleanCrmValue(saveTimeframe)}` : "",
      cleanCrmValue(saveFollowUpAt) ? `follow_up_date=${cleanCrmValue(saveFollowUpAt)}` : "",
      cleanCrmValue(saveNote) ? `note=${cleanCrmValue(saveNote)}` : "",
    ]
      .filter(Boolean)
      .join(" | ") || null;

  const openSaveForm = () => {
    const filters = search.trim()
      ? parseVietnameseRequirement(search)
      : parsedFilters;

    setSaveFullname("");
    setSavePhone("");
    setSaveDistrict(filters?.preferred_districts?.[0] || "");
    setSaveNeed(filters?.note || "");
    setSaveBudget(
      filters?.max_price
        ? filters.max_price.toLocaleString("vi-VN")
        : ""
    );
    setSaveNote("");
    setSaveTimeframe("");
    setSaveFollowUpAt("");
    setSaveMessage("");
    setShowSaveForm(true);
  };

  const saveCustomerLead = async () => {
    if (!savePhone.trim()) {
      alert("Nhập số điện thoại");
      return;
    }

    const filters = parsedFilters || parseVietnameseRequirement(search);

    setSavingCustomer(true);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullname: saveFullname,
        phone: savePhone,
        mode: "lead",
        note: buildCrmNote(filters.note || undefined),
        preferred_districts: saveDistrict.trim()
          ? [saveDistrict.trim()]
          : filters.preferred_districts,
        max_price: parseBudgetValue(saveBudget) ?? filters.max_price,
        min_area: filters.min_area,
        existing_matches: getExistingMatches(),
      }),
    });

    const json = await res.json();
    setSavingCustomer(false);

    if (!res.ok || !json.success) {
      alert("Lưu khách thất bại");
      return;
    }

    setSaveMessage("Đã lưu khách thành công");
    setShowSaveForm(false);
  };

  useEffect(() => {
    if (!queryReady) {
      return;
    }

    fetchListings();
  }, [queryReady, search]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");

    if (query && query !== search) {
      setSearch(query);
    }

    setQueryReady(true);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowTopButton(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f3f4f6" }}>
      <SiteNavbar />

      <div style={{ background: "linear-gradient(to right,#2563eb,#1d4ed8)", color: "#fff", padding: "60px 20px", textAlign: "center" }}>
        <h1>Tìm bất động sản nhanh chóng</h1>
        <p>Nhà đẹp - Giá tốt - Vị trí đẹp</p>
      </div>

      <div style={{ maxWidth: 900, margin: "-30px auto 20px", background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            placeholder="VD: tìm nhà khu vực phú nhuận, làm spa, giá 50tr đổ lại, dt 80m2"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: 18, borderRadius: 14, border: "1px solid #ddd", fontSize: 16, outline: "none" }}
          />
          {search.trim() && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Xóa tìm kiếm"
              style={{ width: 52, borderRadius: 14, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 18 }}
            >
              X
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginBottom: 8 }}>
            {search.trim()
              ? `Kết quả phù hợp (${listings.length})`
              : `Bất động sản nổi bật (${listings.length})`}
          </h2>
          {search.trim() && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => openSaveForm()}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "11px 16px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }}
              >
                Lưu nhu cầu này thành khách
              </button>
              {listings.length > 0 && (
                <button
                  onClick={openCustomerMessage}
                  style={{ background: "#111827", color: "#fff", border: "none", padding: "11px 16px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }}
                >
                  Soạn tin gửi khách
                </button>
              )}
            </div>
          )}
        </div>

        {parsedFilters && (
          <div style={{ background: "#fff", borderRadius: 10, padding: 14, marginTop: 12, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Bộ lọc đã phân tích</h3>
            <p>Quận: {parsedFilters.preferred_districts.join(", ") || "Không có"}</p>
            <p>
              Giá tối đa:{" "}
              {parsedFilters.max_price
                ? parsedFilters.max_price.toLocaleString("vi-VN")
                : "Không có"}
            </p>
            <p>Diện tích tối thiểu: {parsedFilters.min_area || "Không có"}</p>
            <p>Nhu cầu: {parsedFilters.note || "Không có"}</p>
            {parsedFilters.keywordSearch && (
              <p>Từ khóa: {parsedFilters.keywordSearch}</p>
            )}
          </div>
        )}

        {searchWarning && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: 10,
              color: "#92400e",
              fontWeight: 700,
              marginBottom: 12,
              padding: 12,
            }}
          >
            {searchWarning}
          </div>
        )}

        {saveMessage && (
          <p style={{ color: "#15803d", fontWeight: 700, marginTop: 0 }}>
            {saveMessage}
          </p>
        )}

        {loading ? (
          <p>Đang tải...</p>
        ) : listings.length === 0 && !searchWarning ? (
          <p>Không tìm thấy dữ liệu</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            {listings.map((item) => {
              const listing = getListingFromResult(item);

              return (
                <div key={listing.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, background: "#fff", borderRadius: 14, overflow: "hidden", padding: 14, alignItems: "flex-start", width: "100%", boxSizing: "border-box" }}>
                  <div style={{ position: "relative", width: isMobile ? "100%" : 260, height: isMobile ? 200 : 180, flexShrink: 0 }}>
                    <img
                      src={listing.images?.[0] || "https://placehold.co/600x400"}
                      alt={listing.title || "Bất động sản"}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, opacity: listing.status === "rented" ? 0.6 : 1 }}
                    />
                    {listing.status === "rented" && <RentedStamp />}
                  </div>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <h3 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>{listing.title}</h3>
                    <p style={{ color: "#dc2626", fontWeight: "bold", fontSize: 22 }}>
                      {Number(listing.price || 0).toLocaleString("vi-VN")} VNĐ
                    </p>
                    <p>Vị trí: {listing.district}</p>
                    {search.trim() && (
                      <div style={{ marginTop: 8, marginBottom: 8 }}>
                        <p style={{ fontWeight: 700, marginBottom: 6 }}>
                          Điểm phù hợp: {item.score}
                        </p>
                        {getReasonLabels(item).length > 0 && (
                          <div>
                            <p style={{ marginBottom: 4 }}>Reasons:</p>
                            <ul style={{ marginTop: 0, paddingLeft: 20 }}>
                              {getReasonLabels(item).map((reason) => (
                                <li key={reason}>✓ {reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 15, flexWrap: "wrap", marginTop: 8, marginBottom: 8 }}>
                      <span>{listing.bedrooms || 0} PN</span>
                      <span>{listing.bathrooms || 0} WC</span>
                      <span>{listing.area || 0}m²</span>
                      <span>{listing.floors || 0} tầng</span>
                    </div>
                    <p style={{ color: "#555", lineHeight: 1.5, marginTop: 10, wordBreak: "break-word", fontSize: isMobile ? 14 : 16 }}>
                      {listing.description}
                    </p>
                    <p style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
                      {new Date(listing.updated_at || listing.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 10, justifyContent: isMobile ? "flex-start" : "flex-end", width: isMobile ? "100%" : "auto", marginTop: isMobile ? 10 : 0, flexShrink: 0, flexWrap: "wrap" }}>
                    <button style={{ background: "#111827", color: "#fff", border: "none", padding: "12px 18px", borderRadius: 10, cursor: "pointer", fontWeight: "bold" }} onClick={() => router.push(buildListingUrl(listing.id))}>
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showTopButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: 55,
            height: 55,
            borderRadius: "50%",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 9999
          }}
        >
          ↑
        </button>
      )}

      {!showAiChat && (
        <button
          type="button"
          onClick={() => setShowAiChat(true)}
          style={{
            position: "fixed",
            right: 20,
            bottom: showTopButton ? 88 : 20,
            zIndex: 10001,
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "13px 18px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
          }}
        >
          💬 Tư vấn AI
        </button>
      )}

      {showAiChat && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: "min(94vw, 380px)",
            maxHeight: "min(82vh, 620px)",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
            zIndex: 10002,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ background: "#111827", color: "#fff", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <strong>Tư vấn AI</strong>
            <button
              type="button"
              onClick={() => setShowAiChat(false)}
              aria-label="Đóng chat"
              style={{ background: "transparent", color: "#fff", border: "none", fontSize: 20, cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          <div
            ref={aiChatContainerRef}
            style={{
              padding: 12,
              overflowY: "auto",
              display: "grid",
              gap: 10,
              minHeight: 0,
              flex: 1,
              maxHeight: "min(60vh, 460px)",
            }}
          >
            {aiChatMessages.map((message, index) => {
              const isUser = message.role === "user";
              const suggestions = message.property_suggestions || [];
              const followupParts = message.suggestion_followup_parts || [];
              const bubbleParts =
                !isUser && message.reply_parts?.length
                  ? message.reply_parts
                  : [message.content];

              return (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    justifySelf: isUser ? "end" : "start",
                    maxWidth: "88%",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {bubbleParts.map((part, partIndex) => (
                    <div
                      key={`${message.role}-${index}-${partIndex}`}
                      style={{
                        background: isUser ? "#2563eb" : "#f3f4f6",
                        color: isUser ? "#fff" : "#111827",
                        borderRadius: 10,
                        padding: "9px 11px",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {part}
                    </div>
                  ))}
                  {!isUser && suggestions.length > 0 && (
                    <div style={{ display: "grid", gap: 8 }}>
                      {suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                        <div
                          key={`${suggestion.area_label}-${suggestionIndex}`}
                          style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 11px",
                            color: "#111827",
                            lineHeight: 1.5,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{suggestion.area_label}</div>
                          <div>Diện tích: {suggestion.structure_label}</div>
                          <div>Giá: {suggestion.price_label}</div>
                          {suggestion.comment_label && (
                            <div style={{ marginTop: 6, color: "#4b5563" }}>
                              {suggestion.comment_label}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isUser && followupParts.length > 0 && followupParts.map((part, followupIndex) => (
                    <div
                      key={`${message.role}-${index}-followup-${followupIndex}`}
                      style={{
                        background: "#f3f4f6",
                        color: "#111827",
                        borderRadius: 10,
                        padding: "9px 11px",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {part}
                    </div>
                  ))}
                </div>
              );
            })}
            {aiChatLoading && (
              <div style={{ justifySelf: "start", background: "#f3f4f6", borderRadius: 10, padding: "9px 11px", color: "#6b7280" }}>
                Đang tư vấn...
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", padding: 12 }}>
            {aiChatError && (
              <div style={{ color: "#991b1b", marginBottom: 8, fontWeight: 700 }}>
                {aiChatError}
              </div>
            )}
            <textarea
              placeholder="Nhập tin nhắn..."
              value={aiChatInput}
              onChange={(event) => setAiChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendAiChatMessage();
                }
              }}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 62, maxHeight: 120, resize: "vertical", borderRadius: 8, border: "1px solid #d1d5db", padding: 10, lineHeight: 1.4 }}
            />
            <button
              type="button"
              onClick={sendAiChatMessage}
              disabled={aiChatLoading || !aiChatInput.trim()}
              style={{ width: "100%", marginTop: 8, background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 700, cursor: aiChatLoading || !aiChatInput.trim() ? "default" : "pointer", opacity: aiChatLoading || !aiChatInput.trim() ? 0.65 : 1 }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}

      {showCustomerMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(94vw, 640px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>Soạn tin gửi khách</h3>
            <textarea
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 300, padding: 12, borderRadius: 8, border: "1px solid #d1d5db", lineHeight: 1.5, fontSize: 15 }}
            />
            {copyMessage && (
              <p style={{ color: "#15803d", fontWeight: 700, marginBottom: 0 }}>
                {copyMessage}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <button
                onClick={copyCustomerMessage}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}
              >
                Copy nội dung
              </button>
              <button
                onClick={() => setShowCustomerMessage(false)}
                style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(92vw, 480px)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>Lưu khách</h3>
            <input
              placeholder="Tên tuổi"
              value={saveFullname}
              onChange={(e) => setSaveFullname(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <input
              placeholder="SĐT"
              value={savePhone}
              onChange={(e) => setSavePhone(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <input
              placeholder="Khu vực"
              value={saveDistrict}
              onChange={(e) => setSaveDistrict(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <textarea
              placeholder="Nhu cầu"
              value={saveNeed}
              onChange={(e) => setSaveNeed(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", minHeight: 72, marginBottom: 10 }}
            />
            <input
              placeholder="Thời gian cần thuê/mua"
              value={saveTimeframe}
              onChange={(e) => setSaveTimeframe(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <input
              placeholder="Ngân sách"
              value={saveBudget}
              onChange={(e) => setSaveBudget(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <input
              type="date"
              placeholder="Ngày hẹn chăm sóc lại"
              value={saveFollowUpAt}
              onChange={(e) => setSaveFollowUpAt(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 10 }}
            />
            <textarea
              placeholder="Ghi chú"
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", minHeight: 90, marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowSaveForm(false)}
                style={{ background: "#fff", color: "#111827", border: "1px solid #d1d5db", padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={saveCustomerLead}
                disabled={savingCustomer}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, cursor: savingCustomer ? "default" : "pointer", fontWeight: "bold", opacity: savingCustomer ? 0.7 : 1 }}
              >
                {savingCustomer ? "Đang lưu..." : "Lưu khách"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

