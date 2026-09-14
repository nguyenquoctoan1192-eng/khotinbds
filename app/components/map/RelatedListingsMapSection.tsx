"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import HorizontalListingsScroller from "@/app/components/map/HorizontalListingsScroller";
import RelatedListingsMap from "@/app/components/map/RelatedListingsMap";
import { normalizeListingForMap } from "@/lib/map/coordinates";

import type { Listing } from "@/types/listing";
import type { PropertyMapListing } from "@/types/map";

type ProviderProps = {
  listings: Listing[];
  currentListing: Listing;
  viewMode: string;
  children: ReactNode;
};

type ContextValue = {
  mapListings: PropertyMapListing[];
  normalizedListings: PropertyMapListing[];
  selectedListingId: string | null;
  hoveredListingId: string | null;
  activeIndex: number;
  districtTitle: string;
  currentListingId: string;
  onHover: (id: string | null) => void;
  onSelectMarker: (id: string) => void;
  onView: (id: string) => void;
  onSelectCard: (id: string) => void;
  onActiveIndexChange: (index: number) => void;
};

const RelatedListingsMapContext = createContext<ContextValue | null>(null);

function useRelatedListingsMapContext() {
  const ctx = useContext(RelatedListingsMapContext);
  if (!ctx) {
    throw new Error(
      "RelatedListingsMapPanel / RelatedListingsScrollerPanel phải nằm trong RelatedListingsMapProvider"
    );
  }
  return ctx;
}

export function RelatedListingsMapProvider({
  listings,
  currentListing,
  viewMode,
  children,
}: ProviderProps) {
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
        .filter((item): item is PropertyMapListing => item !== null),
    [listings, currentListing.id]
  );

  const mapListings = useMemo(() => {
    const result: PropertyMapListing[] = [];
    if (normalizedCurrentListing) result.push(normalizedCurrentListing);
    result.push(...normalizedListings);
    return result;
  }, [normalizedCurrentListing, normalizedListings]);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    currentListing.id
  );
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const districtTitle =
    String(
      currentListing.district ||
        listings.find((l) => l.district)?.district ||
        "TP.HCM"
    ).trim() || "TP.HCM";

  const detailUrl = (listingId: string) => {
    const params = new URLSearchParams();
    if (viewMode) params.set("view", viewMode);
    return `/listing/${listingId}${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const scrollCardIntoView = (listingId: string) => {
    if (listingId === currentListing.id) return;
    document
      .getElementById(`related-listing-card-${listingId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const selectListing = (listingId: string) => {
    setSelectedListingId(listingId);
    const nextIndex = normalizedListings.findIndex((l) => l.id === listingId);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  };

  const selectMarker = (listingId: string) => {
    selectListing(listingId);
    if (listingId === currentListing.id) return;
    window.setTimeout(() => scrollCardIntoView(listingId), 30);
  };

  const openListing = (listingId: string) => {
    selectListing(listingId);
    if (listingId === currentListing.id) return;
    router.push(detailUrl(listingId));
  };

  if (mapListings.length === 0) return null;

  const value: ContextValue = {
    mapListings,
    normalizedListings,
    selectedListingId,
    hoveredListingId,
    activeIndex,
    districtTitle,
    currentListingId: currentListing.id,
    onHover: setHoveredListingId,
    onSelectMarker: selectMarker,
    onView: openListing,
    onSelectCard: selectListing,
    onActiveIndexChange: (index) => {
      const listingId = normalizedListings[index]?.id;
      setActiveIndex(index);
      if (listingId) setSelectedListingId(listingId);
    },
  };

  return (
    <RelatedListingsMapContext.Provider value={value}>
      {children}
    </RelatedListingsMapContext.Provider>
  );
}

/** Chỉ render phần bản đồ — đặt bên trong .ld-map-box */
export function RelatedListingsMapPanel() {
  const {
    mapListings,
    selectedListingId,
    hoveredListingId,
    currentListingId,
    districtTitle,
    onHover,
    onSelectMarker,
    onView,
  } = useRelatedListingsMapContext();

  return (
    <section className="related-map-section" aria-labelledby="related-map-heading">
      <h2 id="related-map-heading">Xem thêm các bất động sản khác</h2>
      <div className="related-map-frame">
        <div className="related-map-title">{districtTitle}</div>
        <RelatedListingsMap
          listings={mapListings}
          selectedId={selectedListingId}
          hoveredId={hoveredListingId}
          currentListingId={currentListingId}
          onHover={onHover}
          onSelect={onSelectMarker}
          onView={onView}
        />
      </div>
    </section>
  );
}

/** Chỉ render thanh trượt — đặt ở NGOÀI .ld-map-box */
export function RelatedListingsScrollerPanel() {
  const {
    normalizedListings,
    selectedListingId,
    hoveredListingId,
    activeIndex,
    onHover,
    onSelectCard,
    onView,
    onActiveIndexChange,
  } = useRelatedListingsMapContext();

  if (normalizedListings.length === 0) return null;

  return (
    <HorizontalListingsScroller
      listings={normalizedListings}
      selectedId={selectedListingId}
      hoveredId={hoveredListingId}
      activeIndex={activeIndex}
      onActiveIndexChange={onActiveIndexChange}
      onHover={onHover}
      onSelect={onSelectCard}
      onOpen={onView}
    />
  );
}