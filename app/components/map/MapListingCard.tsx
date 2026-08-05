"use client";

import RentedStamp from "@/app/components/rented-stamp";
import { getMatchLevel } from "@/lib/map/coordinates";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  item: PropertyMapListing;
  active: boolean;
  compact?: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (item: PropertyMapListing) => void;
};

export default function MapListingCard({
  item,
  active,
  compact = false,
  onHover,
  onSelect,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const matchLevel = getMatchLevel(item.matchScore);
  const reasons = item.matchReasons.slice(0, compact ? 2 : 3);

  return (
    <article
      id={`map-listing-card-${item.id}`}
      className={active ? "map-listing-card map-listing-card--active" : "map-listing-card"}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(item.id)}
    >
      <div className="map-listing-card__image">
        <img src={item.imageUrl} loading="lazy" alt={item.publicTitle} />
        {item.listing.status === "rented" && <RentedStamp />}
      </div>
      <div className="map-listing-card__body">
        <div className="map-listing-card__topline">
          <strong>{item.priceLabel}</strong>
          {item.matchScore !== null && <span>{item.matchScore}%</span>}
        </div>
        <h3>{item.publicTitle}</h3>
        <div className="map-listing-card__meta">
          <span>{item.areaLabel}</span>
          <span>{item.structureLabel}</span>
          <span>{item.bedroomsLabel}</span>
          <span>{item.districtLabel}</span>
          <span>{item.frontageLabel}</span>
        </div>
        {matchLevel && <p className="map-listing-card__match">{matchLevel}</p>}
        {reasons.length > 0 && (
          <ul className="map-listing-card__reasons">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="map-listing-card__actions">
        <button
          type="button"
          className="map-listing-card__button"
          onClick={(event) => {
            event.stopPropagation();
            onView(item.id);
          }}
        >
          Xem chi tiết
        </button>
        {onEdit && (
          <button
            type="button"
            className="map-listing-card__button map-listing-card__button--edit"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(item.id);
            }}
          >
            Sửa tin
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="map-listing-card__button map-listing-card__button--delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            Xóa
          </button>
        )}
      </div>
    </article>
  );
}
