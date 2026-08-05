"use client";

import HomeListingsSection from "@/app/components/home/HomeListingsSection";
import type { HomeListingItem } from "@/app/components/home/HomeHorizontalListingCard";

type Props = {
  listings: HomeListingItem[];
  isSearching: boolean;
  buildHref: (id: string) => string;
};

export default function PublicHomeContent({ listings, isSearching, buildHref }: Props) {
  return (
    <div className="home-main">
      <HomeListingsSection
        items={listings}
        isSearching={isSearching}
        buildHref={buildHref}
      />
    </div>
  );
}
