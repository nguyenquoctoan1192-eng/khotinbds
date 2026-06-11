"use client";

import { useState } from "react";
import {
  ParsedRequirementFilters,
  parseVietnameseRequirement,
} from "@/lib/requirementParser";

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
  };

  return (
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
    </div>
  );
}
