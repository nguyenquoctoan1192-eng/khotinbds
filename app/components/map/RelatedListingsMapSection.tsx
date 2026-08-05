"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HorizontalListingsScroller from "@/app/components/map/HorizontalListingsScroller";
import RelatedListingsMap from "@/app/components/map/RelatedListingsMap";
import { normalizeListingForMap } from "@/lib/map/coordinates";
import type { Listing } from "@/types/listing";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  listings: Listing[];
  currentListing: Listing;
  viewMode: string;
};

export default function RelatedListingsMapSection({
  listings,
  currentListing,
  viewMode,
}: Props) {
  const router = useRouter();
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    listings[0]?.id || null
  );
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mapListings = useMemo(
    () =>
      listings
        .map((listing) => normalizeListingForMap(listing))
        .filter((item): item is PropertyMapListing => {
          if (!item) return false;
          return !item.approximateLocation;
        }),
    [listings]
  );
  const cardIds = useMemo(() => listings.map((listing) => listing.id), [listings]);
  const districtTitle =
    String(currentListing.district || listings[0]?.district || "TP.HCM").trim() ||
    "TP.HCM";

  const detailUrl = (listingId: string) => {
    const params = new URLSearchParams();
    if (viewMode) params.set("view", viewMode);
    return `/listing/${listingId}${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const scrollCardIntoView = (listingId: string) => {
    document
      .getElementById(`related-listing-card-${listingId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const selectListing = (listingId: string) => {
    setSelectedListingId(listingId);
    const nextIndex = cardIds.indexOf(listingId);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  };

  const selectMarker = (listingId: string) => {
    selectListing(listingId);
    window.setTimeout(() => scrollCardIntoView(listingId), 30);
  };

  const openListing = (listingId: string) => {
    selectListing(listingId);
    window.setTimeout(() => router.push(detailUrl(listingId)), 160);
  };

  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="related-map-section" aria-labelledby="related-map-heading">
      <h2 id="related-map-heading">Xem thêm các bất động sản khác</h2>
      <div className="related-map-frame">
        <div className="related-map-title">{districtTitle}</div>
        <RelatedListingsMap
          listings={mapListings}
          selectedId={selectedListingId}
          hoveredId={hoveredListingId}
          onHover={setHoveredListingId}
          onSelect={selectMarker}
          onView={openListing}
        />
      </div>
      <HorizontalListingsScroller
        listings={listings}
        selectedId={selectedListingId}
        hoveredId={hoveredListingId}
        activeIndex={activeIndex}
        onActiveIndexChange={(index) => {
          const listingId = listings[index]?.id;
          setActiveIndex(index);
          if (listingId) setSelectedListingId(listingId);
        }}
        onHover={setHoveredListingId}
        onSelect={selectListing}
        onOpen={openListing}
      />
    </section>
  );
}
