"use client";

import Link from "next/link";
import HomeAreaMap from "@/app/components/home/HomeAreaMap";
import PopularDistricts from "@/app/components/home/PopularDistricts";
import type { PropertyMapListing } from "@/types/map";

type Props = {
  mapListings: PropertyMapListing[];
  districtCounts: Record<string, number>;
};

export default function AreaMapSection({ mapListings, districtCounts }: Props) {
  return (
    <section className="home-section home-area-layout" id="home-area-map">
      <div className="home-area-panel">
        <div className="home-section__heading">
          <h2>Bản đồ khu vực</h2>
          <Link href="#home-area-map">Xem tất cả</Link>
        </div>
        <HomeAreaMap listings={mapListings} />
      </div>
      <PopularDistricts counts={districtCounts} />
    </section>
  );
}
