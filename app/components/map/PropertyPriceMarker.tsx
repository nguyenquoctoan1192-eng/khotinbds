"use client";

import L from "leaflet";
import { getPriceTone } from "@/lib/map/coordinates";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[char] || char;
  });

export function createPropertyPriceIcon(priceLabel: string, priceValue: number | null, active: boolean, topMatch: boolean) {
  const tone = getPriceTone(priceValue);
  const className = [
    "property-price-marker",
    `property-price-marker--${tone}`,
    active ? "property-price-marker--active" : "",
    topMatch ? "property-price-marker--top-match" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const width = Math.max(active ? 78 : 64, priceLabel.length * 9 + 22);

  return L.divIcon({
    className: "property-price-marker-wrap",
    html: `<span class="${className}">${escapeHtml(priceLabel)}</span>`,
    iconSize: active ? [width + 8, 34] : [width, 30],
    iconAnchor: active ? [(width + 8) / 2, 17] : [width / 2, 15],
    popupAnchor: [0, -18],
  });
}
