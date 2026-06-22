"use client";

import { useState, useEffect } from "react";
import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { useUserRole } from "@/lib/userRole";

export default function FindPage() {
  const { role } = useUserRole();
  const canSeeRawListing = role === "admin" || role === "broker";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // debounce timer
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchResults(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const fetchResults = async (q: string) => {
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const json = await res.json();
    setResults(json.matches || []);
    setLoading(false);
  };

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // highlight function
  const highlight = (text: string) => {
    const value = String(text || "");
    const keyword = query.trim();

    if (!keyword) return value;

    const regex = new RegExp(`(${escapeRegExp(keyword)})`, "gi");

    return value.split(regex).map((part, index) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={index}>{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20 }}>
      <h1>Tìm nhà (Level 2.5)</h1>

      <input
        placeholder="Nhập quận, giá, phòng..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      {loading && <p>Đang tìm...</p>}

      <div>
        {results.map((item) => {
          const publicListing = formatPublicListing(item);

          return <div
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 10,
              borderRadius: 6,
            }}
          >
            <h3>{highlight(canSeeRawListing ? item.title : publicListing.publicTitle)}</h3>
            {canSeeRawListing ? (
              <>
                <p>{highlight(item.address)}</p>
                <p>Quận: {item.district}</p>
                <p>Phòng ngủ: {item.bedrooms}</p>
                <p>Giá: {Number(item.price).toLocaleString()} VND</p>
              </>
            ) : (
              <>
                <p>Diện tích: {publicListing.area || "Đang cập nhật"}</p>
                <p>Kết cấu: {publicListing.structure || "Đang cập nhật"}</p>
                <p>Giá: {publicListing.price}</p>
              </>
            )}
            <p>Score: {item.score}</p>
            {item.images?.[0] && (
              <div style={{ position: "relative", width: 250, maxWidth: "100%" }}>
                <img
                  src={item.images[0]}
                  alt={canSeeRawListing ? item.title || "Bất động sản" : publicListing.publicTitle}
                  style={{ display: "block", width: "100%", opacity: item.status === "rented" ? 0.6 : 1 }}
                />
                {item.status === "rented" && <RentedStamp />}
              </div>
            )}
          </div>;
        })}
      </div>
    </div>
  );
}
