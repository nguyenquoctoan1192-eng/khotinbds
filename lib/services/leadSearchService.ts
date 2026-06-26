import "server-only";

import type { LeadRequirement, ListingMatchCandidate, MatchResult } from "@/lib/matching";
import {
  noSearchResultsMessage,
  normalizeDistrictQuery,
  normalizedDistrictNames,
  normalizeSearchText,
} from "@/lib/searchNormalization";

export const MIN_MATCH_SCORE = 40;
export const KEYWORD_MATCH_SCORE = 45;

const hardFilterDistricts = normalizedDistrictNames.map((district) => district.label);

export function normalizeKeywordText(value: unknown) {
  return normalizeSearchText(value);
}

export function normalizeDistrictText(value: unknown) {
  return normalizeDistrictQuery(value) || normalizeKeywordText(value);
}

export function normalizePreferredDistricts(value: unknown) {
  const rawDistricts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return rawDistricts
    .map((district) => String(district || "").trim())
    .filter(Boolean);
}

export function getHardFilterDistricts(value: unknown) {
  const preferred = normalizePreferredDistricts(value);
  const allowed = new Map(
    hardFilterDistricts.map((district) => [normalizeDistrictText(district), district])
  );

  return preferred.filter((district) => allowed.has(normalizeDistrictText(district)));
}

export function listingMatchesDistrict(
  listing: Record<string, unknown>,
  districts: string[]
) {
  const listingDistrict = normalizeDistrictText(listing.district);

  return districts.some(
    (district) => normalizeDistrictText(district) === listingDistrict
  );
}

export function getDistrictFilteredListings(
  listings: ListingMatchCandidate[],
  preferredDistricts: unknown
) {
  const districts = getHardFilterDistricts(preferredDistricts);

  if (districts.length === 0) {
    return {
      districts,
      listingsForScoring: listings,
      fallbackWarning: null as string | null,
    };
  }

  const filteredListings = listings.filter((listing) =>
    listingMatchesDistrict(listing, districts)
  );

  if (filteredListings.length > 0) {
    return {
      districts,
      listingsForScoring: filteredListings,
      fallbackWarning: null as string | null,
    };
  }

  return {
    districts,
    listingsForScoring: [],
    fallbackWarning: noSearchResultsMessage,
  };
}

export function isSearchableListing(listing: ListingMatchCandidate) {
  const status = normalizeKeywordText(listing.status);
  return !status || ["active", "available"].includes(status);
}

export function createSearchMatch(
  listing: ListingMatchCandidate,
  score = KEYWORD_MATCH_SCORE,
  reason = "Text search matches listing"
): MatchResult {
  return {
    listing_id: listing.id,
    score,
    breakdown: {
      district_score: 0,
      price_score: 0,
      area_score: 0,
      bedroom_score: 0,
      business_score: 0,
      data_quality_penalty: 0,
      total_score: score,
      reasons: [reason],
    },
    reasons: [reason],
    listing,
  };
}

export function getListingKeywordText(listing: Record<string, unknown>) {
  return normalizeKeywordText(
    [
      listing.title,
      listing.address,
      listing.location,
      listing.district,
      listing.description,
      listing.content,
      listing.note,
      listing.notes,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function getSearchFilteredListings(
  listings: ListingMatchCandidate[],
  preferredDistricts: unknown,
  keywordSearch: unknown
) {
  const districtResult = getDistrictFilteredListings(listings, preferredDistricts);

  if (districtResult.districts.length > 0) {
    return districtResult;
  }

  const keyword = normalizeKeywordText(keywordSearch);

  if (!keyword) {
    return districtResult;
  }

  const filteredListings = listings.filter((listing) =>
    getListingKeywordText(listing).includes(keyword)
  );

  return {
    districts: [] as string[],
    listingsForScoring: filteredListings,
    fallbackWarning: filteredListings.length === 0 ? noSearchResultsMessage : null,
  };
}

export function scoreListingKeyword(
  listing: Record<string, unknown>,
  keywordSearch: unknown
) {
  const keyword = normalizeKeywordText(keywordSearch);

  if (!keyword) return 0;

  return getListingKeywordText(listing).includes(keyword) ? KEYWORD_MATCH_SCORE : 0;
}

export function hasStructuredRequirement(requirement: LeadRequirement) {
  return Boolean(
    requirement.min_price ||
      requirement.max_price ||
      requirement.min_area ||
      requirement.bedrooms ||
      requirement.note ||
      (Array.isArray(requirement.preferred_districts) &&
        requirement.preferred_districts.length > 0) ||
      (typeof requirement.preferred_districts === "string" &&
        requirement.preferred_districts.trim())
  );
}