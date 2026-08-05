"use client";

import Link from "next/link";
import HomeHorizontalListingCard, {
  type HomeListingItem,
} from "@/app/components/home/HomeHorizontalListingCard";
import type { Listing } from "@/types/listing";

type Props = {
  items: HomeListingItem[];
  isSearching: boolean;
  buildHref: (id: string) => string;
};

const getListing = (item: HomeListingItem): Listing => item.listing ?? item;

const getTime = (value: unknown) => {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const hasImage = (listing: Listing) =>
  Array.isArray(listing.images) && listing.images.some(Boolean);

const getScore = (value: unknown) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
};

export default function HomeListingsSection({ items, isSearching, buildHref }: Props) {
  const cleanItems = items.filter((item) => getListing(item).id);
  const sortedItems = [...cleanItems].sort((a, b) => {
    const listingA = getListing(a);
    const listingB = getListing(b);

    if (isSearching) {
      const scoreDelta = getScore(b.score) - getScore(a.score);
      if (scoreDelta !== 0) return scoreDelta;
    } else {
      const imageDelta = Number(hasImage(listingB)) - Number(hasImage(listingA));
      if (imageDelta !== 0) return imageDelta;
    }

    return getTime(listingB.created_at || listingB.updated_at) -
      getTime(listingA.created_at || listingA.updated_at);
  });

  return (
    <section className="home-listings-section" id="home-listings">
      <div className="home-listings-section__heading">
        <h2>{isSearching ? "Kết quả phù hợp" : "Bất động sản nổi bật"}</h2>
        <Link href="#home-listings">Xem tất cả →</Link>
      </div>

      <div className="home-horizontal-list">
        {sortedItems.map((item) => {
          const listing = getListing(item);

          return (
            <HomeHorizontalListingCard
              key={listing.id}
              item={item}
              href={buildHref(listing.id)}
              isSearching={isSearching}
            />
          );
        })}
      </div>
    </section>
  );
}
