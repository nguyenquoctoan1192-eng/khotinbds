"use client";

import Link from "next/link";
import { useState } from "react";

const categories = [
  { label: "Nhà mới", icon: "⌂", query: "tin mới" },
  { label: "Mặt tiền", icon: "▤", query: "mặt tiền" },
  { label: "Xe hơi", icon: "▰", query: "hẻm xe hơi" },
  { label: "Dưới 20tr", icon: "₫", query: "dưới 20tr" },
  { label: "Gia đình", icon: "⌁", query: "nhà ở gia đình" },
  { label: "Văn phòng", icon: "▦", query: "văn phòng" },
  { label: "Spa, Nail", icon: "✦", query: "spa nail" },
  { label: "Cafe, F&B", icon: "☕", query: "cafe F&B" },
];

const moreCategories = [
  { label: "Kho xưởng", query: "kho xưởng" },
  { label: "Tất cả danh mục", query: "nhà cho thuê" },
];

export default function PopularCategories() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="home-section">
      <div className="home-section__heading">
        <h2>Danh mục phổ biến</h2>
        <button
          type="button"
          className="home-section__text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          Xem thêm
        </button>
      </div>
      <div className="popular-categories">
        {categories.map((category) => (
          <Link
            key={category.label}
            href={`/?q=${encodeURIComponent(category.query)}`}
            className="popular-category"
          >
            <span aria-hidden>{category.icon}</span>
            <strong>{category.label}</strong>
          </Link>
        ))}
      </div>
      {expanded && (
        <div className="popular-categories__more">
          {moreCategories.map((category) => (
            <Link key={category.label} href={`/?q=${encodeURIComponent(category.query)}`}>
              {category.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
