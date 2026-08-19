"use client";

import type { CSSProperties } from "react";
import HeroFeaturedListing from "@/app/components/home/HeroFeaturedListing";
import type { Listing } from "@/types/listing";

type Props = {
  featuredListing: Listing | null;
  featuredHref: string;
};

const getHeroImage = (listing: Listing | null) =>
  Array.isArray(listing?.images) && typeof listing.images[0] === "string"
    ? listing.images[0]
    : "";

export default function SimpleHomeHero({ featuredListing, featuredHref }: Props) {
  const heroImage = getHeroImage(featuredListing);

  return (
    <section
      className="home-hero home-hero--image"
      style={
        heroImage
          ? ({ "--home-hero-image": `url("${heroImage}")` } as CSSProperties)
          : undefined
      }
    >
      <div className="home-hero__inner">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">Tìm bất động sản nhanh chóng</p>
          <h1>Nhà đẹp - Giá tốt - Vị trí đẹp</h1>
          <div className="home-hero__facts" aria-label="Thông tin nhanh">
            <span>Nguồn tin đa dạng</span>
            <span>Cập nhật mỗi ngày</span>
            <span>AI tìm đúng nhu cầu</span>
          </div>
        </div>
        <HeroFeaturedListing listing={featuredListing} href={featuredHref} />
      </div>
    </section>
  );
}

