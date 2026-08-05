"use client";

import Link from "next/link";
import HomeListingCard from "@/app/components/home/HomeListingCard";
import type { Listing } from "@/types/listing";

type Props = {
  listings: Listing[];
  buildHref: (id: string) => string;
};

export default function NewListings({ listings, buildHref }: Props) {
  if (listings.length === 0) return null;

  return (
    <section className="home-section" id="new-listings">
      <div className="home-section__heading">
        <h2>Bất động sản mới đăng</h2>
        <Link href="#featured-listings">Xem tất cả →</Link>
      </div>
      <div className="new-listings-grid">
        {listings.slice(0, 6).map((listing) => (
          <HomeListingCard
            key={listing.id}
            listing={listing}
            href={buildHref(listing.id)}
            variant="new"
          />
        ))}
      </div>
    </section>
  );
}
