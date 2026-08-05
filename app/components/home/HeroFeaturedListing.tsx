"use client";

import Link from "next/link";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import type { Listing } from "@/types/listing";

type Props = {
  listing: Listing | null;
  href: string;
};

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

export default function HeroFeaturedListing({ listing, href }: Props) {
  if (!listing) return null;

  const publicListing = formatPublicListing(listing);
  const title = publicListing.publicTitle || asText(listing.title) || "Bất động sản nổi bật";
  const imageUrl = Array.isArray(listing.images) ? asText(listing.images[0]) : "";
  const district = asText(listing.district) || "TP.HCM";

  return (
    <aside className="hero-featured-listing" aria-label="Tin VIP nổi bật">
      <div>
        <span className="hero-featured-listing__badge">Tin VIP nổi bật</span>
        <h2>{title}</h2>
        <p>{district}</p>
      </div>
      {imageUrl && (
        <img src={imageUrl} alt={title} loading="eager" />
      )}
      <div className="hero-featured-listing__bottom">
        <strong>{publicListing.price}</strong>
        <Link href={href}>Xem ngay →</Link>
      </div>
    </aside>
  );
}
