"use client";

import Link from "next/link";

type Props = {
  counts: Record<string, number>;
};

const districts = ["Quận 1", "Quận 3", "Phú Nhuận", "Tân Bình", "Gò Vấp", "Bình Thạnh"];

export default function PopularDistricts({ counts }: Props) {
  return (
    <div className="popular-districts">
      <div className="home-section__heading">
        <h2>Quận nổi bật</h2>
        <Link href="/?q=TP.HCM">Xem tất cả</Link>
      </div>
      <div className="popular-districts__grid">
        {districts.map((district, index) => (
          <Link
            key={district}
            href={`/?q=${encodeURIComponent(district)}`}
            className={`popular-district popular-district--${index + 1}`}
          >
            <span>{district}</span>
            <strong>{(counts[district] || 0).toLocaleString("vi-VN")} tin</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}

