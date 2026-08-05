"use client";

import Link from "next/link";
import RentedStamp from "@/app/components/rented-stamp";
import { getFrontageLabel } from "@/lib/map/coordinates";
import { formatPublicListing } from "@/lib/publicListingFormatter";
import type { Listing } from "@/types/listing";

type MatchBreakdown = {
  district_score?: number;
  price_score?: number;
  area_score?: number;
  bedroom_score?: number;
  business_score?: number;
  reasons?: string[];
};

export type HomeListingItem = Listing & {
  listing?: Listing;
  listing_id?: string;
  score?: number | string | null;
  breakdown?: MatchBreakdown;
  reasons?: string[];
};

type Props = {
  item: HomeListingItem;
  href: string;
  isSearching: boolean;
};

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const asPositiveText = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";
  const number = Number(text.replace(",", "."));
  if (Number.isFinite(number) && number <= 0) return "";
  return text;
};

const hasUsefulValue = (value: string) => {
  if (!value) return false;
  const compact = value.toLowerCase().replace(/\s/g, "");
  return !/^(0|0m2|0m²|0x0|0\.0|0,0|0pn|0wc)$/.test(compact);
};

const getListing = (item: HomeListingItem): Listing => item.listing ?? item;

const getTimeAgo = (value: unknown) => {
  const text = asText(value);
  if (!text) return "";

  const time = new Date(text).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = Date.now() - time;
  const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;

  return `${Math.floor(days / 30)} tháng trước`;
};

const getBadge = (listing: Listing) => {
  if (listing.featured || listing.is_featured) return "Nổi bật";
  const frontage = getFrontageLabel(listing);
  if (/HXH|xe hơi/i.test(frontage)) return "Xe hơi";
  if (/mặt tiền/i.test(frontage)) return "Mặt tiền";
  return "Nhà mới";
};

const getScorePercent = (score: unknown) => {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
};

const getMatchLabel = (score: number) => {
  if (score >= 90) return `AI Match ${score}%`;
  if (score >= 75) return `Phù hợp ${score}%`;
  if (score >= 60) return `Có thể cân nhắc ${score}%`;
  return "";
};

const getReasonLabels = (item: HomeListingItem) => {
  const breakdown = item.breakdown;
  const rawReasons = Array.isArray(item.reasons) && item.reasons.length
    ? item.reasons
    : breakdown?.reasons || [];
  const labels: string[] = [];

  if (Number(breakdown?.district_score || 0) > 0 || rawReasons.some((reason) => /district|quận|khu vực/i.test(reason))) {
    labels.push("Đúng khu vực");
  }

  if (Number(breakdown?.price_score || 0) > 0 || rawReasons.some((reason) => /giá|price|budget/i.test(reason))) {
    labels.push("Giá gần ngân sách");
  }

  if (Number(breakdown?.area_score || 0) > 0 || rawReasons.some((reason) => /diện tích|area/i.test(reason))) {
    labels.push("Diện tích phù hợp");
  }

  if (Number(breakdown?.bedroom_score || 0) > 0 || rawReasons.some((reason) => /bedroom|phòng ngủ|pn/i.test(reason))) {
    labels.push("Phòng ngủ phù hợp");
  }

  if (Number(breakdown?.business_score || 0) > 0) {
    const businessReason = rawReasons.join(" ");
    const businessLabels = [
      /spa/i.test(businessReason) ? "Spa" : "",
      /cafe|f&b|restaurant/i.test(businessReason) ? "Cafe, F&B" : "",
      /office|văn phòng|vp/i.test(businessReason) ? "Văn phòng" : "",
      /shop|retail/i.test(businessReason) ? "Shop" : "",
    ].filter(Boolean);
    labels.push(businessLabels.length ? businessLabels.join(", ") : "Phù hợp kinh doanh");
  }

  for (const reason of rawReasons) {
    const cleaned = reason.replace(/\s+/g, " ").trim();
    if (cleaned && cleaned.length <= 42 && /[À-ỹ]/u.test(cleaned)) {
      labels.push(cleaned);
    }
  }

  return [...new Set(labels)].slice(0, 3);
};

export default function HomeHorizontalListingCard({ item, href, isSearching }: Props) {
  const listing = getListing(item);
  const publicListing = formatPublicListing(listing);
  const title = publicListing.publicTitle || asText(listing.title) || "Bất động sản";
  const imageUrl = Array.isArray(listing.images) ? asText(listing.images[0]) : "";
  const bedrooms = asPositiveText(listing.bedrooms);
  const facts = [
    hasUsefulValue(publicListing.area) ? publicListing.area : "",
    hasUsefulValue(publicListing.structure) ? publicListing.structure : "",
    bedrooms ? `${bedrooms} PN` : "",
  ].filter(Boolean);
  const views = asPositiveText(listing.views || listing.view_count || listing.viewCount);
  const timeAgo = getTimeAgo(listing.created_at || listing.updated_at);
  const score = isSearching ? getScorePercent(item.score) : null;
  const matchLabel = score ? getMatchLabel(score) : "";
  const reasons = isSearching ? getReasonLabels(item) : [];

  return (
    <article className="home-horizontal-card">
      <div className="home-horizontal-card__image">
        {imageUrl ? (
          <img src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className="home-horizontal-card__image-fallback" aria-hidden />
        )}
        {listing.status === "rented" && <RentedStamp />}
        <span className="home-horizontal-card__badge">{getBadge(listing)}</span>
        <button
          type="button"
          className="home-horizontal-card__favorite"
          aria-label="Lưu tin yêu thích"
        >
          ♡
        </button>
      </div>

      <div className="home-horizontal-card__body">
        <div className="home-horizontal-card__topline">
          <strong>{publicListing.price}</strong>
          {matchLabel && <span>{matchLabel}</span>}
        </div>
        <h3>{title}</h3>
        <div className="home-horizontal-card__meta">
          {asText(listing.district) && <span>{asText(listing.district)}</span>}
          {facts.slice(0, 3).map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
        {reasons.length > 0 && (
          <p className="home-horizontal-card__match">Phù hợp: {reasons.join(", ")}</p>
        )}
        <div className="home-horizontal-card__foot">
          {timeAgo && <span>{timeAgo}</span>}
          {views && <span>{views} lượt xem</span>}
        </div>
      </div>

      <div className="home-horizontal-card__action">
        <Link href={href}>Xem chi tiết →</Link>
      </div>
    </article>
  );
}
