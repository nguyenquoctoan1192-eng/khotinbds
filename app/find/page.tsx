"use client";

import { useState, useEffect } from "react";

export default function FindPage() {
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
        {results.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              marginBottom: 10,
              borderRadius: 6,
            }}
          >
            <h3>{highlight(item.title)}</h3>
            <p>{highlight(item.address)}</p>
            <p>Quận: {item.district}</p>
            <p>Phòng ngủ: {item.bedrooms}</p>
            <p>Giá: {Number(item.price).toLocaleString()} VND</p>
            <p>Score: {item.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
