import { normalizeDistrictQuery } from "@/lib/searchNormalization";

export type ListingMatchCandidate = {
  id: string | number;
  price?: number | string | null;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
  location?: string | null;
  area?: number | string | null;
  bedrooms?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  address?: string | null;
  note?: string | null;
  notes?: string | null;
  amenities?: unknown;
  furniture?: string | null;
  frontage?: string | null;
  features?: unknown;
  [key: string]: unknown;
};

export type LeadRequirement = {
  rawText?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  preferred_districts?: string[] | string | null;
  preferredDistricts?: string[] | string | null;
  preferred_wards?: string[] | string | null;
  preferredWards?: string[] | string | null;
  preferred_streets?: string[] | string | null;
  preferredStreets?: string[] | string | null;
  district?: string | null;
  min_area?: number | string | null;
  max_area?: number | string | null;
  minArea?: number | string | null;
  maxArea?: number | string | null;
  bedrooms?: number | string | null;
  note?: string | null;
  businessTypes?: string[] | string | null;
  concepts?: string[] | string | null;
  features?: string[] | string | null;
  targetCustomers?: string[] | string | null;
  purpose?: string | null;
  [key: string]: unknown;
};

export type ScoreBreakdown = {
  district_score: number;
  ward_score?: number;
  street_score?: number;
  price_score: number;
  area_score: number;
  bedroom_score: number;
  business_score: number;
  feature_score?: number;
  customer_score?: number;
  contract_score?: number;
  data_quality_penalty: number;
  total_score: number;
  reasons: string[];
};

export type MatchResult = {
  listing_id: ListingMatchCandidate["id"];
  score: number;
  reasons: string[];
  warnings?: string[];
  breakdown: ScoreBreakdown;
  listing: ListingMatchCandidate;
};

type NormalizedLeadRequirement = {
  min_price: number | null;
  max_price: number | null;
  preferred_districts: string[];
  preferred_wards: string[];
  preferred_streets: string[];
  min_area: number | null;
  max_area: number | null;
  bedrooms: number | null;
  note?: string | null;
  businessTypes: string[];
  concepts: string[];
  features: string[];
  targetCustomers: string[];
  purpose?: string | null;
  rawText?: string | null;
};

type BusinessNeed =
  | "bbq"
  | "seafood"
  | "wine bar"
  | "restaurant"
  | "cafe"
  | "spa"
  | "office";

const businessKeywords: Record<BusinessNeed, RegExp[]> = {
  bbq: [/\bbbq\b/, /\bnuong\b/, /\bkorean bbq\b/, /\bhan quoc\b/],
  seafood: [/\bseafood\b/, /\bhai san\b/],
  "wine bar": [/\bwine bar\b/, /\bbar ruou\b/, /\bruou vang\b/],
  restaurant: [/\brestaurant\b/, /\bnha hang\b/, /\bquan an\b/, /\ban uong\b/, /\bf&b\b/, /\bfnb\b/, /\bbep\b/],
  cafe: [/\bcafe\b/, /\bca phe\b/, /\bcoffee\b/, /\bcf\b/],
  spa: [/\bspa\b/, /\btham my\b/, /\bsalon\b/, /\bnail\b/, /\bmassage\b/],
  office: [/\bvan phong\b/, /\bvp\b/, /\bsan vp\b/, /\boffice\b/, /\bcong ty\b/],
};

const featureKeywords: Record<string, RegExp[]> = {
  "mat tien": [/\bmt\b/, /\bmat tien\b/, /\b2 mat tien\b/, /\bfrontage\b/, /\bduong lon\b/],
  "dong nguoi qua lai": [/\bdong nguoi qua lai\b/, /\bdong khach\b/, /\bluu luong\b/, /\bfoot traffic\b/, /\btap nap\b/],
  "cho de xe": [/\bcho de xe\b/, /\bdau xe\b/, /\bde oto\b/, /\bgarage\b/, /\bparking\b/, /\bham xe\b/],
  "hop dong dai han": [/\bhop dong dai han\b/, /\bdai han\b/, /\blong term\b/, /\bky lau dai\b/],
};

const targetCustomerKeywords: Record<string, RegExp[]> = {
  "khach han": [/\bkhach han\b/, /\bhan quoc\b/, /\bkorean\b/, /\bk-town\b/],
  "nguoi nuoc ngoai": [/\bnguoi nuoc ngoai\b/, /\bkhach tay\b/, /\bexpat\b/, /\bforeigner\b/, /\bforeigners\b/],
  "dan van phong": [/\bdan van phong\b/, /\bnhan vien van phong\b/, /\boffice worker\b/, /\boffice\b/, /\btoa nha vp\b/],
};

const namedDistricts: Array<[RegExp, string]> = [
  [/\bphu nhuan\b/, "quan phu nhuan"],
  [/\bbinh thanh\b/, "quan binh thanh"],
  [/\bgo vap\b/, "quan go vap"],
  [/\btan binh\b/, "quan tan binh"],
  [/\btan phu\b/, "quan tan phu"],
  [/\bthu duc\b/, "quan thu duc"],
  [/\bbinh tan\b/, "quan binh tan"],
];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/Ä‘/g, "d")
    .replace(/Ã„â€˜/g, "d")
    .replace(/[^a-z0-9&\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrictName(value: unknown): string {
  const direct = normalizeDistrictQuery(value);

  if (direct) return direct;

  const normalized = normalizeText(value);
  const numberedMatch = normalized.match(/\b(?:quan|q)\s*\.?\s*(1[0-2]|[1-9])\b/);

  if (numberedMatch) {
    return `quan ${Number(numberedMatch[1])}`;
  }

  const compactNumberedMatch = normalized.replace(/\s+/g, "").match(/\b(?:quan|q)(1[0-2]|[1-9])\b/);

  if (compactNumberedMatch) {
    return `quan ${Number(compactNumberedMatch[1])}`;
  }

  for (const [pattern, district] of namedDistricts) {
    if (pattern.test(normalized)) return district;
  }

  return normalized.replace(/^quan\s+/, "quan ").trim();
}

function normalizeList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return values
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeDistricts(
  preferredDistricts: LeadRequirement["preferred_districts"],
  district?: string | null,
  camelDistricts?: LeadRequirement["preferredDistricts"]
) {
  const districts = [
    ...normalizeList(preferredDistricts),
    ...normalizeList(camelDistricts),
  ];

  if (district) {
    districts.push(district);
  }

  return Array.from(
    new Set(districts.map((item) => normalizeDistrictName(item)).filter(Boolean))
  );
}

function normalizeFeatureLabel(value: string) {
  const normalized = normalizeText(value);

  if (/mat tien|frontage|\bmt\b/.test(normalized)) return "mat tien";
  if (/dong nguoi|dong khach|foot traffic|luu luong/.test(normalized)) return "dong nguoi qua lai";
  if (/cho de xe|dau xe|parking|garage|ham xe/.test(normalized)) return "cho de xe";
  if (/hop dong dai han|dai han|long term/.test(normalized)) return "hop dong dai han";

  return normalized;
}

function normalizeCustomerLabel(value: string) {
  const normalized = normalizeText(value);

  if (/khach han|han quoc|korean/.test(normalized)) return "khach han";
  if (/nguoi nuoc ngoai|khach tay|expat|foreigner/.test(normalized)) return "nguoi nuoc ngoai";
  if (/dan van phong|nhan vien van phong|office/.test(normalized)) return "dan van phong";

  return normalized;
}

function detectBusinessNeeds(requirement: NormalizedLeadRequirement): BusinessNeed[] {
  const source = [
    requirement.note,
    requirement.rawText,
    requirement.purpose,
    ...requirement.businessTypes,
    ...requirement.concepts,
  ].join(" ");
  const normalized = normalizeText(source);
  const needs: BusinessNeed[] = [];

  for (const [need, patterns] of Object.entries(businessKeywords) as Array<[BusinessNeed, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      needs.push(need);
    }
  }

  return Array.from(new Set(needs));
}

function listingSearchText(listing: ListingMatchCandidate) {
  const fields = [
    listing.title,
    listing.description,
    listing.content,
    listing.address,
    listing.location,
    listing.district,
    listing.ward,
    listing.street,
    listing.note,
    listing.notes,
    listing.frontage,
    Array.isArray(listing.amenities) ? listing.amenities.join(" ") : listing.amenities,
    Array.isArray(listing.features) ? listing.features.join(" ") : listing.features,
    listing.furniture,
  ];

  return normalizeText(fields.filter(Boolean).join(" "));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function districtIsMentioned(text: string, district: string) {
  if (!district) return false;

  const normalizedDistrict = normalizeDistrictName(district);
  const withoutPrefix = normalizedDistrict.replace(/^quan\s+/, "");

  if (/^\d+$/.test(withoutPrefix)) {
    return new RegExp(`\\b(?:quan|q)\\s*\\.?\\s*${withoutPrefix}\\b`).test(text);
  }

  return text.includes(withoutPrefix);
}

function scoreRange(
  value: number | null,
  minValue: number | null,
  maxValue: number | null,
  points: number,
  label: string,
  reasons: string[],
  warnings: string[]
) {
  if (minValue === null && maxValue === null) return 0;

  if (value === null || value <= 0) {
    warnings.push(`Missing ${label} data`);
    return 0;
  }

  if (minValue !== null && maxValue !== null) {
    if (value >= minValue && value <= maxValue) {
      reasons.push(`${label} trong khoang yeu cau`);
      return points;
    }

    const reference = value < minValue ? minValue : maxValue;
    const variance = Math.abs(value - reference) / reference;

    if (variance <= 0.15) {
      warnings.push(`${label} lech nhe so voi khoang yeu cau`);
      return Math.round(points * 0.6);
    }

    warnings.push(`${label} lech nhieu so voi khoang yeu cau`);
    return Math.round(points * 0.2);
  }

  if (maxValue !== null) {
    if (value <= maxValue) {
      reasons.push(`${label} trong ngan sach/nguong toi da`);
      return value >= maxValue * 0.75 ? points : Math.round(points * 0.75);
    }

    const variance = (value - maxValue) / maxValue;

    if (variance <= 0.15) {
      warnings.push(`${label} vuot nhe nguong toi da`);
      return Math.round(points * 0.5);
    }

    warnings.push(`${label} vuot nhieu nguong toi da`);
    return 0;
  }

  if (minValue !== null) {
    if (value >= minValue) {
      reasons.push(`${label} dat nguong toi thieu`);
      return points;
    }

    const variance = (minValue - value) / minValue;

    if (variance <= 0.15) {
      warnings.push(`${label} thap hon nhe nguong toi thieu`);
      return Math.round(points * 0.5);
    }

    warnings.push(`${label} thap hon nhieu nguong toi thieu`);
    return Math.round(points * 0.15);
  }

  return 0;
}

function scoreBusinessSuitability(
  listing: ListingMatchCandidate,
  requirement: NormalizedLeadRequirement,
  warnings: string[]
) {
  const needs = detectBusinessNeeds(requirement);

  if (needs.length === 0) {
    return {
      score: 0,
      reasons: [] as string[],
    };
  }

  const text = listingSearchText(listing);
  const customerFacingSignals = hasAny(text, [
    /\bmt\b/,
    /\bmat tien\b/,
    /\bmat bang\b/,
    /\btret\b/,
    /\btang tret\b/,
    /\bkinh doanh\b/,
    /\bf&b\b/,
    /\bfnb\b/,
  ]);
  let score = 0;
  const reasons: string[] = [];

  for (const need of needs) {
    if (hasAny(text, businessKeywords[need])) {
      score += 8;
      reasons.push(`${need} business matches listing text`);
      continue;
    }

    if (need === "restaurant" || need === "bbq" || need === "seafood" || need === "wine bar") {
      if (customerFacingSignals) {
        score += 5;
        reasons.push("Customer-facing MT/MB signals support restaurant business");
        continue;
      }
    }

    if (need === "office" && hasAny(text, [/\bvan phong\b/, /\bvp\b/, /\bsan\b/, /\boffice\b/])) {
      score += 7;
      reasons.push("Office business signal matches");
      continue;
    }

    warnings.push(`Listing chua neu ro phu hop ${need}`);
  }

  return {
    score: Math.min(score, 18),
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
    min_price: toNumber(requirement.min_price ?? requirement.minPrice),
    max_price: toNumber(requirement.max_price ?? requirement.maxPrice),
    preferred_districts: normalizeDistricts(
      requirement.preferred_districts,
      requirement.district,
      requirement.preferredDistricts
    ),
    preferred_wards: normalizeList(requirement.preferred_wards ?? requirement.preferredWards).map(normalizeText),
    preferred_streets: normalizeList(requirement.preferred_streets ?? requirement.preferredStreets).map(normalizeText),
    min_area: toNumber(requirement.min_area ?? requirement.minArea),
    max_area: toNumber(requirement.max_area ?? requirement.maxArea),
    bedrooms: toNumber(requirement.bedrooms),
    note: requirement.note,
    businessTypes: normalizeList(requirement.businessTypes).map(normalizeText),
    concepts: normalizeList(requirement.concepts).map(normalizeText),
    features: normalizeList(requirement.features).map(normalizeFeatureLabel),
    targetCustomers: normalizeList(requirement.targetCustomers).map(normalizeCustomerLabel),
    purpose: requirement.purpose,
    rawText: requirement.rawText,
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
    (b.breakdown.street_score || 0) - (a.breakdown.street_score || 0) ||
    (b.breakdown.ward_score || 0) - (a.breakdown.ward_score || 0) ||
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
  const text = listingSearchText(listing);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (listingStatus && !["active", "available"].includes(listingStatus)) {
    return null;
  }

  const matchesRequestedDistrict =
    normalized.preferred_districts.length === 0 ||
    normalized.preferred_districts.some(
      (district) =>
        district === listingDistrict ||
        districtIsMentioned(text, district)
    );

  if (!matchesRequestedDistrict) {
    return null;
  }

  const breakdown: ScoreBreakdown = {
    district_score: 0,
    ward_score: 0,
    street_score: 0,
    price_score: 0,
    area_score: 0,
    bedroom_score: 0,
    business_score: 0,
    feature_score: 0,
    customer_score: 0,
    contract_score: 0,
    data_quality_penalty: 0,
    total_score: 0,
    reasons,
  };

  if (normalized.preferred_districts.length > 0) {
    breakdown.district_score = 22;
    reasons.push("District matches preference");
  }

  if (normalized.preferred_wards.length > 0) {
    const wardMatched = normalized.preferred_wards.some((ward) => text.includes(ward));

    if (wardMatched) {
      breakdown.ward_score = 12;
      reasons.push("Ward matches preference");
    } else {
      warnings.push("Listing dung quan nhung chua thay dung phuong uu tien");
    }
  }

  if (normalized.preferred_streets.length > 0) {
    const streetMatched = normalized.preferred_streets.some((street) => text.includes(street));

    if (streetMatched) {
      breakdown.street_score = 14;
      reasons.push("Street matches preference");
    } else {
      warnings.push("Listing dung quan nhung chua thay dung duong uu tien");
    }
  }

  breakdown.price_score = scoreRange(
    listingPrice,
    normalized.min_price,
    normalized.max_price,
    20,
    "Gia",
    reasons,
    warnings
  );

  breakdown.area_score = scoreRange(
    listingArea,
    normalized.min_area,
    normalized.max_area,
    16,
    "Area",
    reasons,
    warnings
  );

  if (normalized.bedrooms !== null) {
    if (listingBedrooms !== null && listingBedrooms >= normalized.bedrooms) {
      breakdown.bedroom_score = 8;
      reasons.push("Bedrooms meet requirement");
    } else {
      warnings.push("So phong ngu chua dat yeu cau");
    }
  }

  const businessSuitability = scoreBusinessSuitability(listing, normalized, warnings);
  breakdown.business_score = businessSuitability.score;
  reasons.push(...businessSuitability.reasons);

  const requestedFeatures = normalized.features.filter(
    (feature) => feature !== "hop dong dai han"
  );

  for (const feature of requestedFeatures) {
    const patterns = featureKeywords[feature] || [new RegExp(`\\b${feature}\\b`)];

    if (hasAny(text, patterns)) {
      breakdown.feature_score = (breakdown.feature_score || 0) + 4;
      reasons.push(`${feature} feature matches`);
    } else {
      warnings.push(`Listing chua neu ro ${feature}`);
    }
  }

  breakdown.feature_score = Math.min(breakdown.feature_score || 0, 12);

  if (normalized.features.includes("hop dong dai han")) {
    if (hasAny(text, featureKeywords["hop dong dai han"])) {
      breakdown.contract_score = 6;
      reasons.push("Long-term contract signal matches");
    } else {
      warnings.push("Listing chua neu ro hop dong dai han");
    }
  }

  for (const customer of normalized.targetCustomers) {
    const patterns = targetCustomerKeywords[customer] || [new RegExp(`\\b${customer}\\b`)];

    if (hasAny(text, patterns)) {
      breakdown.customer_score = (breakdown.customer_score || 0) + 4;
      reasons.push(`${customer} customer area matches`);
    } else {
      warnings.push(`Listing chua neu ro tap khach ${customer}`);
    }
  }

  breakdown.customer_score = Math.min(breakdown.customer_score || 0, 10);

  if (listingArea === null || listingArea <= 0) {
    breakdown.data_quality_penalty -= 6;
    warnings.push("Missing area data");
  } else if (listingArea > 1000) {
    breakdown.data_quality_penalty -= 4;
    warnings.push("Area data should be checked");
  }

  if (listingPrice === null || listingPrice <= 0) {
    breakdown.data_quality_penalty -= 8;
    warnings.push("Missing price data");
  }

  const rawTotal =
    breakdown.district_score +
    (breakdown.ward_score || 0) +
    (breakdown.street_score || 0) +
    breakdown.price_score +
    breakdown.area_score +
    breakdown.bedroom_score +
    breakdown.business_score +
    (breakdown.feature_score || 0) +
    (breakdown.customer_score || 0) +
    (breakdown.contract_score || 0) +
    breakdown.data_quality_penalty;

  breakdown.total_score = Math.max(0, Math.min(100, Math.round(rawTotal)));

  if (breakdown.total_score <= 0) {
    return null;
  }

  return {
    listing_id: listing.id,
    score: breakdown.total_score,
    breakdown,
    reasons: getMatchReasons(breakdown),
    warnings,
    listing,
  };
}
