"use client";

import dynamic from "next/dynamic";
import type { MapBounds, PropertyMapListing } from "@/types/map";

const PropertyMapClient = dynamic(() => import("./PropertyMapClient"), {
  ssr: false,
  loading: () => <div className="property-map-loading">Đang tải bản đồ...</div>,
});

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;
  height?: number | string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onBoundsSearch: (bounds: MapBounds | null) => void;
};

export default function PropertyMap(props: Props) {
  return <PropertyMapClient {...props} />;
}

