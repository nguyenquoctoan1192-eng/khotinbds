"use client";

import RentedStamp from "@/app/components/rented-stamp";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import { formatPricePill, parsePriceValue, sanitizePublicStreet } from "@/lib/map/coordinates";
import type { Listing } from "@/types/listing";

type Props = {
  listing: Listing;
  active: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const formatDate = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("vi-VN");
};

export default function RelatedListingHorizontalCard({
  listing,
  active,
  hovered,
  onHover,
  onSelect,
  onOpen,
}: Props) {
  const publicListing = formatPublicListing(listing);
  const imageUrl =
    Array.isArray(listing.images) && listing.images[0]
      ? listing.images[0]
      : "https://placehold.co/600x400";
  const title = publicListing.publicTitle || asText(listing.title) || "Bất động sản";
  const priceValue = parsePriceValue(listing.price);
  const price = publicListing.price || formatPricePill(priceValue, listing.price);
  const description =
    asText(listing.short_description) ||
    asText(listing.description) ||
    asText(listing.content);
  const address =
    sanitizePublicStreet(listing.street || listing.address || title) ||
    title;
  const dateLabel = formatDate(listing.updated_at || listing.created_at);
  const views = asText(listing.views || listing.view_count || listing.viewCount);
  const city = asText(listing.city || listing.province || listing.location) || "TP.HCM";
  const activeClass = active || hovered ? " related-horizontal-card--active" : "";

  return (
    <article
      id={`related-listing-card-${listing.id}`}
      className={`related-horizontal-card${activeClass}`}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(listing.id)}
      onBlur={() => onHover(null)}
      onClick={() => {
        onSelect(listing.id);
        onOpen(listing.id);
      }}
    >
      <div className="related-horizontal-card__image">
        <img src={imageUrl} alt={title} loading="lazy" />
        {listing.status === "rented" && <RentedStamp />}
      </div>
      <div className="related-horizontal-card__body">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <div className="related-horizontal-card__meta">
          {views && <span>{views} lượt xem</span>}
          {address && <span>{address}</span>}
          {publicListing.area && <span>{publicListing.area}</span>}
          {price && <span>{price}</span>}
          {city && <span>{city}</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {publicListing.structure && <span>{publicListing.structure}</span>}
          {listing.bedrooms && <span>{listing.bedrooms} PN</span>}
        </div>
      </div>
    </article>
  );
}
