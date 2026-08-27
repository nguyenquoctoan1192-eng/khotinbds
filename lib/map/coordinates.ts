import { formatPublicListing } from "@/lib/publicListingFormatter";
import { defaultHcmCenter, getDistrictCenter } from "@/lib/map/districtCenters";
import type { Listing } from "@/types/listing";
import type { MapListingMeta, PropertyMapListing } from "@/types/map";

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const asNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

// Offset (~200m) cho approximate location để tránh marker chồng lên nhau
const APPROXIMATE_OFFSET_DEGREES = 0.0018;

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return Math.abs(hash) / 0x7fffffff;
  };
}

function adjustApproximateCoordinates(
  latitude: number,
  longitude: number,
  listingId: string
): { latitude: number; longitude: number } {
  const rand = seededRandom(listingId);
  const dLat = (rand() - 0.5) * APPROXIMATE_OFFSET_DEGREES * 2;
  const dLng = (rand() - 0.5) * APPROXIMATE_OFFSET_DEGREES * 2;
  return { latitude: latitude + dLat, longitude: longitude + dLng };
}

export const isValidCoordinatePair = (latitude: unknown, longitude: unknown) => {
  const lat = asNumber(latitude);
  const lng = asNumber(longitude);
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export function getListingCoordinate(listing: Listing) {
  const lat = asNumber(listing.latitude ?? listing.lat);
  const lng = asNumber(listing.longitude ?? listing.lng);

  if (isValidCoordinatePair(lat, lng)) {
    return { latitude: lat as number, longitude: lng as number, approximateLocation: false };
  }

  const center = getDistrictCenter(listing.district ?? listing.location ?? listing.address);
  if (center) {
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      approximateLocation: true,
    };
  }

  return null;
}

export function parsePriceValue(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 1000 ? value * 1000000 : value;
  }
  const text = asText(value).toLowerCase().replace(/\./g, "").replace(/,/g, ".");
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/tỷ|ty|tỉ|ti/.test(text)) return amount * 1000000000;
  if (/tr|triệu|trieu/.test(text)) return amount * 1000000;
  return amount < 1000 ? amount * 1000000 : amount;
}

export function formatPricePill(priceValue: number | null, fallback: unknown) {
  if (!priceValue) {
    const text = asText(fallback);
    return text && !/^\d+$/.test(text) ? text : "Thỏa thuận";
  }
  const million = priceValue / 1000000;
  if (million < 1000) return `${Math.round(million)}tr`;
  const billion = priceValue / 1000000000;
  return `${Number.isInteger(billion) ? billion : billion.toFixed(1)}tỷ`;
}

export function getPriceTone(priceValue: number | null) {
  if (!priceValue) return "gray";
  const million = priceValue / 1000000;
  if (million < 20) return "green";
  if (million < 40) return "yellow";
  if (million < 80) return "orange";
  return "red";
}

export function getMatchLevel(score: number | null) {
  if (score === null) return "";
  if (score >= 90) return "Rất phù hợp";
  if (score >= 75) return "Phù hợp";
  if (score >= 60) return "Có thể cân nhắc";
  return "Không ưu tiên";
}

export function sanitizePublicStreet(value: unknown) {
  return asText(value)
    .replace(/^\s*(?:số|so|đ\/c|dc|nhà|nha)?\s*\d+[a-zA-Z]?(?:\/[a-zA-Z0-9]+)*(?:\s*[-–]\s*\d+[a-zA-Z]?)?\s*/iu, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s-]+|[,.\s-]+$/g, "")
    .trim();
}

export function getFrontageLabel(listing: Listing) {
  const text = [
    listing.frontage,
    listing.road_type,
    listing.street_type,
    listing.title,
    listing.address,
    listing.description,
  ]
    .map(asText)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

  if (/\b(hxh|hem xe hoi|xe hoi|oto|o to)\b/.test(text)) return "HXH";
  if (/\b(mt|mat tien|frontage)\b/.test(text)) return "Mặt tiền";
  if (/\b(hem|alley)\b/.test(text)) return "Hẻm";
  return asText(listing.frontage) || "Đang cập nhật";
}

const firstReasonList = (item: MapListingMeta) => {
  if (Array.isArray(item.reasons)) return item.reasons.filter((reason): reason is string => typeof reason === "string");
  if (Array.isArray(item.breakdown?.reasons)) {
    return item.breakdown.reasons.filter((reason): reason is string => typeof reason === "string");
  }
  return [];
};

export function normalizeListingForMap(item: Listing & MapListingMeta): PropertyMapListing | null {
  const listing = (item.listing as Listing | undefined) ?? item;
  const coordinate = getListingCoordinate(listing);

  if (!coordinate) return null;

  // Thêm offset ngẫu nhiên dựa trên listing ID cho approximate location
  const finalLat = coordinate.approximateLocation
    ? adjustApproximateCoordinates(coordinate.latitude, coordinate.longitude, listing.id).latitude
    : coordinate.latitude;
  const finalLng = coordinate.approximateLocation
    ? adjustApproximateCoordinates(coordinate.latitude, coordinate.longitude, listing.id).longitude
    : coordinate.longitude;

  const publicListing = formatPublicListing(listing);
  const priceValue = parsePriceValue(listing.price ?? publicListing.price);
  const rawScore = Number(item.score ?? item.breakdown?.final_score ?? item.breakdown?.total_score);
  const matchScore = Number.isFinite(rawScore) ? Math.round(rawScore) : null;
  const areaValue = asNumber(listing.area);
  const bedroomsValue = asNumber(listing.bedrooms);
  const streetLabel = sanitizePublicStreet(listing.street || listing.address || publicListing.publicTitle);

    return {
    id: listing.id,
    listing,
    item,
    publicTitle: publicListing.publicTitle || asText(listing.title) || "Bất động sản",
    imageUrl: Array.isArray(listing.images) && listing.images[0] ? listing.images[0] : "https://placehold.co/600x400",
    priceLabel: publicListing.price || formatPricePill(priceValue, listing.price),
    priceValue,
    areaLabel: publicListing.area || (listing.area ? `${listing.area}m²` : "Đang cập nhật"),
    areaValue,
    bedroomsValue,
    structureLabel: publicListing.structure || asText(listing.structure) || "Đang cập nhật",
    bedroomsLabel: listing.bedrooms ? `${listing.bedrooms} PN` : "Chưa rõ PN",
    districtLabel: asText(listing.district) || getDistrictCenter(listing.address)?.label || defaultHcmCenter.label,
    streetLabel: streetLabel || "Khu vực đang cập nhật",
    frontageLabel: getFrontageLabel(listing),
    latitude: finalLat,
    longitude: finalLng,
    approximateLocation: coordinate.approximateLocation,
    matchScore,
    matchReasons: firstReasonList(item),
    updatedAt: asText(listing.updated_at || listing.created_at) || null,
  };
}

export function isListingInsideBounds(listing: PropertyMapListing, bounds: { north: number; south: number; east: number; west: number }) {

  return (
    listing.latitude <= bounds.north &&
    listing.latitude >= bounds.south &&
    listing.longitude <= bounds.east &&
    listing.longitude >= bounds.west
  );
}