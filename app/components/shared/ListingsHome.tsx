"use client";

import type { RentalConsultationState } from "@/lib/rentalConsultation";
import type { ListingCardItem } from "./ListingCard";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";
import { noSearchResultsMessage } from "@/lib/searchNormalization";
import SiteNavbar from "@/app/components/site-navbar";
import ListingCard from "@/app/components/shared/ListingCard";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";
import type { Listing } from "@/types/listing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PAGE_SIZE = 20;

type ListingMatchBreakdown = {
  district_score?: number;
  price_score?: number;
  area_score?: number;
  business_score?: number;
  reasons?: string[];
};

type ListingResult = Listing & {
  listing?: Listing;
  listing_id?: string;
  score?: number | string | null;
  breakdown?: ListingMatchBreakdown;
  reasons?: string[];
};

type ListingsResponse = {
  listings?: ListingResult[];
  matches?: ListingResult[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  pagination?: {
    total?: number;
    page?: number;
    pageSize?: number;
    limit?: number;
    totalPages?: number;
  };
  success?: boolean;
  fallbackWarning?: string;
  message?: string;
};



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

type AccessMode = "public" | "agent" | "admin";

export default function ListingsHome({ mode }: { mode: AccessMode }) {
  const router = useRouter();
  const { roleLoading, isAuthenticated } = useUserRole();
  const aiChatContainerRef = useRef<HTMLDivElement | null>(null);
  const listingsSectionRef = useRef<HTMLDivElement | null>(null);
  const [listings, setListings] = useState<ListingResult[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const getListingFromResult = (item: { listing?: Listing; [key: string]: unknown }): Listing =>
  item.listing ?? (item as Listing);
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
    content: "",
    reply_parts: [
      "Em chào anh/chị.",
      "Em là Linh bên BDS.",
      "Anh/chị đang cần thuê để ở hay kinh doanh ạ?",
    ],
  },
]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatProfile, setAiChatProfile] = useState<PublicChatProfile>(
    emptyPublicChatProfile()
  );
  const [rentalConsultState, setRentalConsultState] =
  useState<RentalConsultationState | null>(null);
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


  const getExistingMatches = () =>
    listings
      .map((item) => {
        const listing = getListingFromResult(item);

        return {
          listing_id: item.listing_id || listing.id,
          score: item.score,
          breakdown: item.breakdown,
          reasons: item.reasons || item.breakdown?.reasons || [],
        };
      })
      .filter((match) => match.listing_id);

  const getReasonLabels = (item: ListingCardItem) => {
  const breakdown = item.breakdown as ListingMatchBreakdown | undefined;
  const itemReasons = Array.isArray(item.reasons) ? item.reasons : [];
  const reasons = itemReasons.length > 0 ? itemReasons : breakdown?.reasons || [];
  const labels: string[] = [];

    if (
  Number(breakdown?.district_score ?? 0) > 0 ||
  reasons.some((reason: string) => reason.includes("District"))
) {
  labels.push("Đúng quận");
}

if (
  Number(breakdown?.price_score ?? 0) > 0 ||
  reasons.some((reason: string) => reason.includes("Giá"))
) {
  labels.push("Giá gần ngân sách");
}

if (
  Number(breakdown?.area_score ?? 0) > 0 ||
  reasons.some((reason: string) => reason.includes("Area"))
) {
  labels.push("Diện tích phù hợp");
}

if (Number(breakdown?.business_score ?? 0) > 0) {
  const businessReason = reasons.find((reason: string) =>
    /spa|cafe|office|restaurant|business|MT\/MB|VP|frontage|Premise/i.test(reason)
  );

  const businessType =
    businessReason?.match(/spa|cafe|office|restaurant/i)?.[0] ?? "kinh doanh";

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
        const publicListing = formatPublicListing(listing);
        const reasons = getReasonLabels(item);

        return [
          `${index + 1}. ${publicListing.publicTitle || "Bất động sản phù hợp"}`,
          publicListing.area ? `Diện tích: ${publicListing.area}` : "",
          publicListing.structure ? `Kết cấu: ${publicListing.structure}` : "",
          `Giá: ${publicListing.price}`,
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
    const res = await fetch("/api/rental-consultant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        state: rentalConsultState,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Không xử lý được yêu cầu.");
    }

    setRentalConsultState(json.state || null);

    setAiChatMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: json.reply || "Dạ em nhận được tin nhắn của anh/chị rồi ạ.",
      },
    ]);
  } catch (err) {
    console.error("rental consultant chat request failed", err);
    setAiChatError("");
    setAiChatMessages((current) => [
      ...current,
      {
        role: "assistant",
        content:
          "Dạ em nhận được tin nhắn của anh/chị rồi. Anh/chị nhắn lại giúp em nhu cầu thuê khu vực nào để em tư vấn sát hơn nha.",
      },
    ]);
  } finally {
    setAiChatLoading(false);
  }
};

  const getUrlPage = (value: string | null) => {
    const page = Number(value);

    if (!Number.isFinite(page) || page < 1) {
      return 1;
    }

    return Math.floor(page);
  };

  const updateListingQuery = (
    value: string,
    page: number,
    mode: "push" | "replace" = "replace"
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (value.trim()) {
      url.searchParams.set("q", value);
    } else {
      url.searchParams.delete("q");
    }

    url.searchParams.set("page", String(page));

    window.history[mode === "push" ? "pushState" : "replaceState"](
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    updateListingQuery(value, 1);
  };

  const clearSearch = () => {
    updateSearch("");
  };

  const scrollToListings = () => {
    window.setTimeout(() => {
      listingsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page === currentPage || (totalPages > 0 && page > totalPages)) {
      return;
    }

    setCurrentPage(page);
    updateListingQuery(search, page, "push");
    scrollToListings();
  };

  const buildListingUrl = (listingId: string) => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("fromSearch", search.trim());
    }

    const query = params.toString();
    return query
  ? `/listing/${listingId}?view=${mode}&${query}`
  : `/listing/${listingId}?view=${mode}`;
  };

  const deleteListing = async (listing: Listing) => {
    if (!confirm("Xóa tin?")) return;

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", listing.id);

    if (error) {
      alert("Xóa tin thất bại");
      return;
    }

    setListings((current) =>
      current.filter((item) => getListingFromResult(item)?.id !== listing.id)
    );
  };

  const fetchListings = async () => {
    searchAbortRef.current?.abort();

    const controller = new AbortController();
    searchAbortRef.current = controller;

    setLoading(true);
    setSaveMessage("");
    setSearchWarning("");

    try {
      if (search.trim()) {
        const parsed = parseVietnameseRequirement(search);

        setParsedFilters(parsed);

        const res = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            query: search.trim(),
            mode: "match",
            page: currentPage,
            pageSize: PAGE_SIZE,
            note: parsed.note || null,
            preferred_districts: parsed.preferred_districts,
            max_price: parsed.max_price,
            min_area: parsed.min_area,
            keywordSearch: parsed.keywordSearch,
          }),
        });

        const json = (await res.json()) as ListingsResponse;
        if (controller.signal.aborted) {
          return;
        }

        if (!res.ok || !json.success) {
          setListings([]);
          setTotalListings(0);
          setTotalPages(0);
          setLoading(false);
          return;
        }

        const matches = json.listings || json.matches || [];
        const total = json.total ?? json.pagination?.total ?? matches.length;
        const nextTotalPages =
          json.totalPages ?? json.pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE);

        if (nextTotalPages > 0 && currentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages);
          updateListingQuery(search, nextTotalPages);
          return;
        }

        setListings(matches);
        setTotalListings(total);
        setTotalPages(nextTotalPages);
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

      const params = new URLSearchParams({
        page: String(currentPage),
      });
      const res = await fetch(`/api/listings?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = (await res.json()) as ListingsResponse;

      if (controller.signal.aborted) {
        return;
      }

      if (!res.ok) {
        setListings([]);
        setTotalListings(0);
        setTotalPages(0);
        setLoading(false);
        return;
      }

      const nextListings = json.listings || [];
      const total = json.total ?? nextListings.length;
      const nextTotalPages = json.totalPages ?? Math.ceil(total / PAGE_SIZE);

      if (nextTotalPages > 0 && currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
        updateListingQuery(search, nextTotalPages);
        return;
      }

      setListings(nextListings);
      setTotalListings(total);
      setTotalPages(nextTotalPages);
      setLoading(false);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      console.error(err);
      setListings([]);
      setTotalListings(0);
      setTotalPages(0);
      setLoading(false);
    }
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

  const timer = window.setTimeout(() => {
    fetchListings();
  }, search.trim() ? 500 : 0);

  return () => {
    window.clearTimeout(timer);
    searchAbortRef.current?.abort();
  };
}, [queryReady, search, currentPage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    const page = getUrlPage(params.get("page"));

    if (query && query !== search) {
      setSearch(query);
    }

    setCurrentPage(page);
    setQueryReady(true);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);

      setSearch(params.get("q") || "");
      setCurrentPage(getUrlPage(params.get("page")));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  const paginationItems = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set<number>([
      1,
      totalPages,
      currentPage,
      currentPage - 2,
      currentPage - 1,
      currentPage + 1,
      currentPage + 2,
    ]);
    const visiblePages = Array.from(pages)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
    const items: Array<number | string> = [];

    visiblePages.forEach((page, index) => {
      const previous = visiblePages[index - 1];

      if (previous && page - previous > 1) {
        items.push(`ellipsis-${previous}-${page}`);
      }

      items.push(page);
    });

    return items;
  })();

  return (
    <div style={{ fontFamily: "var(--font-inter)", minHeight: "100vh", background: "#f3f4f6" }}>
      {mode !== "admin" && <SiteNavbar />}

      <section
        style={{
          background: "linear-gradient(120deg,#0f4dc9,#2563eb)",
          color: "#fff",
          padding: "42px 20px 70px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,42px)" }}>
            Tìm bất động sản nhanh chóng
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 18, opacity: 0.92 }}>
            Nhà đẹp - Giá tốt - Vị trí đẹp
          </p>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 20,
            bottom: -45,
            width: 420,
            height: 180,
            border: "2px solid rgba(255,255,255,.16)",
            borderRadius: "50% 50% 0 0",
          }}
        />
      </section>



      <div style={{ maxWidth: 1200, margin: "-38px auto 24px", background: "#fff", padding: 14, borderRadius: 14, boxShadow: "0 12px 28px rgba(15,23,42,0.14)", position: "relative", zIndex: 2 }}>
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

      <div ref={listingsSectionRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ marginBottom: 8 }}>
            {search.trim()
              ? `Kết quả phù hợp (${totalListings})`
              : `Bất động sản nổi bật (${totalListings})`}
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
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
              {listings.map((item) => {
                const listing = getListingFromResult(item);

                return (
                  <ListingCard
                    key={listing.id}
                    item={item}
                    isMobile={isMobile}
                    mode={mode}
                    search={search}
                    getListingFromResult={getListingFromResult}
                    getReasonLabels={getReasonLabels}
                    onView={(listingId) => router.push(buildListingUrl(listingId))}
                    onEdit={(listingId) => router.push(`/edit/${listingId}?view=${mode}`)}
                    onDelete={deleteListing}
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="Phan trang bat dong san"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "9px 13px",
                    background: currentPage <= 1 ? "#f3f4f6" : "#fff",
                    color: currentPage <= 1 ? "#9ca3af" : "#111827",
                    cursor: currentPage <= 1 ? "default" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  « Trước
                </button>

                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToPage(item)}
                      aria-current={item === currentPage ? "page" : undefined}
                      style={{
                        minWidth: 40,
                        border: item === currentPage ? "1px solid #2563eb" : "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "9px 12px",
                        background: item === currentPage ? "#2563eb" : "#fff",
                        color: item === currentPage ? "#fff" : "#111827",
                        cursor: item === currentPage ? "default" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={item}
                      aria-hidden="true"
                      style={{ color: "#6b7280", padding: "0 2px", fontWeight: 700 }}
                    >
                      ...
                    </span>
                  )
                )}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "9px 13px",
                    background: currentPage >= totalPages ? "#f3f4f6" : "#fff",
                    color: currentPage >= totalPages ? "#9ca3af" : "#111827",
                    cursor: currentPage >= totalPages ? "default" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  Sau »
                </button>
              </nav>
            )}
          </>
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
          â†‘
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
          💬 Tư vấn
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

