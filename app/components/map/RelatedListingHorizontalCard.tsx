"use client";

import RentedStamp from "@/app/components/rented-stamp";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  item: PropertyMapListing;
  active: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

const formatDate = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("vi-VN");
};

export default function RelatedListingHorizontalCard({
  item,
  active,
  hovered,
  onHover,
  onSelect,
  onOpen,
}: Props) {
  const activeClass =
    active || hovered ? " related-horizontal-card--active" : "";

  const dateLabel = formatDate(item.updatedAt);

  return (
    <article
      id={`related-listing-card-${item.id}`}
      className={`related-horizontal-card${activeClass}`}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item.id)}
      onBlur={() => onHover(null)}
      onClick={() => {
        onSelect(item.id);
        onOpen(item.id);
      }}
    >
      <div className="related-horizontal-card__image">
        <img
          src={item.imageUrl}
          alt={item.publicTitle}
          loading="lazy"
        />

        {item.listing.status === "rented" && <RentedStamp />}
      </div>

      <div className="related-horizontal-card__body">
        <h3>{item.publicTitle}</h3>

        <div className="related-horizontal-card__meta">
          {item.priceLabel && (
            <span>{item.priceLabel}</span>
          )}

          {item.areaLabel && (
            <span>{item.areaLabel}</span>
          )}

          {item.structureLabel && (
            <span>{item.structureLabel}</span>
          )}

          {item.bedroomsLabel && (
            <span>{item.bedroomsLabel}</span>
          )}

          {item.frontageLabel && (
            <span>{item.frontageLabel}</span>
          )}

          {item.streetLabel && (
            <span>{item.streetLabel}</span>
          )}

          {item.districtLabel && (
            <span>{item.districtLabel}</span>
          )}

          {dateLabel && (
            <span>{dateLabel}</span>
          )}
        </div>

        {item.approximateLocation && (
          <small>Vị trí xấp xỉ theo quận</small>
        )}

        {item.matchScore !== null && (
          <small>
            AI Match: {item.matchScore}%{" "}
            {item.matchReasons.length > 0 &&
              `• ${item.matchReasons[0]}`}
          </small>
        )}
      </div>
    </article>
  );
}