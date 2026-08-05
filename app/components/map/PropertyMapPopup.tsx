"use client";

import { getMatchLevel } from "@/lib/map/coordinates";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  item: PropertyMapListing;
  onView: (id: string) => void;
};

export default function PropertyMapPopup({ item, onView }: Props) {
  const matchLevel = getMatchLevel(item.matchScore);

  return (
    <div className="property-map-popup">
      <img src={item.imageUrl} alt={item.publicTitle} loading="lazy" />
      <strong>{item.priceLabel}</strong>
      <p>{item.streetLabel}</p>
      <div>
        <span>{item.districtLabel}</span>
        <span>{item.areaLabel}</span>
        <span>{item.structureLabel}</span>
        <span>{item.bedroomsLabel}</span>
      </div>
      {item.approximateLocation && <small>Vị trí xấp xỉ theo quận</small>}
      {matchLevel && (
        <small>
          AI Match: {item.matchScore}% - {matchLevel}
        </small>
      )}
      <button type="button" onClick={() => onView(item.id)}>
        Xem chi tiết
      </button>
    </div>
  );
}
