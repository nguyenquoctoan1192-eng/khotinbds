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
  business_score: number;
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
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrictName(value: unknown): string {
  const normalized = normalizeText(value);
  const withoutPrefix = normalized.replace(/^quan\s+/, "").trim();

  if (/^\d+$/.test(withoutPrefix)) {
    return `quan ${withoutPrefix}`;
  }

  return withoutPrefix;
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
    .map((item) => normalizeDistrictName(item))
    .filter(Boolean);
}

function detectBusinessNeeds(value: unknown): string[] {
  const normalized = normalizeText(value);
  const needs: string[] = [];

  if (normalized.includes("spa")) needs.push("spa");
  if (normalized.includes("cafe") || normalized.includes("ca phe")) needs.push("cafe");
  if (normalized.includes("van phong") || normalized.includes("office")) needs.push("office");
  if (normalized.includes("quan an") || normalized.includes("nha hang") || normalized.includes("restaurant")) {
    needs.push("restaurant");
  }

  return needs;
}

function listingSearchText(listing: ListingMatchCandidate) {
  const fields = [
    listing.title,
    listing.description,
    listing.address,
    listing.district,
    listing.note,
    listing.amenities,
    listing.furniture,
  ];

  return normalizeText(fields.filter(Boolean).join(" "));
}

function scoreBusinessSuitability(
  listing: ListingMatchCandidate,
  requirement: NormalizedLeadRequirement
) {
  const needs = detectBusinessNeeds(requirement.note);

  if (needs.length === 0) {
    return {
      score: 0,
      reasons: [] as string[],
    };
  }

  const text = listingSearchText(listing);
  const matchedNeeds = needs.filter((need) => {
    if (need === "restaurant") {
      return text.includes("quan an") || text.includes("nha hang") || text.includes("restaurant");
    }

    if (need === "office") {
      return text.includes("van phong") || text.includes("office");
    }

    if (need === "cafe") {
      return text.includes("cafe") || text.includes("ca phe");
    }

    return text.includes(need);
  });

  if (matchedNeeds.length === 0) {
    return {
      score: 0,
      reasons: ["Business need noted, but listing has no clear business-use signal"],
    };
  }

  return {
    score: 20,
    reasons: matchedNeeds.map((need) => `Listing appears suitable for ${need}`),
  };
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
  const listingDistrict = normalizeDistrictName(listing.district);
  const listingArea = toNumber(listing.area);
  const listingBedrooms = toNumber(listing.bedrooms);

  if (listingStatus && !["active", "available"].includes(listingStatus)) {
    return null;
  }

  if (
    normalized.max_price !== null &&
    (listingPrice === null || listingPrice > normalized.max_price)
  ) {
    return null;
  }

  if (
    normalized.min_price !== null &&
    (listingPrice === null || listingPrice < normalized.min_price)
  ) {
    return null;
  }

  if (
    normalized.preferred_districts.length > 0 &&
    !normalized.preferred_districts.includes(listingDistrict)
  ) {
    return null;
  }

  if (
    normalized.min_area !== null &&
    (listingArea === null || listingArea < normalized.min_area)
  ) {
    return null;
  }

  const breakdown: ScoreBreakdown = {
    district_score: 0,
    price_score: 0,
    area_score: 0,
    bedroom_score: 0,
    business_score: 0,
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

  const businessSuitability = scoreBusinessSuitability(listing, normalized);
  breakdown.business_score = businessSuitability.score;
  breakdown.reasons.push(...businessSuitability.reasons);

  breakdown.total_score =
    breakdown.district_score +
    breakdown.price_score +
    breakdown.area_score +
    breakdown.bedroom_score +
    breakdown.business_score;

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
