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

  // highlight function
  const highlight = (text: string) => {
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
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
            <h3 dangerouslySetInnerHTML={{ __html: highlight(item.title) }} />
            <p dangerouslySetInnerHTML={{ __html: highlight(item.address) }} />
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