"use client";

import dynamic from "next/dynamic";
import type { PropertyMapListing } from "@/types/map";

const HomeAreaMapClient = dynamic(() => import("./HomeAreaMapClient"), {
  ssr: false,
  loading: () => <div className="home-area-map-empty">Đang tải bản đồ...</div>,
});

export default function HomeAreaMap({ listings }: { listings: PropertyMapListing[] }) {
  return <HomeAreaMapClient listings={listings} />;
}
