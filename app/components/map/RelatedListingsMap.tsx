"use client";

import dynamic from "next/dynamic";
import type { PropertyMapListing } from "@/types/map";

const RelatedListingsMapClient = dynamic(
  () => import("./RelatedListingsMapClient"),
  {
    ssr: false,
    loading: () => (
      <div className="related-map-loading">
        Đang tải bản đồ...
      </div>
    ),
  }
);

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;

  currentListingId: string;

  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
};

export default function RelatedListingsMap({
  listings,
  selectedId,
  hoveredId,
  currentListingId,
  onHover,
  onSelect,
  onView,
}: Props) {
  return (
    <RelatedListingsMapClient
      listings={listings}
      selectedId={selectedId}
      hoveredId={hoveredId}
      currentListingId={currentListingId}
      onHover={onHover}
      onSelect={onSelect}
      onView={onView}
    />
  );
}