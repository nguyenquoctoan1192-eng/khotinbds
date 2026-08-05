"use client";

import type { MapViewMode } from "@/types/map";

type Props = {
  value: MapViewMode;
  isMobile: boolean;
  onChange: (value: MapViewMode) => void;
};

const options: Array<{ value: MapViewMode; label: string }> = [
  { value: "list", label: "Danh sách" },
  { value: "map", label: "Bản đồ" },
  { value: "split", label: "Chia đôi" },
];

export default function MapViewSwitcher({ value, isMobile, onChange }: Props) {
  const visibleOptions = isMobile
    ? options.filter((option) => option.value !== "split")
    : options;

  return (
    <div className="map-view-switcher" role="tablist" aria-label="Chế độ xem">
      {visibleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "map-view-switcher__button map-view-switcher__button--active" : "map-view-switcher__button"}
          onClick={() => onChange(option.value)}
          role="tab"
          aria-selected={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
