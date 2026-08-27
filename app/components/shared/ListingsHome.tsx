"use client";

import type { ListingCardItem } from "./ListingCard";

import { useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";

import { noSearchResultsMessage } from "@/lib/searchNormalization";
import SiteNavbar from "@/app/components/site-navbar";
import ListingCard from "@/app/components/shared/ListingCard";
import AIConsultantWidget from "@/app/components/shared/AIConsultantWidget";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";
import type { Listing } from "@/types/listing";

/* =========================================================
   SUPABASE BROWSER CLIENT
   ========================================================= */

type BrowserWithSupabase = Window & {
  __batdongsanSupabase?: SupabaseClient;
};

const getSupabaseClient = (): SupabaseClient => {
  if (typeof window === "undefined") {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }

  const browser = window as BrowserWithSupabase;

  if (!browser.__batdongsanSupabase) {
    browser.__batdongsanSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }

  return browser.__batdongsanSupabase;
};

/* =========================================================
   TYPES
   ========================================================= */

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

type AccessMode = "public" | "agent" | "admin";

type ListingsHomeProps = {
  mode: AccessMode;
  showNavbar?: boolean;
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ListingsHome({
  mode,
  showNavbar = true,
}: ListingsHomeProps) {
  const router = useRouter();

  const { roleLoading, isAuthenticated } = useUserRole();

  const supabaseRef = useRef<SupabaseClient | null>(null);

  if (!supabaseRef.current) {
    supabaseRef.current = getSupabaseClient();
  }

  const supabase = supabaseRef.current;

  const [listings, setListings] = useState<ListingResult[]>([]);

  const searchAbortRef = useRef<AbortController | null>(null);

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

  const [selectedFacebookListings, setSelectedFacebookListings] =
    useState<Set<string>>(new Set());

  const [facebookQueueBusy, setFacebookQueueBusy] = useState(false);

  const [facebookQueueMessage, setFacebookQueueMessage] = useState("");

  /* =========================================================
     HELPERS
     ========================================================= */

  const getListingFromResult = (item: {
    listing?: Listing;
    [key: string]: unknown;
  }): Listing => {
    return item.listing ?? (item as Listing);
  };

  /* =========================================================
     EXISTING MATCHES
     ========================================================= */

  const getExistingMatches = () => {
    return listings
      .map((item) => {
        const listing = getListingFromResult(item);

        return {
          listing_id: item.listing_id || listing.id,
          score: item.score,
          breakdown: item.breakdown,
          reasons:
            item.reasons ||
            item.breakdown?.reasons ||
            [],
        };
      })
      .filter((match) => match.listing_id);
  };

  /* =========================================================
     REASON LABELS
     ========================================================= */

  const getReasonLabels = (item: ListingCardItem) => {
    const breakdown =
      item.breakdown as ListingMatchBreakdown | undefined;

    const itemReasons = Array.isArray(item.reasons)
      ? item.reasons
      : [];

    const reasons =
      itemReasons.length > 0
        ? itemReasons
        : breakdown?.reasons || [];

    const labels: string[] = [];

    if (
      Number(breakdown?.district_score ?? 0) > 0 ||
      reasons.some((reason: string) =>
        reason.toLowerCase().includes("district")
      )
    ) {
      labels.push("Đúng quận");
    }

    if (
      Number(breakdown?.price_score ?? 0) > 0 ||
      reasons.some((reason: string) =>
        reason.toLowerCase().includes("giá")
      )
    ) {
      labels.push("Giá gần ngân sách");
    }

    if (
      Number(breakdown?.area_score ?? 0) > 0 ||
      reasons.some((reason: string) =>
        reason.toLowerCase().includes("area")
      )
    ) {
      labels.push("Diện tích phù hợp");
    }

    if (Number(breakdown?.business_score ?? 0) > 0) {
      const businessReason = reasons.find((reason: string) =>
        /spa|cafe|office|restaurant|business|MT\/MB|VP|frontage|Premise/i.test(
          reason
        )
      );

      const businessType =
        businessReason?.match(
          /spa|cafe|office|restaurant/i
        )?.[0] ?? "kinh doanh";

      labels.push(`Phù hợp ${businessType}`);
    }

    return labels;
  };

  /* =========================================================
     PRICE
     ========================================================= */

  const formatListingPrice = (price: unknown) => {
    const value = Number(price || 0);

    if (!Number.isFinite(value) || value <= 0) {
      return "Liên hệ";
    }

    return `${value.toLocaleString("vi-VN")} VNĐ`;
  };

  /* =========================================================
     SEARCH SUMMARY
     ========================================================= */

  const buildNeedSummary = (
    filters: ParsedRequirementFilters | null
  ) => {
    const parts = [
      filters?.preferred_districts?.length
        ? `khu vực ${filters.preferred_districts.join(", ")}`
        : "",

      filters?.max_price
        ? `ngân sách tối đa ${filters.max_price.toLocaleString(
            "vi-VN"
          )} VNĐ`
        : "",

      filters?.min_area
        ? `diện tích từ ${filters.min_area}m²`
        : "",

      filters?.note
        ? `nhu cầu ${filters.note}`
        : "",
    ].filter(Boolean);

    return (
      parts.join(", ") ||
      search.trim() ||
      "nhu cầu đang tìm"
    );
  };

  /* =========================================================
     CUSTOMER SHARE MESSAGE
     ========================================================= */

  const buildCustomerShareMessage = () => {
    const filters =
      parsedFilters ||
      parseVietnameseRequirement(search);

    const topMatches = listings.slice(0, 3);

    const lines = [
      `Em gửi anh/chị một số căn phù hợp với ${buildNeedSummary(
        filters
      )}:`,
      "",
      ...topMatches.flatMap((item, index) => {
        const listing = getListingFromResult(item);

        const publicListing =
          formatPublicListing(listing);

        const reasons = getReasonLabels(
          item as ListingCardItem
        );

        return [
          `${index + 1}. ${
            publicListing.publicTitle ||
            "Bất động sản phù hợp"
          }`,

          publicListing.area
            ? `Diện tích: ${publicListing.area}`
            : "",

          publicListing.structure
            ? `Kết cấu: ${publicListing.structure}`
            : "",

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
    setCustomerMessage(
      buildCustomerShareMessage()
    );

    setCopyMessage("");

    setShowCustomerMessage(true);
  };

  const copyCustomerMessage = async () => {
    try {
      await navigator.clipboard.writeText(
        customerMessage
      );

      setCopyMessage("Đã copy nội dung");
    } catch (error) {
      console.error(
        "copy customer message failed",
        error
      );

      setCopyMessage(
        "Không copy được, hãy bôi đen và copy thủ công."
      );
    }
  };

  /* =========================================================
     SEARCH URL
     ========================================================= */

  const replaceSearchQuery = (value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(
      window.location.href
    );

    if (value.trim()) {
      url.searchParams.set(
        "q",
        value
      );
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

  /* =========================================================
     LISTING URL
     ========================================================= */

  const buildListingUrl = (
    listingId: string
  ) => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set(
        "fromSearch",
        search.trim()
      );
    }

    const query = params.toString();

    return query
      ? `/listing/${listingId}?view=${mode}&${query}`
      : `/listing/${listingId}?view=${mode}`;
  };

  /* =========================================================
     DELETE LISTING
     ========================================================= */

  const deleteListing = async (
    listing: Listing
  ) => {
    if (!confirm("Xóa tin?")) {
      return;
    }

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", listing.id);

    if (error) {
      console.error(
        "delete listing failed",
        error
      );

      alert("Xóa tin thất bại");

      return;
    }

    setListings((current) =>
      current.filter(
        (item) =>
          getListingFromResult(item)?.id !==
          listing.id
      )
    );
  };

  /* =========================================================
     FACEBOOK SELECTION
     ========================================================= */

  const toggleFacebookListing = (
    listingId: string
  ) => {
    setSelectedFacebookListings(
      (current) => {
        const next = new Set(current);

        if (next.has(listingId)) {
          next.delete(listingId);
        } else {
          next.add(listingId);
        }

        return next;
      }
    );
  };

  const enqueueSelectedFacebookListings =
    async () => {
      const listingIds = [
        ...selectedFacebookListings,
      ];

      if (
        !listingIds.length ||
        facebookQueueBusy
      ) {
        return;
      }

      setFacebookQueueBusy(true);

      setFacebookQueueMessage("");

      try {
        const response = await fetch(
          "/api/social/sync-today",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              listingIds,
              forceSelected: true,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Không đưa được tin vào hàng chờ Facebook"
          );
        }

        const queued = Number(
          data.queuedListings || 0
        );

        const skipped = Number(
          data.skippedListings || 0
        );

        setFacebookQueueMessage(
          queued > 0
            ? `Đã đưa ${queued} tin vào hàng chờ Facebook${
                skipped
                  ? `, bỏ qua ${skipped} tin`
                  : ""
              }.`
            : data.results?.[0]?.reason ||
                "Không có tin nào được đưa vào hàng chờ."
        );

        if (queued > 0) {
          setSelectedFacebookListings(
            new Set()
          );
        }
      } catch (error) {
        setFacebookQueueMessage(
          error instanceof Error
            ? error.message
            : "Không đưa được tin vào hàng chờ Facebook"
        );
      } finally {
        setFacebookQueueBusy(false);
      }
    };

  /* =========================================================
     FETCH LISTINGS
     ========================================================= */

  const fetchListings = async () => {
    searchAbortRef.current?.abort();

    const controller =
      new AbortController();

    searchAbortRef.current =
      controller;

    setLoading(true);

    setSaveMessage("");

    setSearchWarning("");

    if (search.trim()) {
      const parsed =
        parseVietnameseRequirement(
          search
        );

      setParsedFilters(parsed);

      try {
        const res = await fetch(
          "/api/leads",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body: JSON.stringify({
              query: search.trim(),

              mode: "match",

              note:
                parsed.note ||
                null,

              preferred_districts:
                parsed.preferred_districts,

              max_price:
                parsed.max_price,

              min_area:
                parsed.min_area,

              keywordSearch:
                parsed.keywordSearch,
            }),
          }
        );

        const json =
          await res.json();

        if (controller.signal.aborted) {
          return;
        }

        if (
          !res.ok ||
          !json.success
        ) {
          setListings([]);

          setSearchWarning(
            json.message ||
              "Không tìm được kết quả phù hợp."
          );

          setLoading(false);

          return;
        }

        const matches =
          json.matches || [];

        setListings(matches);

        setSearchWarning(
          json.fallbackWarning ||
            json.message ||
            (matches.length === 0
              ? noSearchResultsMessage
              : "")
        );

        setLoading(false);

        return;
      } catch (error) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        console.error(
          "search listings failed",
          error
        );

        setListings([]);

        setSearchWarning(
          "Không thể tìm kiếm bất động sản lúc này."
        );

        setLoading(false);

        return;
      }
    }

    setParsedFilters(null);

    setSearchWarning("");

    try {
      const {
  data,
  error,
} = await supabase
  .from("listings")
  .select("*")
  .order("published_at", {
    ascending: false,
    nullsFirst: false,
  })
  .order("created_at", {
    ascending: false,
  });

      if (
        controller.signal.aborted
      ) {
        return;
      }

      console.log(
        "LISTINGS FROM SUPABASE:",
        data
      );

      if (error) {
        console.error(
          "Supabase listings error:",
          error
        );

        setListings([]);

        setSearchWarning(
          error.message ||
            "Không thể tải dữ liệu bất động sản."
        );

        setLoading(false);

        return;
      }

      setListings(
        (data || []) as ListingResult[]
      );

      setLoading(false);
    } catch (error) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      console.error(
        "fetch listings failed",
        error
      );

      setListings([]);

      setLoading(false);
    }
  };

  /* =========================================================
     BUDGET
     ========================================================= */

  const parseBudgetValue = (
    value: string
  ) => {
    const normalized = value
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/,/g, "")
      .trim();

    const match =
      normalized.match(
        /(\d+(?:\.\d+)?)/
      );

    if (!match) {
      return null;
    }

    const amount = Number(
      match[1]
    );

    if (!Number.isFinite(amount)) {
      return null;
    }

    if (
      /tr|triệu|trieu/.test(
        normalized
      )
    ) {
      return (
        amount * 1_000_000
      );
    }

    if (
      /tỷ|ty|tỉ/.test(
        normalized
      )
    ) {
      return (
        amount *
        1_000_000_000
      );
    }

    return amount;
  };

  /* =========================================================
     CRM
     ========================================================= */

  const cleanCrmValue = (
    value: string
  ) =>
    value
      .replace(
        /^\s*(?:nhu\s*cau|nhu\s*cầu|need)\s*:\s*/i,
        ""
      )
      .replace(
        /^\s*(?:thoi\s*gian\s*can\s*thue\/mua|thoi\s*gian\s*thue\/mua|thời\s*gian\s*cần\s*thuê\/mua|thời\s*gian\s*thuê\/mua|rental_time)\s*:\s*/i,
        ""
      )
      .replace(
        /^\s*(?:hen\s*cham\s*soc\s*lai|hẹn\s*chăm\s*sóc\s*lại|follow_up_date)\s*:\s*/i,
        ""
      )
      .replace(
        /^\s*(?:ghi\s*chu|ghi\s*chú|note)\s*:\s*/i,
        ""
      )
      .trim();

  const buildCrmNote = (
    fallbackNote?: string
  ) =>
    [
      cleanCrmValue(
        saveNeed ||
          fallbackNote ||
          ""
      )
        ? `need=${cleanCrmValue(
            saveNeed ||
              fallbackNote ||
              ""
          )}`
        : "",

      cleanCrmValue(
        saveTimeframe
      )
        ? `rental_time=${cleanCrmValue(
            saveTimeframe
          )}`
        : "",

      cleanCrmValue(
        saveFollowUpAt
      )
        ? `follow_up_date=${cleanCrmValue(
            saveFollowUpAt
          )}`
        : "",

      cleanCrmValue(
        saveNote
      )
        ? `note=${cleanCrmValue(
            saveNote
          )}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ") || null;

  /* =========================================================
     SAVE CUSTOMER FORM
     ========================================================= */

  const openSaveForm = () => {
    const filters = search.trim()
      ? parseVietnameseRequirement(
          search
        )
      : parsedFilters;

    setSaveFullname("");

    setSavePhone("");

    setSaveDistrict(
      filters?.preferred_districts?.[0] ||
        ""
    );

    setSaveNeed(
      filters?.note || ""
    );

    setSaveBudget(
      filters?.max_price
        ? filters.max_price.toLocaleString(
            "vi-VN"
          )
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

    const filters =
      parsedFilters ||
      parseVietnameseRequirement(
        search
      );

    setSavingCustomer(true);

    try {
      const res = await fetch(
        "/api/leads",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            fullname:
              saveFullname,

            phone: savePhone,

            mode: "lead",

            note: buildCrmNote(
              filters.note ||
                undefined
            ),

            preferred_districts:
              saveDistrict.trim()
                ? [saveDistrict.trim()]
                : filters.preferred_districts,

            max_price:
              parseBudgetValue(
                saveBudget
              ) ??
              filters.max_price,

            min_area:
              filters.min_area,

            existing_matches:
              getExistingMatches(),
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.error ||
            "Lưu khách thất bại"
        );

        return;
      }

      setSaveMessage(
        "Đã lưu khách thành công"
      );

      setShowSaveForm(false);
    } catch (error) {
      console.error(
        "save customer failed",
        error
      );

      alert(
        "Không thể kết nối tới hệ thống lưu khách."
      );
    } finally {
      setSavingCustomer(false);
    }
  };

  /* =========================================================
     SEARCH EFFECT
     ========================================================= */

  useEffect(() => {
    if (!queryReady) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          fetchListings();
        },
        search.trim() ? 500 : 0
      );

    return () => {
      window.clearTimeout(
        timer
      );

      searchAbortRef.current?.abort();
    };
  }, [queryReady, search]);

  /* =========================================================
     INITIAL QUERY
     ========================================================= */

  useEffect(() => {
    const query =
      new URLSearchParams(
        window.location.search
      ).get("q");

    if (
      query &&
      query !== search
    ) {
      setSearch(query);
    }

    setQueryReady(true);
  }, []);

  /* =========================================================
     MOBILE
     ========================================================= */

  useEffect(() => {
    const handleResize =
      () => {
        setIsMobile(
          window.innerWidth < 768
        );
      };

    handleResize();

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  /* =========================================================
     TOP BUTTON
     ========================================================= */

  useEffect(() => {
    const handleScroll =
      () => {
        setShowTopButton(
          window.scrollY > 400
        );
      };

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        background: "#f3f4f6",
      }}
    >
      {showNavbar && <SiteNavbar />}

      {/* =====================================================
          HERO
          ===================================================== */}

      <div
        style={{
          background:
            "linear-gradient(to right,#2563eb,#1d4ed8)",
          color: "#fff",
          padding: "60px 20px",
          textAlign: "center",
        }}
      >
        <h1>
          Tìm bất động sản nhanh chóng
        </h1>

        <p>
          Nhà đẹp - Giá tốt - Vị trí đẹp
        </p>
      </div>

      {/* =====================================================
          AGENT REGISTER
          ===================================================== */}

      {!roleLoading &&
        !isAuthenticated && (
          <section
            role="link"
            tabIndex={0}
            aria-label="Đăng ký môi giới"
            onClick={() =>
              router.push(
                "/register"
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();

                router.push(
                  "/register"
                );
              }
            }}
            style={{
              maxWidth: 900,
              margin:
                "18px auto 0",
              padding:
                "16px 18px",
              border:
                "1px solid #bfdbfe",
              borderRadius: 14,
              background:
                "#eff6ff",
              cursor: "pointer",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: 16,
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    "0 0 5px",
                  fontSize: 20,
                  color:
                    "#1e3a8a",
                }}
              >
                Bạn là môi giới?
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#475569",
                }}
              >
                Tham gia hệ thống để
                nhận khách hàng theo
                khu vực phụ trách.
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                router.push(
                  "/register"
                );
              }}
              style={{
                width: "auto",
                border: 0,
                borderRadius: 9,
                padding:
                  "10px 16px",
                background:
                  "#2563eb",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Đăng ký ngay
            </button>
          </section>
        )}

      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div
        style={{
          maxWidth: 900,
          margin:
            "-30px auto 20px",
          background: "#fff",
          padding: 20,
          borderRadius: 16,
          boxShadow:
            "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems:
              "stretch",
          }}
        >
          <input
            placeholder="VD: tìm nhà khu vực phú nhuận, làm spa, giá 50tr đổ lại, dt 80m2"
            value={search}
            onChange={(e) =>
              updateSearch(
                e.target.value
              )
            }
            style={{
              flex: 1,
              minWidth: 0,
              padding: 18,
              borderRadius: 14,
              border:
                "1px solid #ddd",
              fontSize: 16,
              outline: "none",
            }}
          />

          {search.trim() && (
            <button
              type="button"
              onClick={
                clearSearch
              }
              aria-label="Xóa tìm kiếm"
              style={{
                width: 52,
                borderRadius: 14,
                border:
                  "1px solid #ddd",
                background:
                  "#fff",
                cursor:
                  "pointer",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              X
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          LISTINGS
          ===================================================== */}

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >
          <h2
            style={{
              marginBottom: 8,
            }}
          >
            {search.trim()
              ? `Kết quả phù hợp (${listings.length})`
              : `Bất động sản nổi bật (${listings.length})`}
          </h2>

          {search.trim() && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  openSaveForm()
                }
                style={{
                  background:
                    "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding:
                    "11px 16px",
                  borderRadius: 10,
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                }}
              >
                Lưu nhu cầu này
                thành khách
              </button>

              {listings.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    openCustomerMessage
                  }
                  style={{
                    background:
                      "#111827",
                    color: "#fff",
                    border: "none",
                    padding:
                      "11px 16px",
                    borderRadius: 10,
                    cursor:
                      "pointer",
                    fontWeight:
                      "bold",
                  }}
                >
                  Soạn tin gửi khách
                </button>
              )}
            </div>
          )}
        </div>

        {/* SEARCH WARNING */}

        {searchWarning && (
          <div
            style={{
              background:
                "#fef3c7",
              border:
                "1px solid #f59e0b",
              borderRadius: 10,
              color:
                "#92400e",
              fontWeight: 700,
              marginBottom: 12,
              padding: 12,
            }}
          >
            {searchWarning}
          </div>
        )}

        {/* SAVE MESSAGE */}

        {saveMessage && (
          <p
            style={{
              color:
                "#15803d",
              fontWeight: 700,
              marginTop: 0,
            }}
          >
            {saveMessage}
          </p>
        )}

        {/* FACEBOOK MESSAGE */}

        {mode === "admin" &&
          facebookQueueMessage && (
            <div
              style={{
                background:
                  "#eff6ff",
                border:
                  "1px solid #93c5fd",
                borderRadius: 10,
                color:
                  "#1e3a8a",
                fontWeight: 700,
                marginBottom: 12,
                padding: 12,
              }}
            >
              {
                facebookQueueMessage
              }
            </div>
          )}

        {/* LIST */}

        {loading ? (
          <p>Đang tải...</p>
        ) : listings.length ===
            0 &&
          !searchWarning ? (
          <p>
            Không tìm thấy dữ liệu
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 18,
              marginTop: 20,
            }}
          >
            {listings.map(
              (item) => {
                const listing =
                  getListingFromResult(
                    item
                  );

                const isSelectedForFacebook =
                  selectedFacebookListings.has(
                    listing.id
                  );

                return (
                  <div
                    key={
                      listing.id
                    }
                    style={{
                      position:
                        "relative",
                      border:
                        mode ===
                          "admin" &&
                        isSelectedForFacebook
                          ? "2px solid #2563eb"
                          : "2px solid transparent",
                      borderRadius: 14,
                    }}
                  >
                    

                    <ListingCard
                      item={item}
                      isMobile={
                        isMobile
                      }
                      mode={mode}
                      search={
                        search
                      }
                      getListingFromResult={
                        getListingFromResult
                      }
                      getReasonLabels={
                        getReasonLabels
                      }
                      onView={(
                        listingId
                      ) =>
                        router.push(
                          buildListingUrl(
                            listingId
                          )
                        )
                      }
                      onEdit={(
                        listingId
                      ) =>
                        router.push(
                          `/edit/${listingId}?view=${mode}`
                        )
                      }
                      onDelete={
                        deleteListing
                      }
                    />
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          FACEBOOK FLOATING BAR
          ===================================================== */}

      {mode === "admin" &&
        selectedFacebookListings.size >
          0 && (
          <div
            style={{
              position:
                "fixed",
              left: "50%",
              bottom: 22,
              transform:
                "translateX(-50%)",
              zIndex: 10020,
              display:
                "flex",
              alignItems:
                "center",
              gap: 12,
              width:
                "min(92vw, 620px)",
              background:
                "#0f172a",
              color: "#fff",
              borderRadius: 14,
              boxShadow:
                "0 14px 36px rgba(15,23,42,0.35)",
              padding:
                "12px 14px",
            }}
          >
            <strong
              style={{
                flex: 1,
              }}
            >
              Đã chọn{" "}
              {
                selectedFacebookListings.size
              }{" "}
              tin
            </strong>

            <button
              type="button"
              onClick={() =>
                setSelectedFacebookListings(
                  new Set()
                )
              }
              disabled={
                facebookQueueBusy
              }
              style={{
                border:
                  "1px solid #475569",
                borderRadius: 9,
                background:
                  "transparent",
                color: "#fff",
                cursor:
                  "pointer",
                padding:
                  "9px 12px",
              }}
            >
              Bỏ chọn
            </button>

            <button
              type="button"
              onClick={
                enqueueSelectedFacebookListings
              }
              disabled={
                facebookQueueBusy
              }
              style={{
                border: 0,
                borderRadius: 9,
                background:
                  "#2563eb",
                color: "#fff",
                cursor:
                  facebookQueueBusy
                    ? "default"
                    : "pointer",
                fontWeight:
                  700,
                opacity:
                  facebookQueueBusy
                    ? 0.7
                    : 1,
                padding:
                  "10px 14px",
              }}
            >
              {facebookQueueBusy
                ? "Đang đưa vào hàng chờ..."
                : "Đưa vào hàng chờ Facebook"}
            </button>
          </div>
        )}

      {/* =====================================================
          TOP BUTTON
          ===================================================== */}

      {showTopButton && (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior:
                "smooth",
            })
          }
          style={{
            position:
              "fixed",
            right: 20,
            bottom: 20,
            width: 55,
            height: 55,
            borderRadius:
              "50%",
            border: "none",
            background:
              "#2563eb",
            color: "#fff",
            fontSize: 24,
            cursor:
              "pointer",
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 9999,
          }}
        >
          ↑
        </button>
      )}

      {/* =====================================================
          TƯ VẤN AI — widget dùng chung (xem
          app/components/shared/AIConsultantWidget.tsx)
          ===================================================== */}

      <AIConsultantWidget liftForScrollButton={showTopButton} />

      {/* =====================================================
          CUSTOMER MESSAGE MODAL
          ===================================================== */}

      {showCustomerMessage && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(17,24,39,0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background:
                "#fff",
              borderRadius: 12,
              padding: 18,
              width:
                "min(94vw, 640px)",
              maxHeight:
                "90vh",
              overflowY:
                "auto",
              boxShadow:
                "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              Soạn tin gửi khách
            </h3>

            <textarea
              value={
                customerMessage
              }
              onChange={(e) =>
                setCustomerMessage(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                minHeight: 300,
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                lineHeight:
                  1.5,
                fontSize: 15,
              }}
            />

            {copyMessage && (
              <p
                style={{
                  color:
                    "#15803d",
                  fontWeight:
                    700,
                  marginBottom:
                    0,
                }}
              >
                {copyMessage}
              </p>
            )}

            <div
              style={{
                display:
                  "flex",
                gap: 10,
                justifyContent:
                  "flex-end",
                flexWrap:
                  "wrap",
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={
                  copyCustomerMessage
                }
                style={{
                  background:
                    "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding:
                    "10px 14px",
                  borderRadius: 8,
                  cursor:
                    "pointer",
                  fontWeight:
                    "bold",
                }}
              >
                Copy nội dung
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowCustomerMessage(
                    false
                  )
                }
                style={{
                  background:
                    "#fff",
                  color:
                    "#111827",
                  border:
                    "1px solid #d1d5db",
                  padding:
                    "10px 14px",
                  borderRadius: 8,
                  cursor:
                    "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SAVE CUSTOMER MODAL
          ===================================================== */}

      {showSaveForm && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(17,24,39,0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background:
                "#fff",
              borderRadius: 12,
              padding: 18,
              width:
                "min(92vw, 480px)",
              maxHeight:
                "90vh",
              overflowY:
                "auto",
              boxShadow:
                "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              Lưu khách
            </h3>

            <input
              placeholder="Tên tuổi"
              value={
                saveFullname
              }
              onChange={(e) =>
                setSaveFullname(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <input
              placeholder="SĐT"
              value={savePhone}
              onChange={(e) =>
                setSavePhone(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <input
              placeholder="Khu vực"
              value={
                saveDistrict
              }
              onChange={(e) =>
                setSaveDistrict(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <textarea
              placeholder="Nhu cầu"
              value={saveNeed}
              onChange={(e) =>
                setSaveNeed(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                minHeight: 72,
                marginBottom: 10,
              }}
            />

            <input
              placeholder="Thời gian cần thuê/mua"
              value={
                saveTimeframe
              }
              onChange={(e) =>
                setSaveTimeframe(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <input
              placeholder="Ngân sách"
              value={
                saveBudget
              }
              onChange={(e) =>
                setSaveBudget(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <input
              type="date"
              value={
                saveFollowUpAt
              }
              onChange={(e) =>
                setSaveFollowUpAt(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />

            <textarea
              placeholder="Ghi chú"
              value={saveNote}
              onChange={(e) =>
                setSaveNote(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                padding: 12,
                borderRadius: 8,
                border:
                  "1px solid #d1d5db",
                minHeight: 90,
                marginBottom: 14,
              }}
            />

            <div
              style={{
                display:
                  "flex",
                gap: 10,
                justifyContent:
                  "flex-end",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowSaveForm(
                    false
                  )
                }
                style={{
                  background:
                    "#fff",
                  color:
                    "#111827",
                  border:
                    "1px solid #d1d5db",
                  padding:
                    "10px 14px",
                  borderRadius: 8,
                  cursor:
                    "pointer",
                }}
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={
                  saveCustomerLead
                }
                disabled={
                  savingCustomer
                }
                style={{
                  background:
                    "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding:
                    "10px 14px",
                  borderRadius: 8,
                  cursor:
                    savingCustomer
                      ? "default"
                      : "pointer",
                  fontWeight:
                    "bold",
                  opacity:
                    savingCustomer
                      ? 0.7
                      : 1,
                }}
              >
                {savingCustomer
                  ? "Đang lưu..."
                  : "Lưu khách"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
