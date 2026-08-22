"use client";

import Link from "next/link";
import RentedStamp from "@/app/components/rented-stamp";
import { getFrontageLabel } from "@/lib/map/coordinates";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import type { Listing } from "@/types/listing";

type Props = {
  listing: Listing;
  href: string;
  variant?: "featured" | "new";
  priority?: boolean;
};

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const hasUsefulDimension = (value: string) => {
  if (!value) return false;
  const compact = value.toLowerCase().replace(/\s/g, "");
  return !/^(0|0m2|0m²|0x0|0\.0|0,0)$/.test(compact);
};

const getPositiveNumberText = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";
  const number = Number(text.replace(",", "."));
  if (Number.isFinite(number) && number <= 0) return "";
  return text;
};

const getTimeAgo = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";

  const time = new Date(text).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = Date.now() - time;
  const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;

  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
};

const getBadge = (listing: Listing) => {
  if (listing.featured || listing.is_featured) return "Nổi bật";
  const frontage = getFrontageLabel(listing);
  if (/HXH|xe hơi/i.test(frontage)) return "Xe hơi";
  if (/mặt tiền/i.test(frontage)) return "Mặt tiền";
  if (listing.created_at) return "Nhà mới";
  return "Giá tốt";
};

export default function HomeListingCard({
  listing,
  href,
  variant = "featured",
  priority = false,
}: Props) {
  const publicListing = formatPublicListing(listing);
  const title = publicListing.publicTitle || asText(listing.title) || "Bất động sản";
  const imageUrl =
    Array.isArray(listing.images) && listing.images[0]
      ? listing.images[0]
      : "https://placehold.co/640x420?text=BDS";
  const views = asText(listing.views || listing.view_count || listing.viewCount);
  const timeAgo = getTimeAgo(listing.created_at || listing.updated_at);
  const bedrooms = getPositiveNumberText(listing.bedrooms);
  const facts = [
    hasUsefulDimension(publicListing.area) ? publicListing.area : "",
    hasUsefulDimension(publicListing.structure) ? publicListing.structure : "",
    bedrooms ? `${bedrooms} PN` : "",
  ].filter(Boolean);
  const className =
    variant === "new" ? "home-listing-card home-listing-card--new" : "home-listing-card";

  return (
    <Link href={href} className={className}>
      <div className="home-listing-card__image">
        <img src={imageUrl} alt={title} loading={priority ? "eager" : "lazy"} />
        {listing.status === "rented" && <RentedStamp />}
        <span className="home-listing-card__badge">{getBadge(listing)}</span>
        <button
          type="button"
          className="home-listing-card__favorite"
          aria-label="Lưu tin yêu thích"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          ♡
        </button>
      </div>
      <div className="home-listing-card__body">
        <strong className="home-listing-card__price">{publicListing.price}</strong>
        <h3>{title}</h3>
        {facts.length > 0 && (
          <div className="home-listing-card__chips">
            {facts.slice(0, 3).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
        )}
        <div className="home-listing-card__foot">
          <span>{asText(listing.district) || "TP.HCM"}</span>
          {views && <span>{views} lượt xem</span>}
          {variant === "new" && timeAgo && <span>{timeAgo}</span>}
        </div>
      </div>
    </Link>
  );
}

