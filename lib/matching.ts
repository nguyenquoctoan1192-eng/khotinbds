export type ListingMatchCandidate = {
  id: string | number;
  price?: number | string | null;
  district?: string | null;
  area?: number | string | null;
  bedrooms?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  note?: string | null;
  amenities?: unknown;
  furniture?: string | null;
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
  data_quality_penalty: number;
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

type BusinessNeed = "cafe" | "spa" | "office" | "restaurant";

const businessKeywords: Record<BusinessNeed, RegExp[]> = {
  cafe: [/\bcafe\b/, /\bca phe\b/, /\bcoffee\b/, /\bcf\b/],
  spa: [/\bspa\b/, /\btham my\b/, /\bsalon\b/, /\bnail\b/, /\bmassage\b/],
  office: [/\bvan phong\b/, /\bvp\b/, /\bsan vp\b/, /\boffice\b/, /\bcong ty\b/],
  restaurant: [/\bquan an\b/, /\bnha hang\b/, /\ban uong\b/, /\bbep\b/, /\bf&b\b/, /\bfnb\b/],
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
    .replace(/Ä‘/g, "d")
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

function detectBusinessNeeds(value: unknown): BusinessNeed[] {
  const normalized = normalizeText(value);
  const needs: BusinessNeed[] = [];

  for (const [need, patterns] of Object.entries(businessKeywords) as Array<[BusinessNeed, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      needs.push(need);
    }
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
    Array.isArray(listing.amenities) ? listing.amenities.join(" ") : listing.amenities,
    listing.furniture,
  ];

  return normalizeText(fields.filter(Boolean).join(" "));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
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
  const businessSignals = {
    frontage: hasAny(text, [/\bmt\b/, /\bmat tien\b/, /\b2 mat tien\b/]),
    premise: hasAny(text, [/\bmb\b/, /\bmat bang\b/]),
    groundFloor: hasAny(text, [/\btret\b/, /\btang tret\b/]),
    largeSpace: hasAny(text, [/\brong\b/, /\bngang\b/]),
    officeFloor: hasAny(text, [/\bsan\b/, /\bsan vp\b/, /\bvp\b/]),
  };

  let score = 0;
  const reasons: string[] = [];

  for (const need of needs) {
    if (hasAny(text, businessKeywords[need])) {
      score += 20;
      reasons.push(`Listing text directly matches ${need} need`);
      continue;
    }

    if (need === "office") {
      if (businessSignals.officeFloor) {
        score += 18;
        reasons.push("Sàn/VP signal supports office use");
      } else if (businessSignals.premise || businessSignals.frontage) {
        score += 10;
        reasons.push("Premise/frontage signal may support office use");
      }
      continue;
    }

    if (businessSignals.frontage || businessSignals.premise) {
      score += 12;
      reasons.push("MT/MB signal supports customer-facing business use");
    }

    if (businessSignals.groundFloor || businessSignals.largeSpace) {
      score += 8;
      reasons.push("Ground-floor/large-space signal supports business use");
    }
  }

  if (score <= 0) {
    return {
      score: 0,
      reasons: ["Business need noted, but listing has no clear business-use signal"],
    };
  }

  return {
    score: Math.min(score, 25),
    reasons,
  };
}

function getUpdatedAtTime(match: MatchResult) {
  const value = match.listing.updated_at || match.listing.created_at;

  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
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

export function compareMatchResults(a: MatchResult, b: MatchResult) {
  const rawAreaA = toNumber(a.listing.area) || 0;
  const rawAreaB = toNumber(b.listing.area) || 0;
  const areaA = rawAreaA > 0 && rawAreaA <= 1000 ? rawAreaA : 0;
  const areaB = rawAreaB > 0 && rawAreaB <= 1000 ? rawAreaB : 0;

  return (
    b.score - a.score ||
    b.breakdown.business_score - a.breakdown.business_score ||
    Number(areaB > 0) - Number(areaA > 0) ||
    areaB - areaA ||
    getUpdatedAtTime(b) - getUpdatedAtTime(a)
  );
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
    (listingPrice === null || listingPrice <= 0)
  ) {
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
    (listingArea === null || listingArea <= 0)
  ) {
    return null;
  }

  if (
    normalized.min_area !== null &&
    listingArea !== null &&
    listingArea < normalized.min_area
  ) {
    return null;
  }

  const breakdown: ScoreBreakdown = {
    district_score: 0,
    price_score: 0,
    area_score: 0,
    bedroom_score: 0,
    business_score: 0,
    data_quality_penalty: 0,
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
    normalized.min_price === null &&
    normalized.max_price === null
  ) {
    breakdown.price_score = 30;
    breakdown.reasons.push("Price matches budget");
  } else if (listingPrice !== null && normalized.max_price !== null) {
    const priceRatio = listingPrice / normalized.max_price;

    if (priceRatio >= 0.9) {
      breakdown.price_score = 30;
      breakdown.reasons.push("Gi\u00e1 g\u1ea7n ng\u00e2n s\u00e1ch");
    } else if (priceRatio >= 0.75) {
      breakdown.price_score = 24;
      breakdown.reasons.push("Gi\u00e1 th\u1ea5p h\u01a1n ng\u00e2n s\u00e1ch");
    } else if (priceRatio >= 0.5) {
      breakdown.price_score = 16;
      breakdown.reasons.push("Gi\u00e1 th\u1ea5p h\u01a1n ng\u00e2n s\u00e1ch");
    } else {
      breakdown.price_score = 8;
      breakdown.reasons.push("Gi\u00e1 th\u1ea5p h\u01a1n nhi\u1ec1u so v\u1edbi ng\u00e2n s\u00e1ch");
    }
  } else if (
    listingPrice !== null &&
    normalized.min_price !== null &&
    listingPrice >= normalized.min_price
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

  if (listingArea === null || listingArea <= 0) {
    breakdown.data_quality_penalty = -8;
    breakdown.reasons.push("Thiếu dữ liệu diện tích");
  } else if (listingArea > 1000) {
    breakdown.data_quality_penalty = -5;
    breakdown.reasons.push("Diện tích cần kiểm tra lại");
  }

  if (listingPrice === null || listingPrice <= 0) {
    breakdown.data_quality_penalty -= 10;
    breakdown.reasons.push("Thiếu dữ liệu giá");
  }

  breakdown.total_score =
    breakdown.district_score +
    breakdown.price_score +
    breakdown.area_score +
    breakdown.bedroom_score +
    breakdown.business_score +
    breakdown.data_quality_penalty;

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
