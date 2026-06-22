"use client";

import { useState } from "react";
import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";
import SiteNavbar from "@/app/components/site-navbar";

export default function FindHomePage() {
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [district, setDistrict] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minArea, setMinArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [parsedFilters, setParsedFilters] =
    useState<ParsedRequirementFilters | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveFullname, setSaveFullname] = useState("");
  const [savePhone, setSavePhone] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showCustomerMessage, setShowCustomerMessage] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const getExistingMatches = () =>
    results
      .map((item) => {
        const listing = item.listing || item;

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
      fullname ? `khách ${fullname}` : "",
      filters?.preferred_districts?.length
        ? `khu vực ${filters.preferred_districts.join(", ")}`
        : district
          ? `khu vực ${district}`
          : "",
      filters?.max_price
        ? `ngân sách tối đa ${filters.max_price.toLocaleString("vi-VN")} VNĐ`
        : maxPrice
          ? `ngân sách tối đa ${maxPrice}`
          : "",
      filters?.min_area ? `diện tích từ ${filters.min_area}m²` : "",
      filters?.note ? `nhu cầu ${filters.note}` : "",
    ].filter(Boolean);

    return parts.join(", ") || requirementText.trim() || "nhu cầu đang tìm";
  };

  const buildCustomerShareMessage = () => {
    const filters = parsedFilters || parseVietnameseRequirement(requirementText);
    const topMatches = results.slice(0, 3);
    const lines = [
      `Em gửi anh/chị một số căn phù hợp với ${buildNeedSummary(filters)}:`,
      "",
      ...topMatches.flatMap((item, index) => {
        const listing = item.listing || item;
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

  const cleanCrmValue = (value: string) =>
    value
      .replace(/^\s*(?:nhu\s*cau|nhu\s*cầu|need)\s*:\s*/i, "")
      .replace(/^\s*(?:thoi\s*gian\s*can\s*thue\/mua|thoi\s*gian\s*thue\/mua|thời\s*gian\s*cần\s*thuê\/mua|thời\s*gian\s*thuê\/mua|rental_time)\s*:\s*/i, "")
      .replace(/^\s*(?:hen\s*cham\s*soc\s*lai|hẹn\s*chăm\s*sóc\s*lại|follow_up_date)\s*:\s*/i, "")
      .replace(/^\s*(?:ghi\s*chu|ghi\s*chú|note)\s*:\s*/i, "")
      .trim();

  const buildCrmNote = (need: string) => {
    const cleanNeed = cleanCrmValue(need);

    return cleanNeed ? `need=${cleanNeed}` : null;
  };

  const searchHomes = async () => {
    if (!phone) {
      alert("Nhập số điện thoại");
      return;
    }

    const parsed = parseVietnameseRequirement(requirementText);
    const preferredDistricts =
      parsed.preferred_districts.length > 0
        ? parsed.preferred_districts
        : district
          ? [district]
          : [];
    const maxPriceValue =
      parsed.max_price ?? (maxPrice ? Number(maxPrice) : null);
    const minAreaValue =
      parsed.min_area ?? (minArea ? Number(minArea) : null);

    const filters = {
      ...parsed,
      preferred_districts: preferredDistricts,
      max_price: maxPriceValue,
      min_area: minAreaValue,
    };

    setParsedFilters(filters);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullname,
        phone,
        mode: "lead",
        note: filters.note || null,
        preferred_districts: filters.preferred_districts,
        max_price: filters.max_price,
        min_area: filters.min_area,
        bedrooms: bedrooms ? Number(bedrooms) : null,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      alert("Tìm nhà thất bại");
      return;
    }

    setResults(json.matches || []);
    setSaveMessage("");
  };

  const openSaveForm = () => {
    setSaveFullname(fullname);
    setSavePhone(phone);
    setSaveNote(parsedFilters?.note || "");
    setSaveMessage("");
    setShowSaveForm(true);
  };

  const saveCustomerLead = async () => {
    if (!savePhone.trim()) {
      alert("Nhập số điện thoại");
      return;
    }

    const filters = parsedFilters || parseVietnameseRequirement(requirementText);

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
        note: buildCrmNote(saveNote || filters.note || ""),
        preferred_districts: filters.preferred_districts,
        max_price: filters.max_price,
        min_area: filters.min_area,
        bedrooms: bedrooms ? Number(bedrooms) : null,
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

  return (
    <>
      <SiteNavbar />
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: 20,
        }}
      >
      <h1>Tìm nhà phù hợp</h1>

      <input
        placeholder="Họ tên"
        value={fullname}
        onChange={(e) => setFullname(e.target.value)}
      />

      <input
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <textarea
        placeholder="VD: tìm nhà khu vực phú nhuận, làm spa, giá 50tr đổ lại, dt 80m2"
        value={requirementText}
        onChange={(e) => setRequirementText(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          minHeight: 90,
          marginTop: 10,
        }}
      />

      <input
        placeholder="Quận"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
      />

      <input
        placeholder="Ngân sách tối đa"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
      />

      <input
        placeholder="Diện tích tối thiểu"
        value={minArea}
        onChange={(e) => setMinArea(e.target.value)}
      />

      <input
        placeholder="Số phòng ngủ"
        value={bedrooms}
        onChange={(e) => setBedrooms(e.target.value)}
      />

      <button onClick={searchHomes}>Tìm nhà</button>

      {parsedFilters && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginTop: 16,
            borderRadius: 8,
          }}
        >
          <h3>Bộ lọc đã phân tích</h3>
          <p>Quận: {parsedFilters.preferred_districts.join(", ") || "Không có"}</p>
          <p>
            Giá tối đa:{" "}
            {parsedFilters.max_price
              ? parsedFilters.max_price.toLocaleString("vi-VN")
              : "Không có"}
          </p>
          <p>Diện tích tối thiểu: {parsedFilters.min_area || "Không có"}</p>
          <p>Nhu cầu: {parsedFilters.note || "Không có"}</p>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={openSaveForm}>Lưu nhu cầu này thành khách</button>
          <button onClick={openCustomerMessage}>Soạn tin gửi khách</button>
          {saveMessage && <span style={{ color: "#15803d", fontWeight: 700 }}>{saveMessage}</span>}
        </div>
      )}

      <hr />

      {results.map((item) => {
        const listing = item.listing || item;
        const reasonLabels = getReasonLabels(item);

        return (
          <div
            key={listing.id}
            style={{
              border: "1px solid #ddd",
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
            }}
          >
            <h3>{listing.title}</h3>

            <p style={{ fontWeight: 700 }}>
              Điểm phù hợp: {item.score}
            </p>

            {reasonLabels.length > 0 && (
              <div>
                <p>Reasons:</p>
                <ul>
                  {reasonLabels.map((reason) => (
                    <li key={reason}>✓ {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <p>Giá: {Number(listing.price).toLocaleString()}</p>
            <p>{listing.address}</p>
            <p>{listing.district}</p>

            {listing.images?.[0] && (
              <img
                src={listing.images[0]}
                width={250}
              />
            )}
          </div>
        );
      })}

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
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 18,
              width: "min(94vw, 640px)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Soạn tin gửi khách</h3>
            <textarea
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 300,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                lineHeight: 1.5,
                fontSize: 15,
              }}
            />
            {copyMessage && (
              <p style={{ color: "#15803d", fontWeight: 700, marginBottom: 0 }}>
                {copyMessage}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
              <button onClick={copyCustomerMessage}>Copy nội dung</button>
              <button onClick={() => setShowCustomerMessage(false)}>Đóng</button>
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
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 18,
              width: "min(92vw, 420px)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Lưu khách</h3>
            <input
              placeholder="Tên khách"
              value={saveFullname}
              onChange={(e) => setSaveFullname(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />
            <input
              placeholder="Số điện thoại"
              value={savePhone}
              onChange={(e) => setSavePhone(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                marginBottom: 10,
              }}
            />
            <textarea
              placeholder="Ghi chú thêm"
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                minHeight: 90,
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setShowSaveForm(false)}>Hủy</button>
              <button onClick={saveCustomerLead} disabled={savingCustomer}>
                {savingCustomer ? "Đang lưu..." : "Lưu khách"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
