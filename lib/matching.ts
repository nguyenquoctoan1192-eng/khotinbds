export type ListingMatchCandidate = {
  id: string | number;
  price?: number | string | null;
  district?: string | null;
  area?: number | string | null;
  bedrooms?: number | string | null;
  status?: string | null;
  [key: string]: unknown;
};

export type LeadRequirement = {
  min_price?: number | string | null;
  max_price?: number | string | null;
  preferred_districts?: string[] | string | null;
  district?: string | null;
  min_area?: number | string | null;
  bedrooms?: number | string | null;
  note?: string | null;
  [key: string]: unknown;
};

export type ScoreBreakdown = {
  district_score: number;
  price_score: number;
  area_score: number;
  bedroom_score: number;
  total_score: number;
  reasons: string[];
};

export type MatchResult = {
  listing_id: ListingMatchCandidate["id"];
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  listing: ListingMatchCandidate;
};

type NormalizedLeadRequirement = {
  min_price: number | null;
  max_price: number | null;
  preferred_districts: string[];
  min_area: number | null;
  bedrooms: number | null;
  note?: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeDistricts(value: LeadRequirement["preferred_districts"], district?: string | null) {
  const districts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  if (district) {
    districts.push(district);
  }

  return districts
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export function normalizeLeadRequirement(requirement: LeadRequirement): NormalizedLeadRequirement {
  return {
    min_price: toNumber(requirement.min_price),
    max_price: toNumber(requirement.max_price),
    preferred_districts: normalizeDistricts(
      requirement.preferred_districts,
      requirement.district
    ),
    min_area: toNumber(requirement.min_area),
    bedrooms: toNumber(requirement.bedrooms),
    note: requirement.note,
  };
}

export function getMatchReasons(breakdown: ScoreBreakdown) {
  return breakdown.reasons;
}

export function scoreListingForLead(
  listing: ListingMatchCandidate,
  requirement: LeadRequirement
): MatchResult | null {
  const normalized = normalizeLeadRequirement(requirement);
  const listingStatus = normalizeText(listing.status);
  const listingPrice = toNumber(listing.price);
  const listingDistrict = normalizeText(listing.district);
  const listingArea = toNumber(listing.area);
  const listingBedrooms = toNumber(listing.bedrooms);

  if (listingStatus && !["active", "available"].includes(listingStatus)) {
    return null;
  }

  if (
    normalized.max_price !== null &&
    listingPrice !== null &&
    listingPrice > normalized.max_price
  ) {
    return null;
  }

  if (
    normalized.preferred_districts.length > 0 &&
    !normalized.preferred_districts.includes(listingDistrict)
  ) {
    return null;
  }

  const breakdown: ScoreBreakdown = {
    district_score: 0,
    price_score: 0,
    area_score: 0,
    bedroom_score: 0,
    total_score: 0,
    reasons: [],
  };

  if (
    normalized.preferred_districts.length > 0 &&
    normalized.preferred_districts.includes(listingDistrict)
  ) {
    breakdown.district_score = 30;
    breakdown.reasons.push("District matches preference");
  }

  if (
    listingPrice !== null &&
    (
      (normalized.min_price === null && normalized.max_price === null) ||
      (
        (normalized.min_price === null || listingPrice >= normalized.min_price) &&
        (normalized.max_price === null || listingPrice <= normalized.max_price)
      )
    )
  ) {
    breakdown.price_score = 30;
    breakdown.reasons.push("Price matches budget");
  }

  if (
    normalized.min_area !== null &&
    listingArea !== null &&
    listingArea >= normalized.min_area
  ) {
    breakdown.area_score = 20;
    breakdown.reasons.push("Area meets minimum");
  }

  if (
    normalized.bedrooms !== null &&
    listingBedrooms !== null &&
    listingBedrooms >= normalized.bedrooms
  ) {
    breakdown.bedroom_score = 20;
    breakdown.reasons.push("Bedrooms meet requirement");
  }

  breakdown.total_score =
    breakdown.district_score +
    breakdown.price_score +
    breakdown.area_score +
    breakdown.bedroom_score;

  if (breakdown.total_score <= 0) {
    return null;
  }

  return {
    listing_id: listing.id,
    score: breakdown.total_score,
    breakdown,
    reasons: getMatchReasons(breakdown),
    listing,
  };
}
