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

  const normalizedCurrentListing = useMemo(
    () => normalizeListingForMap(currentListing),
    [currentListing]
  );

  const normalizedListings = useMemo(
    () =>
      listings
        .filter((listing) => listing.id !== currentListing.id)
        .map((listing) => normalizeListingForMap(listing))
        .filter(
          (item): item is PropertyMapListing => item !== null
        ),
    [listings, currentListing.id]
  );

  const mapListings = useMemo(() => {
    const result: PropertyMapListing[] = [];

    if (normalizedCurrentListing) {
      result.push(normalizedCurrentListing);
    }

    result.push(...normalizedListings);

    return result;
  }, [normalizedCurrentListing, normalizedListings]);

  const [selectedListingId, setSelectedListingId] =
    useState<string | null>(currentListing.id);

  const [hoveredListingId, setHoveredListingId] =
    useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);

  const districtTitle =
    String(
      currentListing.district ||
        listings.find((listing) => listing.district)?.district ||
        "TP.HCM"
    ).trim() || "TP.HCM";

  const detailUrl = (listingId: string) => {
    const params = new URLSearchParams();

    if (viewMode) {
      params.set("view", viewMode);
    }

    return `/listing/${listingId}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
  };

  const scrollCardIntoView = (listingId: string) => {
    if (listingId === currentListing.id) {
      return;
    }

    document
      .getElementById(`related-listing-card-${listingId}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
  };

  const selectListing = (listingId: string) => {
    setSelectedListingId(listingId);

    const nextIndex = normalizedListings.findIndex(
      (listing) => listing.id === listingId
    );

    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  };

  const selectMarker = (listingId: string) => {
    selectListing(listingId);

    if (listingId === currentListing.id) {
      return;
    }

    window.setTimeout(() => {
      scrollCardIntoView(listingId);
    }, 30);
  };

  const openListing = (listingId: string) => {
    selectListing(listingId);

    if (listingId === currentListing.id) {
      return;
    }

    router.push(detailUrl(listingId));
  };

  if (mapListings.length === 0) {
    return null;
  }

  return (
    <section
      className="related-map-section"
      aria-labelledby="related-map-heading"
    >
      <h2 id="related-map-heading">
        Xem thêm các bất động sản khác
      </h2>

      <div className="related-map-frame">
        <div className="related-map-title">
          {districtTitle}
        </div>

        <RelatedListingsMap
          listings={mapListings}
          selectedId={selectedListingId}
          hoveredId={hoveredListingId}
          currentListingId={currentListing.id}
          onHover={setHoveredListingId}
          onSelect={selectMarker}
          onView={openListing}
        />
      </div>

      {normalizedListings.length > 0 && (
        <HorizontalListingsScroller
          listings={normalizedListings}
          selectedId={selectedListingId}
          hoveredId={hoveredListingId}
          activeIndex={activeIndex}
          onActiveIndexChange={(index) => {
            const listingId =
              normalizedListings[index]?.id;

            setActiveIndex(index);

            if (listingId) {
              setSelectedListingId(listingId);
            }
          }}
          onHover={setHoveredListingId}
          onSelect={selectListing}
          onOpen={openListing}
        />
      )}
    </section>
  );
}