import { normalizeDistrictKey } from "@/lib/map/districtCenters";
import { getFrontageLabel } from "@/lib/map/coordinates";
import type { MapFilterState, MapFrontageType, MapPriceRange, PropertyMapListing } from "@/types/map";

export const defaultMapFilters: MapFilterState = {
  district: "",
  priceRange: "",
  minArea: "",
  bedrooms: "",
  frontageTypes: [],
  newestOnly: false,
  business: "",
  minMatchScore: "",
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const parseFrontageTypes = (value: string | null): MapFrontageType[] =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is MapFrontageType =>
      item === "frontage" || item === "car_alley" || item === "alley"
    );

const isPriceRange = (value: string | null): value is MapPriceRange =>
  value === "" ||
  value === "under20" ||
  value === "20to40" ||
  value === "40to80" ||
  value === "over80" ||
  value === "negotiable";

export function parseMapFilters(params: URLSearchParams): MapFilterState {
  const price = params.get("price");

  return {
    district: params.get("district") || "",
    priceRange: isPriceRange(price) ? price : "",
    minArea: params.get("minArea") || "",
    bedrooms: params.get("bedrooms") || "",
    frontageTypes: parseFrontageTypes(params.get("frontage")),
    newestOnly: params.get("newest") === "1",
    business: params.get("business") || "",
    minMatchScore: params.get("match") || "",
  };
}

export function writeMapFiltersToParams(params: URLSearchParams, filters: MapFilterState) {
  const entries: Array<[keyof MapFilterState, string]> = [
    ["district", filters.district.trim()],
    ["priceRange", filters.priceRange],
    ["minArea", filters.minArea.trim()],
    ["bedrooms", filters.bedrooms.trim()],
    ["business", filters.business.trim()],
    ["minMatchScore", filters.minMatchScore.trim()],
  ];

  const keyMap: Record<string, string> = {
    priceRange: "price",
    minMatchScore: "match",
  };

  for (const [key, value] of entries) {
    const paramKey = keyMap[key] || key;
    if (value) params.set(paramKey, value);
    else params.delete(paramKey);
  }

  if (filters.frontageTypes.length > 0) params.set("frontage", filters.frontageTypes.join(","));
  else params.delete("frontage");

  if (filters.newestOnly) params.set("newest", "1");
  else params.delete("newest");
}

function matchesPriceRange(listing: PropertyMapListing, range: MapPriceRange) {
  if (!range) return true;
  if (range === "negotiable") return !listing.priceValue;
  if (!listing.priceValue) return false;

  const million = listing.priceValue / 1000000;
  if (range === "under20") return million < 20;
  if (range === "20to40") return million >= 20 && million < 40;
  if (range === "40to80") return million >= 40 && million < 80;
  return million >= 80;
}

function matchesFrontage(listing: PropertyMapListing, frontageTypes: MapFrontageType[]) {
  if (frontageTypes.length === 0) return true;
  const label = normalizeText(getFrontageLabel(listing.listing));

  return frontageTypes.some((type) => {
    if (type === "frontage") return /mat tien|mt|frontage/.test(label);
    if (type === "car_alley") return /hxh|hem xe hoi|oto|o to|xe hoi/.test(label);
    return /hem|alley/.test(label) && !/xe hoi|oto|o to/.test(label);
  });
}

export function filterMapListings(listings: PropertyMapListing[], filters: MapFilterState) {
  const district = normalizeDistrictKey(filters.district);
  const minArea = Number(filters.minArea);
  const bedrooms = Number(filters.bedrooms);
  const minMatchScore = Number(filters.minMatchScore);
  const business = normalizeText(filters.business);
  const newestCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return listings.filter((listing) => {
    if (district && !normalizeDistrictKey(listing.districtLabel).includes(district)) return false;
    if (!matchesPriceRange(listing, filters.priceRange)) return false;
    if (Number.isFinite(minArea) && minArea > 0 && (listing.areaValue || 0) < minArea) return false;
    if (Number.isFinite(bedrooms) && bedrooms > 0 && (listing.bedroomsValue || 0) < bedrooms) return false;
    if (!matchesFrontage(listing, filters.frontageTypes)) return false;
    if (Number.isFinite(minMatchScore) && minMatchScore > 0 && (listing.matchScore ?? 0) < minMatchScore) return false;
    if (business) {
      const haystack = normalizeText([
        listing.publicTitle,
        listing.listing.title,
        listing.listing.description,
        listing.listing.content,
        listing.listing.note,
        listing.listing.notes,
      ].join(" "));
      if (!haystack.includes(business)) return false;
    }
    if (filters.newestOnly) {
      const time = listing.updatedAt ? new Date(listing.updatedAt).getTime() : 0;
      if (!Number.isFinite(time) || time < newestCutoff) return false;
    }

    return true;
  });
}
