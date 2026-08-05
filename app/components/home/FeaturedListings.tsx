"use client";

import Link from "next/link";
import { useRef } from "react";
import HomeListingCard from "@/app/components/home/HomeListingCard";
import type { Listing } from "@/types/listing";

type Props = {
  listings: Listing[];
  title?: string;
  buildHref: (id: string) => string;
};

export default function FeaturedListings({
  listings,
  title = "Bất động sản nổi bật",
  buildHref,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (listings.length === 0) return null;

  const scroll = (direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="home-section" id="featured-listings">
      <div className="home-section__heading">
        <h2>{title}</h2>
        <div className="home-section__actions">
          <button type="button" aria-label="Tin trước" onClick={() => scroll(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Tin tiếp theo" onClick={() => scroll(1)}>
            ›
          </button>
          <Link href="#new-listings">Xem tất cả →</Link>
        </div>
      </div>
      <div className="featured-listings-row" ref={rowRef}>
        {listings.slice(0, 10).map((listing, index) => (
          <HomeListingCard
            key={listing.id}
            listing={listing}
            href={buildHref(listing.id)}
            priority={index < 2}
          />
        ))}
      </div>
    </section>
  );
}
