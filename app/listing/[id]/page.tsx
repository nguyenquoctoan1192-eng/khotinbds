"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import RelatedListingsMapSection from "@/app/components/map/RelatedListingsMapSection";
import RentedStamp from "@/app/components/rented-stamp";
import AIConsultantWidget from "@/app/components/shared/AIConsultantWidget";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";
import type { Listing } from "@/types/listing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ListingDetail() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { role } = useUserRole();

  const viewMode = searchParams.get("view") || "public";

  const isAdminView = viewMode === "admin" && role === "admin";
  const isAgentView = viewMode === "agent" && role === "agent";

  const canSeeRawListing = isAdminView || isAgentView;
  const canManageListing = isAdminView;

  const homeHref =
    viewMode === "admin" ? "/admin" : viewMode === "agent" ? "/agent" : "/";

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const back = searchParams.get("back")?.trim() || "";
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "";

  const from = searchParams.get("from")?.trim() || "";
  const fromSearch = searchParams.get("fromSearch")?.trim() || "";

  const returnUrl = searchParams.get("returnUrl") || "";
  const safeReturnUrl =
    returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "";

  const searchReturnUrl = safeBack
    ? safeBack
    : from === "admin"
    ? "/admin"
    : from === "search"
    ? "/tim-nha"
    : fromSearch
    ? `/?q=${encodeURIComponent(fromSearch)}`
    : safeReturnUrl || homeHref;

  // =========================================================
  // HOOKS — phải khai báo đầy đủ, không điều kiện, không sau return sớm
  // =========================================================

  const [listing, setListing] = useState<any>(null);
  const [relatedListings, setRelatedListings] = useState<Listing[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAiChatWidget, setShowAiChatWidget] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    try {
      setDarkMode(localStorage.getItem("listing-detail-dark") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("listing-detail-dark", darkMode);

    try {
      localStorage.setItem("listing-detail-dark", darkMode ? "1" : "0");
    } catch {}

    return () => {
      document.documentElement.classList.remove("listing-detail-dark");
    };
  }, [darkMode]);

  useEffect(() => {
    if (!id) return;

    const fetchListing = async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("fetch listing failed", error);
        return;
      }

      if (data) {
        setListing(data);
        setSelectedImageIndex(0);
      }
    };

    fetchListing();
  }, [id]);

  useEffect(() => {
    if (!listing?.id) return;

    const fetchRelatedListings = async () => {
      let query = supabase
        .from("listings")
        .select("*")
        .neq("id", listing.id)
        .order("updated_at", { ascending: false })
        .limit(18);

      if (listing.district) {
        query = query.eq("district", listing.district);
      }

      const { data, error } = await query;

      if (error) {
        console.error("related listings failed", error);
        setRelatedListings([]);
        return;
      }

      if (data?.length) {
        setRelatedListings(data as Listing[]);
        return;
      }

      const fallback = await supabase
        .from("listings")
        .select("*")
        .neq("id", listing.id)
        .order("updated_at", { ascending: false })
        .limit(18);

      setRelatedListings((fallback.data || []) as Listing[]);
    };

    fetchRelatedListings();
  }, [listing?.id, listing?.district]);

  const images = useMemo(
    () => (Array.isArray(listing?.images) ? listing.images.filter(Boolean) : []),
    [listing?.images]
  );

  // =========================================================
  // LOADING — mọi hook đã gọi xong ở trên, từ đây trở đi mới
  // được phép đọc listing.<field> trực tiếp (không còn null)
  // =========================================================

  if (!listing) {
    return (
      <div className="ld-loading-page">
        <div className="ld-spinner" />
        <span>Đang tải thông tin tin đăng...</span>

        <style jsx>{`
          .ld-loading-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            background: #f5f5f7;
            color: #68686d;
            font-family: Inter, "Segoe UI", Arial, sans-serif;
          }

          .ld-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e5e5ea;
            border-top-color: #0071e3;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // =========================================================
  // PUBLIC DATA MAPPING (an toàn — listing chắc chắn khác null ở đây)
  // =========================================================

  const publicListing = formatPublicListing(listing);

  const displayTitle = canSeeRawListing
    ? listing.title || publicListing?.publicTitle
    : publicListing?.publicTitle || "Bất động sản cho thuê";

  const publicAddress =
    listing.public_address?.trim() ||
    listing.street?.trim() ||
    listing.street_name?.trim() ||
    listing.district?.trim() ||
    "Khu vực đang cập nhật";

  const rawAddress = listing.address?.trim() || publicAddress;

  const displayAddress = canSeeRawListing ? rawAddress : publicAddress;

  const propertyType = listing.property_type || "Cho thuê";

  const displayPrice = canSeeRawListing
    ? Number(listing.price || 0) > 0
      ? `${Number(listing.price).toLocaleString("vi-VN")} VNĐ`
      : "Liên hệ"
    : publicListing?.price || "Liên hệ";

  const displayArea = publicListing?.area || listing.area || listing.area_m2 || "—";

  const displayStructure = publicListing?.structure || listing.structure || "—";

  const displayDirection = listing.direction || listing.orientation || "—";

  const publicationDate = listing.published_at || listing.created_at || null;
  const updatedDate = listing.updated_at || null;

  const formatDate = (value: string | null) => {
    if (!value) return "Đang cập nhật";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Đang cập nhật";
    }

    return date.toLocaleDateString("vi-VN");
  };

  const relativeTime = (value: string | null) => {
    if (!value) return "Đang cập nhật";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Đang cập nhật";
    }

    const diffMs = Date.now() - date.getTime();

    if (diffMs < 0) {
      return "Vừa cập nhật";
    }

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (minutes < 1) return "Vừa cập nhật";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    if (weeks < 5) return `${weeks} tuần trước`;
    if (months < 12) return `${months} tháng trước`;
    return `${years} năm trước`;
  };

  const publicationLabel = publicationDate
    ? "Ngày đăng"
    : updatedDate
    ? "Cập nhật"
    : "Ngày đăng";

  const publicationValue = publicationDate
    ? formatDate(publicationDate)
    : updatedDate
    ? formatDate(updatedDate)
    : "Đang cập nhật";

  const socialTimeValue = publicationDate || updatedDate;

  const views =
    typeof listing.views === "number" ? listing.views : Number(listing.views || 0);

  const favorites =
    typeof listing.favorites === "number"
      ? listing.favorites
      : Number(listing.favorites || 0);

  const phone = "0946497253";

  const agentName =
    listing.contact_name ||
    listing.agent_name ||
    listing.contactName ||
    "Người đăng tin";

  const description = listing.description?.trim() || "Thông tin mô tả đang được cập nhật.";

  // =========================================================
  // PUBLIC DESCRIPTION — che số điện thoại / giá / hoa hồng / địa chỉ
  // =========================================================

  const sanitizeDetailDescription = (rawDescription: unknown): string => {
    let text = typeof rawDescription === "string" ? rawDescription : "";

    if (!text.trim()) {
      return "Đang cập nhật thông tin.";
    }

    // Địa chỉ / số nhà / tên đường đứng TRƯỚC kích thước (vd:
    // "Nguyễn Hữu Tiến Q.4 4x16 trệt..." hoặc "1C Tống Văn Hên, P.15 4x17...")
    // → cắt bỏ toàn bộ phần trước kích thước NxN / N m2, chỉ giữ lại từ đó trở đi.
    const areaAnchor = text.match(
      /\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?(?:\s*m2?)?|\d+(?:[.,]\d+)?\s*m2\b/u
    );

    if (
      areaAnchor &&
      typeof areaAnchor.index === "number" &&
      areaAnchor.index > 0 &&
      areaAnchor.index <= 120
    ) {
      text = text.slice(areaAnchor.index);
    }

    // Số điện thoại
    text = text.replace(/(?:\+?84|0)(?:[\s.()-]*\d){8,10}/gu, " ");

    // Giá VNĐ
    text = text.replace(
      /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|triệu|tỷ|ty|k|nghìn|ngàn)(?!\p{L})(?:\s*\/\s*tháng)?/giu,
      " "
    );

    // Giá USD
    text = text.replace(
      /(?:\$\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:\$|USD|US\$|đô(?:\s*la)?|dollars?))/giu,
      " "
    );

    // Hoa hồng — bắt mọi biến thể viết tắt: hh, hhtt, hh1/2, hh1t, hh4n1, hh5n1...
    // (KHÔNG dùng \b sau "hh" vì các biến thể này dính liền chữ/số ngay sau "hh")
    text = text.replace(/\bhh[a-z0-9/]*.*$/gimu, " ");
    text = text.replace(/\bhoa\s*hồng\b.*$/gimu, " ");

    // Thông tin liên hệ nội bộ
    text = text.replace(/\b(?:lh|sđt|sdt|nđ|nd)\b.*$/gimu, " ");
    text = text.replace(
      /\b(?:liên\s*hệ|liên\s*lạc|contact|phone|hotline)\s*[:\-]?\s*.*$/gimu,
      " "
    );

    // Dòng "Địa chỉ: ..."
    text = text.replace(/^\s*(?:địa\s*chỉ|dc|đ\/c|address)\s*[:\-]?.*$/gimu, " ");

    // Số nhà ở đầu dòng
    text = text.replace(
      /^\s*\d+[A-Za-z]?(?:(?:\s*[-–]\s*\d+[A-Za-z]?)|(?:\/[A-Za-z0-9]+))?\s+(?=[A-ZÀ-ỸĐ])/gimu,
      ""
    );

    // Xóa cụm địa chỉ public nếu xuất hiện trong mô tả
    const address = typeof displayAddress === "string" ? displayAddress.trim() : "";

    if (address.length >= 5) {
      const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(escapedAddress, "giu"), " ");
    }

    text = text
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/\s+/g, " ")
          .replace(/^[\s,;:|•\-–—]+/, "")
          .replace(/[\s,;:|•\-–—]+$/, "")
          .trim()
      )
      .filter(Boolean)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text || "Đang cập nhật thông tin.";
  };

  const publicDescription = sanitizeDetailDescription(description);

  // =========================================================
// NGÀNH NGHỀ PHÙ HỢP
// =========================================================
//
// Phân tích trực tiếp từ NỘI DUNG CỦA TIN.
// Không dùng danh sách cố định cho mọi tin.
//
// Ưu tiên:
// 1. Từ khóa ngành nghề xuất hiện trong title
// 2. Mô tả
// 3. property_type
// 4. structure
// 5. note / notes
//
// Chỉ hiển thị ngành nghề thực sự có tín hiệu.
// Nếu tin không đủ dữ liệu thì hiển thị nhóm phù hợp
// ở mức tổng quát dựa trên loại mặt bằng.
//

const getSuitableBusinessTypes = (): string[] => {
  // ---- 1. Gom text tín hiệu ngành nghề từ nội dung tin ----
  const rawSource = [
    listing.title,
    displayTitle,
    listing.property_type,
    propertyType,
    listing.description,
    listing.structure,
    listing.note,
    listing.notes,
    listing.frontage,
    listing.road_type,
    listing.street_type,
  ]
    .filter(
      (value): value is string | number =>
        typeof value === "string" || typeof value === "number"
    )
    .map(String)
    .join(" ");

  const source = rawSource
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const has = (...patterns: RegExp[]) =>
    patterns.some((pattern) => pattern.test(source));

  const keywordResult: string[] = [];
  const addKeyword = (value: string) => {
    if (!keywordResult.includes(value)) keywordResult.push(value);
  };

  if (has(/\bquan an\b/, /\bnha hang\b/, /\ban uong\b/, /\bfood\b/, /\bbep\b/, /\bquan nhau\b/, /\bcom\b/, /\bpho\b/, /\bbun\b/, /\bhu tieu\b/, /\bbanh mi\b/, /\bdo an\b/, /\bmon an\b/)) {
    addKeyword("Quán ăn / Nhà hàng");
  }
  if (has(/\bcafe\b/, /\bca phe\b/, /\bcoffee\b/, /\btra sua\b/, /\btea\b/, /\bdo uong\b/, /\bnuoc uong\b/)) {
    addKeyword("Cà phê / Trà sữa");
  }
  if (has(/\bshop\b/, /\bcua hang\b/, /\bban le\b/, /\bretail\b/, /\bkinh doanh hang hoa\b/, /\bmat hang\b/)) {
    addKeyword("Cửa hàng bán lẻ");
  }
  if (has(/\bthoi trang\b/, /\bquan ao\b/, /\bgiay\b/, /\btui xach\b/, /\bmy pham\b/, /\bphu kien\b/, /\btrang suc\b/, /\bnuoc hoa\b/)) {
    addKeyword("Thời trang / Mỹ phẩm");
  }
  if (has(/\bshowroom\b/, /\btrung bay\b/, /\bnoi that\b/, /\bvat lieu xay dung\b/, /\boto\b/, /\bxe hoi\b/, /\bxe may\b/, /\bdien may\b/)) {
    addKeyword("Showroom");
  }
  if (has(/\bvan phong\b/, /\boffice\b/, /\bcong ty\b/, /\bdoanh nghiep\b/, /\bstartup\b/, /\blam viec\b/, /\bphong lam viec\b/, /\btru so\b/)) {
    addKeyword("Văn phòng");
  }
  if (has(/\bspa\b/, /\bnail\b/, /\bsalon\b/, /\bcat toc\b/, /\bgoi dau\b/, /\btoc\b/, /\bbeauty\b/, /\btham my\b/, /\bcham soc da\b/, /\bmassage\b/)) {
    addKeyword("Spa / Nail / Salon");
  }
  if (has(/\btrung tam\b/, /\bdao tao\b/, /\bday hoc\b/, /\bgiao duc\b/, /\bngoai ngu\b/, /\banh ngu\b/, /\blop hoc\b/, /\bgia su\b/, /\bday them\b/)) {
    addKeyword("Trung tâm đào tạo");
  }
  if (has(/\bphong kham\b/, /\bnha khoa\b/, /\by te\b/, /\bbac si\b/, /\bthuoc\b/, /\bduoc\b/, /\bclinic\b/, /\bdental\b/)) {
    addKeyword("Phòng khám / Nha khoa");
  }
  if (has(/\bkho\b/, /\bxuong\b/, /\blogistics\b/, /\bgiao hang\b/, /\bvan chuyen\b/, /\bhang hoa\b/, /\bphuong tien\b/, /\bxe tai\b/)) {
    addKeyword("Kho / Logistics");
  }
  if (has(/\bdich vu\b/, /\btrung tam dich vu\b/, /\bgiat ui\b/, /\bsua chua\b/, /\bbao hanh\b/, /\btu van\b/)) {
    addKeyword("Kinh doanh dịch vụ");
  }

  // ---- 2. Đọc thông số THỰC TẾ của căn nhà ----
  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
      if (match) {
        const n = Number(match[0]);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  };

  // Diện tích (m2)
  const areaM2 =
    toNumber((listing as any).area_m2) ??
    toNumber(listing.area) ??
    toNumber(displayArea);

  // Bề ngang mặt tiền (m) — ưu tiên field riêng, nếu không có thì tách
  // từ kích thước dạng "NxN" trong mô tả (số đầu = ngang, số sau = dài)
  const dimensionMatch = source.match(
    /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/
  );

  const frontageWidth =
    toNumber((listing as any).frontage_width) ??
    toNumber(listing.frontage) ??
    (dimensionMatch ? toNumber(dimensionMatch[1]) : null);

  // Số tầng — ưu tiên field floors, nếu không có thì đọc từ structure/mô tả
  let floors = toNumber(listing.floors);

  if (floors == null) {
    const floorWordMatch = source.match(/(\d+)\s*(?:lau|tang)/);
    if (floorWordMatch) {
      floors = toNumber(floorWordMatch[1]);
      if (floors != null && /tret/.test(source)) floors += 1; // cộng thêm trệt
    } else if (/tret/.test(source)) {
      floors = 1;
    }
  }

  // Vị trí: hẻm hay mặt tiền đường
  const isAlley = has(/\bhem\b/, /\bhxh\b/, /\bngo\b/);
  const isMainFrontage = !isAlley && has(/\bmat tien\b/, /\bmat pho\b/, /\bduong lon\b/);

  // ---- 3. Suy luận ngành nghề phù hợp DỰA TRÊN HIỆN TRẠNG CĂN NHÀ ----
  const inferredResult: string[] = [];
  const addInferred = (value: string) => {
    if (!keywordResult.includes(value) && !inferredResult.includes(value)) {
      inferredResult.push(value);
    }
  };

  const hasFrontage = frontageWidth != null;
  const hasFloors = floors != null;
  const hasArea = areaM2 != null;

  if (isMainFrontage && (!hasFrontage || frontageWidth! >= 8) && (!hasArea || areaM2! >= 80)) {
    addInferred("Showroom");
    addInferred("Ngân hàng / Chi nhánh");
  }

  if (hasFrontage && frontageWidth! >= 4 && (!hasFloors || floors! <= 2)) {
    addInferred("Cửa hàng bán lẻ");
    addInferred("Cà phê / Trà sữa");
  }

  if ((hasFrontage && frontageWidth! < 4) || isAlley) {
    addInferred("Kinh doanh dịch vụ nhỏ");
    addInferred("Văn phòng đại diện");
  }

  if (hasFloors && floors! >= 3) {
    addInferred("Văn phòng");
    addInferred("Trung tâm đào tạo");
  }

  if (hasArea && areaM2! >= 150) {
    addInferred("Phòng khám / Nha khoa");
    addInferred("Kho / Logistics");
  }

  if (hasArea && areaM2! <= 30) {
    addInferred("Spa / Nail / Salon");
  }

  // ---- 4. Ưu tiên tín hiệu từ nội dung tin, bổ sung bằng thông số thực tế ----
  const combined = [...keywordResult, ...inferredResult].slice(0, 5);

  if (combined.length > 0) return combined;

  // ---- 5. Không đủ tín hiệu → không bịa ngành cố định ----
  return [];
};

const suitableBusinessTypes = getSuitableBusinessTypes();

  // =========================================================
  // IMAGES / MAP COORDINATES
  // =========================================================

  const currentImage = images[selectedImageIndex] || images[0] || "";

  const relatedWithCoords = relatedListings.filter(
    (item: any) =>
      typeof item.latitude === "number" &&
      typeof item.longitude === "number" &&
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude)
  );

  const listingHasCoords =
    typeof listing.latitude === "number" &&
    typeof listing.longitude === "number" &&
    Number.isFinite(listing.latitude) &&
    Number.isFinite(listing.longitude);

  // =========================================================
  // GALLERY
  // =========================================================

  const selectImage = (index: number) => {
    if (!images.length) return;

    setSelectedImageIndex(Math.max(0, Math.min(index, images.length - 1)));
  };

  const showPreviousImage = () => {
    if (!images.length) return;

    setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length);
  };

  const showNextImage = () => {
    if (!images.length) return;

    setSelectedImageIndex((selectedImageIndex + 1) % images.length);
  };

  // =========================================================
  // SHARE
  // =========================================================

  const getListingUrl = () => (typeof window === "undefined" ? "" : window.location.href);

  const notify = (message: string) => {
    setShareMessage(message);

    window.setTimeout(() => {
      setShareMessage("");
    }, 2800);
  };

  const copyListingLink = async () => {
    const url = getListingUrl();

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      notify("✓ Đã sao chép link bài tin");
    } catch {
      notify("Không thể sao chép link.");
    }
  };

  const shareToFacebook = () => {
    const url = getListingUrl();

    if (!url) return;

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=700,height=600"
    );
  };

  const shareToMessenger = () => {
    const url = getListingUrl();

    if (!url) return;

    window.open(
      `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=700,height=600"
    );
  };

  const shareToZalo = () => {
    const url = getListingUrl();

    if (!url) return;

    window.open(
      `https://zalo.me/share?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=700,height=700"
    );
  };

  // =========================================================
  // DOWNLOAD IMAGES
  // =========================================================

  const buildImageFileName = (index: number) => {
    const sourceTitle = canSeeRawListing ? listing.title : publicListing?.publicTitle;

    const safeTitle =
      (sourceTitle || "listing")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "listing";

    return `${safeTitle}-${index + 1}.jpg`;
  };

  const downloadImageUrl = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url, {
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error("Cannot download image");
      }

      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 2000);
    } catch {
      const link = document.createElement("a");

      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const downloadListingImages = async () => {
    if (!images.length) {
      notify("Tin này chưa có ảnh để tải.");
      return;
    }

    notify(`Đang tải ${images.length} ảnh...`);

    for (const [index, imageUrl] of images.entries()) {
      await downloadImageUrl(imageUrl, buildImageFileName(index));

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    notify(`✓ Đã tải ${images.length} ảnh.`);
  };

  // =========================================================
  // ADMIN
  // =========================================================

  const refreshPost = async () => {
  try {
    const response = await fetch("/api/listings/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: listing.id,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("REFRESH LISTING ERROR:", result);

      alert(
        result?.message ||
          "Không thể làm mới tin."
      );

      return;
    }

    alert("✓ Đã làm mới tin đăng.");

    window.location.reload();
  } catch (error) {
    console.error("REFRESH REQUEST ERROR:", error);

    alert(
      "Không thể kết nối với máy chủ để làm mới tin."
    );
  }
};

  return (
    <div className={`ld-page ${darkMode ? "dark-mode" : ""}`}>
      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="ld-topbar">
        <div className="ld-topbar-inner">
          <Link href={searchReturnUrl} className="ld-brand">
            <span className="ld-brand-mark">⌂</span>
            <span>BĐS</span>
          </Link>

          <div className="ld-breadcrumb">
            <Link href={searchReturnUrl}>Trang chủ</Link>

            <span>/</span>

            <Link href={searchReturnUrl}>{listing.district || "Khu vực"}</Link>

            <span>/</span>

            <strong>{displayTitle || "Chi tiết bất động sản"}</strong>
          </div>

          <div className="ld-top-actions">
            <button
              type="button"
              className="ld-icon-btn"
              aria-label="Đổi giao diện"
              onClick={() => setDarkMode((v) => !v)}
            >
              {darkMode ? "☀" : "☾"}
            </button>

            <button
              type="button"
              className="ld-save-btn"
              onClick={() => notify("✓ Đã lưu tin")}
            >
              ♡ <span>Lưu</span>
            </button>

            <button
              type="button"
              className="ld-call-top"
              onClick={() => setShowPhone(true)}
            >
              📞 <span>Gọi ngay</span>
            </button>
          </div>
        </div>
      </header>

      <main className="ld-container">
        {/* ======================================================
            HERO
        ====================================================== */}

        <section className="ld-hero">
          {/* GALLERY */}
          <div className="ld-gallery-column">
            <div className="ld-gallery">
              {currentImage ? (
                <div className="ld-gallery-media">
                  <img
                    src={currentImage}
                    alt={displayTitle || "Bất động sản cho thuê"}
                    onClick={() => setShowImageModal(true)}
                    className={listing.status === "rented" ? "ld-rented-image" : ""}
                  />
                </div>
              ) : (
                <div className="ld-gallery-empty">
                  <span>⌂</span>
                  <small>Chưa có hình ảnh</small>
                </div>
              )}

              {listing.status === "rented" && <RentedStamp />}

              <div className="ld-gallery-badge">{propertyType}</div>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="ld-gallery-arrow prev"
                    onClick={showPreviousImage}
                    aria-label="Ảnh trước"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    className="ld-gallery-arrow next"
                    onClick={showNextImage}
                    aria-label="Ảnh tiếp theo"
                  >
                    ›
                  </button>
                </>
              )}

              {images.length > 0 && (
                <div className="ld-gallery-count">📷 {images.length} ảnh</div>
              )}
            </div>

            {images.length > 1 && (
              <div className="ld-thumbnails">
                {images.map((image: string, index: number) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={`ld-thumb ${index === selectedImageIndex ? "active" : ""}`}
                    onClick={() => selectImage(index)}
                  >
                    <img src={image} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PUBLIC INFORMATION */}
          <div className="ld-info">
            <div className="ld-category">{propertyType}</div>

            <div className="ld-price">{displayPrice}</div>

            <h1 className="ld-title">{displayTitle || "Bất động sản cho thuê"}</h1>

            <div className="ld-location">
              <span>📍</span>
              <span>{displayAddress}</span>
            </div>

            <div className="ld-stats">
              <div>
                <span>Diện tích</span>
                <strong>{displayArea}</strong>
              </div>

              <div>
                <span>Kết cấu</span>
                <strong>{displayStructure}</strong>
              </div>

              <div>
                <span>Hướng</span>
                <strong>{displayDirection}</strong>
              </div>

              <div>
                <span>{publicationLabel}</span>
                <strong>{publicationValue}</strong>
              </div>
            </div>

            <div className="ld-actions">
              <button type="button" className="ld-action call" onClick={() => setShowPhone(true)}>
                <span>📞</span>
                <b>{showPhone && phone ? phone : "Gọi điện"}</b>
              </button>

              <button
                type="button"
                className="ld-action chat"
                onClick={() => setShowAiChatWidget(true)}
              >
                <span>💬</span>
                <b>Chat</b>
              </button>

              <button
                type="button"
                className="ld-action share"
                onClick={() => setShowShareModal(true)}
              >
                <span>↗</span>
                <b>Chia sẻ</b>
              </button>
            </div>

            <div className="ld-agent">
              <div className="ld-agent-avatar">{agentName.charAt(0).toUpperCase()}</div>

              <div className="ld-agent-info">
                <strong>{agentName}</strong>
                <span>Người đăng tin</span>
              </div>

              {(listing.contact_verified === true || listing.agent_verified === true) && (
                <span className="ld-verified">✓</span>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================
            SOCIAL PROOF
        ====================================================== */}

        <div className="ld-social-bar">
          <div>
            <span>👁</span>
            <b>{views.toLocaleString("vi-VN")}</b>
            <small>lượt xem</small>
          </div>

          <div>
            <span>♡</span>
            <b>{favorites.toLocaleString("vi-VN")}</b>
            <small>yêu thích</small>
          </div>

          <div>
            <span>🕐</span>
            <b>{relativeTime(socialTimeValue)}</b>
            <small>{publicationDate ? "đăng tin" : "cập nhật"}</small>
          </div>
        </div>

        {/* ======================================================
            DETAIL + DESCRIPTION
        ====================================================== */}

        <section className="ld-feature-grid">
          {/* THÔNG TIN CHI TIẾT */}
          <article className="ld-card">
            <div className="ld-card-heading">
              <div className="ld-card-icon">📋</div>
              <div>
                <h2>Thông tin chi tiết</h2>
                <p>Thông tin cơ bản về bất động sản</p>
              </div>
            </div>

            <div className="ld-detail-list">
              <div>
                <span>Loại hình</span>
                <strong>{propertyType}</strong>
              </div>

              <div>
                <span>Pháp lý</span>
                <strong>{listing.legal_status || "Đang cập nhật"}</strong>
              </div>

              <div>
                <span>Tiền cọc</span>
                <strong>{listing.deposit || "Đang cập nhật"}</strong>
              </div>

              <div>
                <span>Phí MG</span>
                <strong>{listing.broker_fee || listing.commission || "Miễn phí"}</strong>
              </div>

              <div>
                <span>Gần</span>
                <strong>{listing.landmark || listing.nearby || "Đang cập nhật"}</strong>
              </div>
            </div>
          </article>

          {/* MÔ TẢ PUBLIC */}
          <article className="ld-card">
            <div className="ld-card-heading">
              <div className="ld-card-icon">📝</div>
              <div>
                <h2>Mô tả</h2>
                <p>Thông tin chi tiết về bất động sản</p>
              </div>
            </div>

            <div className="ld-description">{publicDescription}</div>

            {suitableBusinessTypes.length > 0 && (
              <div className="ld-business-fit">
                <div className="ld-business-fit-title">
                  <span>💼</span>
                  <strong>Ngành nghề phù hợp</strong>
                </div>

                <div className="ld-business-tags">
                  {suitableBusinessTypes.join(", ")}
                </div>
              </div>
            )}
          </article>
        </section>

        {/* ======================================================
            ADMIN TOOLS
        ====================================================== */}

        {canManageListing && (
          <section className="ld-admin-tools">
            <button onClick={refreshPost}>🔁 Làm mới</button>

            <button onClick={() => window.location.assign(`/edit/${listing.id}`)}>
              ✏️ Sửa tin
            </button>

            <button
              className="danger"
              onClick={async () => {
                if (!confirm("Xóa tin?")) return;

                await supabase.from("listings").delete().eq("id", listing.id);

                location.href = homeHref;
              }}
            >
              🗑 Xóa tin
            </button>
          </section>
        )}

        {/* ======================================================
            MAP
        ====================================================== */}

        <section className="ld-area-section">
          <div className="ld-area-heading">
            <div>
              <div className="ld-area-title">
                <span>📍</span>
                <h2>Khu vực xung quanh</h2>
              </div>

              <p>Bản đồ bất động sản trong khu vực {listing.district || ""}</p>
            </div>

            <button
              type="button"
              className="ld-expand-map"
              onClick={() =>
                document
                  .querySelector(".ld-map-box")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              Mở rộng bản đồ
            </button>
          </div>

          <div className="ld-map-box">
            <div className="ld-map">
              {relatedListings.length === 0 ? (
                <div className="ld-map-empty">
                  Chưa có bất động sản khác trong khu vực này.
                </div>
              ) : (
                <RelatedListingsMapSection
                  listings={relatedListings}
                  currentListing={listing}
                  viewMode={viewMode}
                />
              )}
            </div>

            <div className="ld-map-footer">
              <span>📍 {listing.district || "Khu vực"}</span>
              <span>{relatedWithCoords.length} tin có tọa độ</span>
            </div>
          </div>
        </section>

        {/* ======================================================
            RELATED LISTINGS
        ====================================================== */}

        <section className="ld-related">
          <div className="ld-related-heading">
            <div>
              <h2>🏘 Bất động sản cùng khu vực</h2>
              <p>Các tin đăng khác đang có trong khu vực</p>
            </div>

            <span>{relatedListings.length} tin</span>
          </div>

          {relatedListings.length ? (
            <div className="ld-related-grid">
              {relatedListings.map((item: any) => {
                const itemPublic = formatPublicListing(item);

                const itemImage =
                  Array.isArray(item.images) && item.images.length ? item.images[0] : "";

                const itemPrice =
                  itemPublic?.price ||
                  (item.price
                    ? `${Number(item.price).toLocaleString("vi-VN")} VNĐ`
                    : "Liên hệ");

                const itemPublicAddress =
                  item?.public_address?.trim() ||
                  item?.street?.trim() ||
                  item?.street_name?.trim() ||
                  item?.district?.trim() ||
                  "Khu vực";

                const itemPropertyType = item?.property_type || "Cho thuê";

                return (
                  <Link
                    key={item.id}
                    href={`/listing/${item.id}?view=${viewMode}`}
                    className="ld-related-card"
                  >
                    <div className="ld-related-image">
                      {itemImage ? (
                        <img
                          src={itemImage}
                          alt={itemPublic?.publicTitle || "Bất động sản"}
                          loading="lazy"
                        />
                      ) : (
                        <div className="ld-related-no-image">🏠</div>
                      )}

                      <span>{itemPropertyType}</span>
                    </div>

                    <div className="ld-related-body">
                      <strong className="ld-related-price">{itemPrice}</strong>

                      <h3>{itemPublic?.publicTitle || "Bất động sản cho thuê"}</h3>

                      <p>📍 {itemPublicAddress}</p>

                      <div className="ld-related-meta">
                        <span>📐 {itemPublic?.area || item?.area || "—"}</span>

                        {item.bedrooms != null && <span>🛏 {item.bedrooms} PN</span>}

                        {item.floors != null && <span>🏢 {item.floors} tầng</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="ld-related-empty">Chưa có tin đăng khác trong khu vực.</div>
          )}
        </section>
      </main>

      {/* ========================================================
          PHONE MODAL
      ======================================================== */}

      {showPhone && (
        <div className="ld-phone-overlay" onClick={() => setShowPhone(false)}>
          <div className="ld-phone-modal" onClick={(e) => e.stopPropagation()}>
          

            <div className="ld-phone-icon">📞</div>

            <h3>Liên hệ người đăng</h3>

            {phone ? (
              <>
                <strong>{phone}</strong>
                <a href={`tel:${phone}`}>Gọi ngay</a>
              </>
            ) : (
              <p className="ld-no-phone">Người đăng chưa cung cấp số điện thoại.</p>
            )}

            <button onClick={() => setShowPhone(false)}>Đóng</button>
          </div>
        </div>
      )}

      {/* ========================================================
          AI CONSULTANT WIDGET (thay cho modal tư vấn cũ)
      ======================================================== */}

      <AIConsultantWidget
        hideTrigger
        open={showAiChatWidget}
        onOpenChange={setShowAiChatWidget}
      />

      {/* ========================================================
          IMAGE MODAL
      ======================================================== */}

      {showImageModal && currentImage && (
        <div className="ld-image-modal" onClick={() => setShowImageModal(false)}>
          <button
            className="ld-modal-x image-x"
            onClick={(e) => {
              e.stopPropagation();
              setShowImageModal(false);
            }}
          >
            ×
          </button>

          {images.length > 1 && (
            <button
              className="ld-modal-arrow prev"
              onClick={(e) => {
                e.stopPropagation();
                showPreviousImage();
              }}
            >
              ‹
            </button>
          )}

          <img
            src={currentImage}
            alt={displayTitle || "Bất động sản"}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              className="ld-modal-arrow next"
              onClick={(e) => {
                e.stopPropagation();
                showNextImage();
              }}
            >
              ›
            </button>
          )}

          <div className="ld-modal-count">
            {selectedImageIndex + 1} / {images.length}
          </div>
        </div>
      )}

      {/* ========================================================
          SHARE MODAL
      ======================================================== */}

      {showShareModal && (
        <div className="ld-share-overlay" onClick={() => setShowShareModal(false)}>
          <div className="ld-share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ld-share-header">
              <div>
                <strong>Chia sẻ tin</strong>
                <span>Chia sẻ tin đăng này</span>
              </div>

              <button onClick={() => setShowShareModal(false)}>×</button>
            </div>

            <div className="ld-share-grid">
              <button onClick={copyListingLink}>
                🔗 <span>Sao chép link</span>
              </button>

              <button onClick={shareToFacebook}>
                <b className="facebook-icon">f</b>
                <span>Facebook</span>
              </button>

              <button onClick={shareToMessenger}>
                💬 <span>Messenger</span>
              </button>

              <button onClick={shareToZalo}>
                <b className="zalo-icon">Z</b>
                <span>Zalo</span>
              </button>

              <button onClick={downloadListingImages}>
                ⬇ <span>Tải ảnh</span>
              </button>
            </div>

            {shareMessage && <div className="ld-share-message">{shareMessage}</div>}

            <div className="ld-share-url">{getListingUrl()}</div>
          </div>
        </div>
      )}

      {/* ========================================================
          STYLE
      ======================================================== */}

      <style jsx>{`
        .ld-page {
          --bg: #f5f5f7;
          --surface: #fff;
          --text: #1d1d1f;
          --muted: #86868b;
          --border: #e8e8ed;
          --blue: #0071e3;
          --green: #34c759;
          --msg: #007aff;
          --red: #e11d48;

          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
        }

        .ld-page.dark-mode {
          --bg: #0d0d0d;
          --surface: #1c1c1e;
          --text: #fff;
          --muted: #98989d;
          --border: #3a3a3c;
          --blue: #0a84ff;
        }

        .ld-page *,
        .ld-page *::before,
        .ld-page *::after {
          box-sizing: border-box;
        }

        .ld-topbar {
          position: sticky;
          top: 0;
          z-index: 1000;
          height: 64px;
          background: color-mix(in srgb, var(--surface) 92%, transparent);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }

        .ld-topbar-inner,
        .ld-container {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .ld-topbar-inner {
          height: 100%;
          display: flex;
          align-items: center;
          gap: 25px;
        }

        .ld-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--text);
          font-size: 17px;
          font-weight: 800;
          flex: 0 0 auto;
        }

        .ld-brand-mark {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: var(--blue);
          color: white;
          font-size: 18px;
        }

        .ld-breadcrumb {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 13px;
        }

        .ld-breadcrumb a {
          color: var(--muted);
          text-decoration: none;
        }

        .ld-breadcrumb strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text);
        }

        .ld-top-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ld-icon-btn,
        .ld-save-btn,
        .ld-call-top {
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
        }

        .ld-icon-btn {
          width: 40px;
          font-size: 17px;
        }

        .ld-save-btn {
          padding: 0 14px;
        }

        .ld-call-top {
          padding: 0 16px;
          border-color: var(--blue);
          background: var(--blue);
          color: #fff;
        }

        .ld-icon-btn:hover,
        .ld-save-btn:hover,
        .ld-call-top:hover,
        .ld-action:hover {
          transform: scale(1.02);
        }

        .ld-container {
          padding: 30px 0 70px;
        }

        .ld-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(390px, 0.85fr);
          gap: 38px;
          align-items: start;
        }

        .ld-gallery-column {
          min-width: 0;
        }

        .ld-gallery {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          border-radius: 18px;
          background: #e5e7eb;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.08);
        }

        .ld-gallery-media {
          width: 100%;
          height: 100%;
        }

        .ld-gallery-media img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          object-position: center;
          background: #eceef1;
          cursor: zoom-in;
        }

        .ld-rented-image {
          opacity: 0.58;
        }

        .ld-gallery-empty {
          width: 100%;
          height: 100%;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 8px;
          color: #8c929a;
        }

        .ld-gallery-empty span {
          font-size: 48px;
        }

        .ld-gallery-badge {
          position: absolute;
          top: 15px;
          left: 15px;
          padding: 8px 12px;
          border-radius: 8px;
          background: #e11d48;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
        }

        .ld-gallery-count {
          position: absolute;
          right: 15px;
          bottom: 15px;
          padding: 8px 11px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.58);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          backdrop-filter: blur(8px);
        }

        .ld-gallery-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          color: #222;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 7px 22px rgba(0, 0, 0, 0.16);
        }

        .ld-gallery-arrow.prev {
          left: 14px;
        }

        .ld-gallery-arrow.next {
          right: 14px;
        }

        .ld-thumbnails {
          display: flex;
          gap: 9px;
          overflow-x: auto;
          margin-top: 10px;
          padding-bottom: 2px;
        }

        .ld-thumb {
          flex: 0 0 78px;
          width: 78px;
          height: 56px;
          padding: 0;
          border: 2px solid transparent;
          border-radius: 8px;
          overflow: hidden;
          background: #ddd;
          opacity: 0.65;
          cursor: pointer;
        }

        .ld-thumb.active {
          border-color: var(--blue);
          opacity: 1;
        }

        .ld-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ld-info {
          padding: 22px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 15px;
        }

        .ld-category {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 7px;
          background: rgba(0, 113, 227, 0.09);
          color: var(--blue);
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 13px;
        }

        .ld-price {
          font-size: 32px;
          line-height: 1.05;
          font-weight: 850;
          letter-spacing: -0.8px;
          color: var(--red);
        }

        .ld-title {
          margin: 10px 0 9px;
          font-size: 25px;
          font-weight: 800;
          line-height: 1.3;
          letter-spacing: -0.45px;
          color: var(--text);
        }

        .ld-location {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 22px;
        }

        .ld-location span:first-child {
          flex: 0 0 auto;
        }

        .ld-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .ld-stats > div {
          min-height: 68px;
          padding: 13px 15px;
          border-bottom: 1px solid var(--border);
        }

        .ld-stats > div:nth-child(odd) {
          border-right: 1px solid var(--border);
        }

        .ld-stats > div:nth-last-child(-n + 2) {
          border-bottom: none;
        }

        .ld-stats span {
          display: block;
          color: var(--muted);
          font-size: 11px;
          margin-bottom: 6px;
        }

        .ld-stats strong {
          color: var(--text);
          font-size: 14px;
        }

        .ld-actions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 9px;
          margin-top: 18px;
        }

        .ld-action {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          transition: transform 0.2s ease, background 0.3s ease;
        }

        .ld-action.call {
          border: 1px solid var(--green);
          background: var(--green);
          color: #fff;
        }

        .ld-action.chat {
          border: 1px solid var(--msg);
          background: var(--msg);
          color: #fff;
        }

        .ld-action.share {
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }

        .ld-agent {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .ld-agent-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: rgba(0, 113, 227, 0.1);
          color: var(--blue);
          font-weight: 850;
        }

        .ld-agent-info {
          flex: 1;
          min-width: 0;
        }

        .ld-agent-info strong,
        .ld-agent-info span {
          display: block;
        }

        .ld-agent-info strong {
          font-size: 14px;
          color: var(--text);
        }

        .ld-agent-info span {
          margin-top: 4px;
          font-size: 11px;
          color: var(--muted);
        }

        .ld-verified {
          color: var(--green);
          font-weight: 800;
        }

        .ld-social-bar {
          display: flex;
          align-items: center;
          gap: 0;
          margin-top: 20px;
          padding: 14px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .ld-social-bar > div {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 25px;
          padding: 0 28px;
          border-right: 1px solid var(--border);
        }

        .ld-social-bar > div:first-child {
          padding-left: 0;
        }

        .ld-social-bar > div:last-child {
          border-right: none;
        }

        .ld-social-bar span {
          color: var(--muted);
        }

        .ld-social-bar b {
          font-size: 13px;
          color: var(--text);
        }

        .ld-social-bar small {
          color: var(--muted);
          font-size: 11px;
        }

        .ld-feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-top: 30px;
        }

        .ld-card {
          min-width: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 15px;
          padding: 22px;
        }

        .ld-card-heading {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 19px;
        }

        .ld-card-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: rgba(0, 113, 227, 0.09);
        }

        .ld-card-heading h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: var(--text);
        }

        .ld-card-heading p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .ld-detail-list {
          border-top: 1px solid var(--border);
        }

        .ld-detail-list > div {
          min-height: 47px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }

        .ld-detail-list span {
          color: var(--muted);
        }

        .ld-detail-list strong {
          text-align: right;
          color: var(--text);
          font-weight: 700;
        }

        .ld-business-fit {
          margin-top: 16px;
        }

        .ld-business-fit-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .ld-business-tags {
          color: var(--text);
          opacity: 0.84;
          font-size: 13.5px;
          line-height: 1.7;
        }

        .ld-description {
          color: var(--text);
          opacity: 0.84;
          font-size: 14px;
          line-height: 1.85;
          white-space: pre-line;
          overflow-wrap: anywhere;
        }

        .ld-admin-tools {
          display: flex;
          gap: 8px;
          margin-top: 18px;
        }

        .ld-admin-tools button {
          border: 0;
          border-radius: 9px;
          padding: 10px 14px;
          background: #f59e0b;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .ld-admin-tools button:nth-child(2) {
          background: #10b981;
        }

        .ld-admin-tools .danger {
          background: #ef4444;
        }

        .ld-area-section {
          margin-top: 38px;
        }

        .ld-area-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 14px;
        }

        .ld-area-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ld-area-title span {
          font-size: 20px;
        }

        .ld-area-title h2 {
          margin: 0;
          font-size: 19px;
          color: var(--text);
        }

        .ld-area-heading p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 12px;
        }

        .ld-expand-map {
          height: 37px;
          padding: 0 13px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface);
          color: var(--text);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .ld-map-box {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: var(--surface);
        }

        .ld-map {
          height: 430px;
          min-height: 430px;
        }

        .ld-map :global(.related-map),
        .ld-map :global(.related-map-container) {
          height: 100%;
          min-height: 430px;
        }

        .ld-map-empty {
          height: 100%;
          min-height: 300px;
          display: grid;
          place-items: center;
          color: var(--muted);
          font-size: 13px;
          text-align: center;
          padding: 25px;
        }

        .ld-map-footer {
          min-height: 48px;
          padding: 0 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--muted);
          border-top: 1px solid var(--border);
          font-size: 11px;
        }

        .ld-related {
          margin-top: 38px;
        }

        .ld-related-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .ld-related-heading h2 {
          margin: 0;
          font-size: 19px;
          color: var(--text);
        }

        .ld-related-heading p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 12px;
        }

        .ld-related-heading > span {
          padding: 6px 9px;
          border-radius: 7px;
          background: rgba(0, 113, 227, 0.1);
          color: var(--blue);
          font-size: 11px;
          font-weight: 800;
        }

        .ld-related-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .ld-related-card {
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 13px;
          color: inherit;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease;
        }

        .ld-related-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 35px rgba(0, 0, 0, 0.12);
        }

        .ld-related-image {
          position: relative;
          margin: 10px 10px 0;
          width: calc(100% - 20px);
          height: 175px;
          border-radius: 12px;
          overflow: hidden;
          background: #e5e7eb;
        }

        .ld-related-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .ld-related-image > span {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.58);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
        }

        .ld-related-no-image {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          font-size: 36px;
          color: #999;
        }

        .ld-related-body {
          padding: 14px;
        }

        .ld-related-price {
          display: block;
          color: var(--red);
          font-size: 15px;
        }

        .ld-related-body h3 {
          margin: 6px 0 5px;
          color: var(--text);
          font-size: 14px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .ld-related-body p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ld-related-meta {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          padding-top: 9px;
          border-top: 1px solid var(--border);
          color: var(--muted);
          font-size: 10px;
        }

        .ld-related-empty {
          padding: 45px;
          text-align: center;
          background: var(--surface);
          border: 1px dashed var(--border);
          border-radius: 13px;
          color: var(--muted);
        }

        .ld-phone-overlay,
        .ld-share-overlay,
        .ld-image-modal {
          position: fixed;
          inset: 0;
          z-index: 30000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.55);
        }

        .ld-phone-modal,
        .ld-share-modal {
          width: min(430px, 100%);
          position: relative;
          padding: 24px;
          border-radius: 17px;
          background: var(--surface);
          color: var(--text);
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
        }

        .ld-phone-modal {
          text-align: center;
        }

        .ld-phone-icon {
          font-size: 38px;
        }

        .ld-phone-modal h3 {
          margin: 10px 0 7px;
        }

        .ld-phone-modal > strong {
          display: block;
          font-size: 24px;
        }

        .ld-phone-modal a,
        .ld-phone-modal > button {
          width: 100%;
          min-height: 46px;
          margin-top: 12px;
          border-radius: 9px;
          border: 0;
          display: grid;
          place-items: center;
          text-decoration: none;
          cursor: pointer;
          font-weight: 800;
        }

        .ld-phone-modal a {
          background: var(--green);
          color: #fff;
        }

        .ld-phone-modal > button {
          background: var(--border);
          color: var(--text);
        }

        .ld-no-phone {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .ld-modal-x {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 50%;
          background: var(--border);
          color: var(--text);
          font-size: 20px;
          cursor: pointer;
        }

        .ld-image-modal {
          background: rgba(5, 8, 12, 0.94);
        }

        .ld-image-modal img {
          max-width: 92vw;
          max-height: 88vh;
          object-fit: contain;
          border-radius: 8px;
        }

        .ld-image-modal .image-x {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          top: 18px;
          right: 18px;
        }

        .ld-modal-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 58px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 31px;
          cursor: pointer;
        }

        .ld-modal-arrow.prev {
          left: 18px;
        }

        .ld-modal-arrow.next {
          right: 18px;
        }

        .ld-modal-count {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 7px 13px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.13);
          color: #fff;
          font-size: 11px;
        }

        .ld-share-modal {
          width: min(440px, 100%);
        }

        .ld-share-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 17px;
        }

        .ld-share-header strong,
        .ld-share-header span {
          display: block;
        }

        .ld-share-header strong {
          font-size: 17px;
        }

        .ld-share-header span {
          margin-top: 4px;
          color: var(--muted);
          font-size: 11px;
        }

        .ld-share-header button {
          border: 0;
          background: var(--border);
          color: var(--text);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
        }

        .ld-share-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .ld-share-grid button {
          min-height: 55px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .facebook-icon,
        .zalo-icon {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #fff;
        }

        .facebook-icon {
          background: #1877f2;
        }

        .zalo-icon {
          background: #0068ff;
        }

        .ld-share-message {
          margin-top: 11px;
          padding: 9px;
          border-radius: 8px;
          background: rgba(52, 199, 89, 0.12);
          color: var(--green);
          font-size: 12px;
          font-weight: 700;
        }

        .ld-share-url {
          margin-top: 11px;
          padding: 10px;
          border-radius: 8px;
          background: var(--border);
          color: var(--muted);
          font-size: 10px;
          word-break: break-all;
        }

        @media (max-width: 900px) {
          .ld-hero {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .ld-feature-grid {
            grid-template-columns: 1fr;
          }

          .ld-related-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .ld-topbar {
            height: auto;
          }

          .ld-topbar-inner {
            width: calc(100% - 24px);
            min-height: 60px;
            flex-wrap: wrap;
            gap: 8px 12px;
            padding: 8px 0;
          }

          .ld-brand {
            display: none;
          }

          .ld-breadcrumb {
            order: 1;
            width: 100%;
            font-size: 11px;
          }

          .ld-top-actions {
            position: absolute;
            right: 12px;
            top: 10px;
          }

          .ld-icon-btn,
          .ld-save-btn,
          .ld-call-top {
            height: 38px;
          }

          .ld-save-btn span,
          .ld-call-top span {
            display: none;
          }

          .ld-container {
            width: calc(100% - 24px);
            padding-top: 15px;
          }

          .ld-gallery {
            aspect-ratio: 4 / 3;
            border-radius: 13px;
          }

          .ld-price {
            font-size: 28px;
          }

          .ld-title {
            font-size: 21px;
          }

          .ld-actions {
            grid-template-columns: 1fr;
          }

          .ld-action {
            min-height: 48px;
          }

          .ld-social-bar {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
          }

          .ld-social-bar > div {
            padding: 0 8px;
            justify-content: center;
            flex-wrap: wrap;
            gap: 4px;
            border-right: 1px solid var(--border);
          }

          .ld-social-bar small {
            width: 100%;
            text-align: center;
          }

          .ld-card {
            padding: 18px;
          }

          .ld-map {
            height: 200px;
            min-height: 200px;
          }

          .ld-map :global(.related-map),
          .ld-map :global(.related-map-container) {
            min-height: 200px;
          }

          .ld-expand-map {
            display: none;
          }

          .ld-related-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .ld-related-image {
            height: 125px;
          }

          .ld-related-body {
            padding: 11px;
          }

          .ld-related-meta {
            gap: 6px;
            flex-wrap: wrap;
          }
        }

        @media (max-width: 480px) {
          .ld-related-grid {
            grid-template-columns: 1fr;
          }

          .ld-related-image {
            height: 180px;
          }

          .ld-social-bar b {
            font-size: 12px;
          }

          .ld-social-bar small {
            font-size: 9px;
          }

          .ld-admin-tools {
            flex-wrap: wrap;
          }

          .ld-admin-tools button {
            flex: 1;
          }

          .ld-map-footer {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
