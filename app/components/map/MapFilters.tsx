"use client";

import type { MapFilterState, MapFrontageType, MapPriceRange } from "@/types/map";

type Props = {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
  resultCount: number;
  mapCount: number;
  missingCoordinateCount: number;
};

const priceOptions: Array<{ value: MapPriceRange; label: string }> = [
  { value: "", label: "Tất cả giá" },
  { value: "under20", label: "Dưới 20tr" },
  { value: "20to40", label: "20-40tr" },
  { value: "40to80", label: "40-80tr" },
  { value: "over80", label: "Trên 80tr" },
  { value: "negotiable", label: "Thỏa thuận" },
];

const frontageOptions: Array<{ value: MapFrontageType; label: string }> = [
  { value: "frontage", label: "Mặt tiền" },
  { value: "car_alley", label: "HXH" },
  { value: "alley", label: "Hẻm" },
];

export default function MapFilters({
  value,
  onChange,
  resultCount,
  mapCount,
  missingCoordinateCount,
}: Props) {
  const patch = (next: Partial<MapFilterState>) => onChange({ ...value, ...next });
  const toggleFrontage = (frontage: MapFrontageType) => {
    const next = value.frontageTypes.includes(frontage)
      ? value.frontageTypes.filter((item) => item !== frontage)
      : [...value.frontageTypes, frontage];

    patch({ frontageTypes: next });
  };
  const reset = () => onChange({
    district: "",
    priceRange: "",
    minArea: "",
    bedrooms: "",
    frontageTypes: [],
    newestOnly: false,
    business: "",
    minMatchScore: "",
  });

  return (
    <section className="map-filters" aria-label="Bộ lọc bản đồ">
      <div className="map-filters__summary">
        <strong>{resultCount.toLocaleString("vi-VN")} căn</strong>
        <span>{mapCount.toLocaleString("vi-VN")} marker</span>
        {missingCoordinateCount > 0 && <span>{missingCoordinateCount} căn thiếu tọa độ/quận</span>}
      </div>

      <label>
        <span>Quận</span>
        <input
          value={value.district}
          onChange={(event) => patch({ district: event.target.value })}
          placeholder="Phú Nhuận, Quận 3..."
        />
      </label>

      <label>
        <span>Khoảng giá</span>
        <select
          value={value.priceRange}
          onChange={(event) => patch({ priceRange: event.target.value as MapPriceRange })}
        >
          {priceOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>DT tối thiểu</span>
        <input
          inputMode="numeric"
          value={value.minArea}
          onChange={(event) => patch({ minArea: event.target.value.replace(/[^\d.]/g, "") })}
          placeholder="60"
        />
      </label>

      <label>
        <span>Phòng ngủ</span>
        <input
          inputMode="numeric"
          value={value.bedrooms}
          onChange={(event) => patch({ bedrooms: event.target.value.replace(/[^\d]/g, "") })}
          placeholder="2"
        />
      </label>

      <label>
        <span>Ngành nghề</span>
        <input
          value={value.business}
          onChange={(event) => patch({ business: event.target.value })}
          placeholder="spa, cafe..."
        />
      </label>

      <label>
        <span>AI Match từ</span>
        <input
          inputMode="numeric"
          value={value.minMatchScore}
          onChange={(event) => patch({ minMatchScore: event.target.value.replace(/[^\d]/g, "") })}
          placeholder="75"
        />
      </label>

      <div className="map-filters__toggles" aria-label="Loại đường">
        {frontageOptions.map((option) => (
          <label key={option.value} className="map-filter-check">
            <input
              type="checkbox"
              checked={value.frontageTypes.includes(option.value)}
              onChange={() => toggleFrontage(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <label className="map-filter-check">
          <input
            type="checkbox"
            checked={value.newestOnly}
            onChange={(event) => patch({ newestOnly: event.target.checked })}
          />
          <span>Tin mới</span>
        </label>
      </div>

      <button type="button" className="map-filters__reset" onClick={reset}>
        Xóa lọc
      </button>
    </section>
  );
}

