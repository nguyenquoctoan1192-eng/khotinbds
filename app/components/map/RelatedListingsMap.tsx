"use client";

import dynamic from "next/dynamic";
import type { PropertyMapListing } from "@/types/map";

const RelatedListingsMapClient = dynamic(() => import("./RelatedListingsMapClient"), {
  ssr: false,
  loading: () => <div className="related-map-loading">Đang tải bản đồ...</div>,
});

type Props = {
  listings: PropertyMapListing[];
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
};

export default function RelatedListingsMap(props: Props) {
  return <RelatedListingsMapClient {...props} />;
}

