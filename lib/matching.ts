import { normalizeDistrictQuery } from "@/lib/searchNormalization";
import { districtIsNearby } from "@/lib/nearbyDistricts";

export type ListingMatchCandidate = {
  id: string | number;
  price?: number | string | null;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
  location?: string | null;
  area?: number | string | null;
  width?: number | string | null;
  length?: number | string | null;
  floors?: number | string | null;
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
  target_price?: number | string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  targetPrice?: number | string | null;
  priceMode?: "target" | "max" | "range" | string | null;
  price_mode?: "target" | "max" | "range" | string | null;
  preferred_districts?: string[] | string | null;
  preferredDistricts?: string[] | string | null;
  allow_nearby_districts?: boolean | string | null;
  allowNearbyDistricts?: boolean | string | null;
  preferred_wards?: string[] | string | null;
  preferredWards?: string[] | string | null;
  preferred_streets?: string[] | string | null;
  preferredStreets?: string[] | string | null;
  district?: string | null;
  min_area?: number | string | null;
  max_area?: number | string | null;
  target_area?: number | string | null;
  target_width?: number | string | null;
  minArea?: number | string | null;
  maxArea?: number | string | null;
  targetArea?: number | string | null;
  targetWidth?: number | string | null;
  target_floors?: number | string | null;
  min_floors?: number | string | null;
  targetFloors?: number | string | null;
  minFloors?: number | string | null;
  has_rooftop?: boolean | string | null;
  has_mezzanine?: boolean | string | null;
  hasRooftop?: boolean | string | null;
  hasMezzanine?: boolean | string | null;
  bedrooms?: number | string | null;
  min_bedrooms?: number | string | null;
  max_bedrooms?: number | string | null;
  minBedrooms?: number | string | null;
  maxBedrooms?: number | string | null;
  property_types?: string[] | string | null;
  propertyTypes?: string[] | string | null;
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
  width_score?: number;
  structure_score?: number;
  bedroom_score: number;
  property_type_score?: number;
  freshness_score?: number;
  matching_score?: number;
  final_score?: number;
  business_score: number;
  feature_score?: number;
  customer_score?: number;
  contract_score?: number;
  data_quality_penalty: number;
  priceDistance?: number | null;
  areaDistance?: number | null;
  widthDistance?: number | null;
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
  target_price: number | null;
  price_mode: "target" | "max" | "range" | null;
  preferred_districts: string[];
  allow_nearby_districts: boolean;
  preferred_wards: string[];
  preferred_streets: string[];
  min_area: number | null;
  max_area: number | null;
  target_area: number | null;
  target_width: number | null;
  target_floors: number | null;
  min_floors: number | null;
  has_rooftop: boolean;
  has_mezzanine: boolean;
  bedrooms: number | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  propertyTypes: string[];
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

function normalizeStreetList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,/|\n]+/g)
      : [];

  return values
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return /^(true|1|yes|co|có)$/i.test(value.trim());
  }

  return false;
}

function normalizePriceMode(value: unknown): NormalizedLeadRequirement["price_mode"] {
  if (value === "target" || value === "max" || value === "range") return value;
  return null;
}

function normalizePropertyType(value: string) {
  const normalized = normalizeText(value);

  if (/nguyen can|nha nguyen can/.test(normalized)) return "nguyen can";
  if (/mat bang|\bmb\b/.test(normalized)) return "mat bang";
  if (/can ho|chung cu|apartment/.test(normalized)) return "can ho";
  if (/phong tro|phong cho thue/.test(normalized)) return "phong tro";

  return normalized;
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

function listingStreetSearchText(listing: ListingMatchCandidate) {
  return normalizeText(
    [
      listing.title,
      listing.address,
      listing.street,
      listing.location,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function listingMatchesNormalizedStreet(
  listing: ListingMatchCandidate,
  normalizedStreets: string[]
) {
  if (normalizedStreets.length === 0) return true;

  const text = listingStreetSearchText(listing);
  return normalizedStreets.some((street) => text.includes(street));
}

export function listingMatchesPreferredStreet(
  listing: ListingMatchCandidate,
  preferredStreets: unknown
) {
  return listingMatchesNormalizedStreet(listing, normalizeStreetList(preferredStreets));
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

const propertyTypeKeywords: Record<string, RegExp[]> = {
  "nguyen can": [/\bnguyen can\b/, /\bnha nguyen can\b/],
  "mat bang": [/\bmat bang\b/, /\bmb\b/],
  "can ho": [/\bcan ho\b/, /\bchung cu\b/, /\bapartment\b/],
  "phong tro": [/\bphong tro\b/, /\bphong cho thue\b/],
};

const propertyTypeConflicts: Record<string, string[]> = {
  "nguyen can": ["can ho", "phong tro"],
  "mat bang": ["can ho", "phong tro"],
  "can ho": ["nguyen can", "mat bang", "phong tro"],
  "phong tro": ["nguyen can", "mat bang", "can ho"],
};

function detectListingPropertyTypes(text: string) {
  return Object.entries(propertyTypeKeywords)
    .filter(([, patterns]) => hasAny(text, patterns))
    .map(([type]) => type);
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

function scorePriceNearTarget(
  value: number | null,
  target: number | null,
  reasons: string[],
  warnings: string[]
) {
  if (target === null) return 0;

  if (value === null || value <= 0) {
    warnings.push("Missing price data");
    return 0;
  }

  const variance = Math.abs(value - target) / target;

  if (value < target * 0.7) {
    warnings.push("Giá thấp hơn nhiều so với ngân sách, có thể chất lượng/vị trí không đúng kỳ vọng");
  }

  if (variance === 0) {
    reasons.push("Giá gần ngân sách khách yêu cầu");
    return 20;
  }
  if (variance <= 0.05) {
    reasons.push("Giá gần ngân sách khách yêu cầu");
    return 19;
  }
  if (variance <= 0.1) {
    reasons.push("Giá gần ngân sách khách yêu cầu");
    return 17;
  }
  if (variance <= 0.2) {
    reasons.push("Giá gần ngân sách khách yêu cầu");
    return 14;
  }
  if (variance <= 0.3) return 8;

  return 0;
}

function scoreAreaNearTarget(
  value: number | null,
  target: number | null,
  reasons: string[],
  warnings: string[]
) {
  if (target === null) return 0;

  if (value === null || value <= 0) {
    warnings.push("Missing area data");
    return 0;
  }

  const variance = Math.abs(value - target) / target;

  if (variance === 0) {
    reasons.push("Diện tích gần nhu cầu");
    return 20;
  }
  if (variance <= 0.1) {
    reasons.push("Diện tích gần nhu cầu");
    return 16;
  }
  if (variance <= 0.2) {
    reasons.push("Diện tích gần nhu cầu");
    return 10;
  }

  return 0;
}

function scoreWidthNearTarget(
  value: number | null,
  target: number | null,
  reasons: string[],
  warnings: string[]
) {
  if (target === null) return 0;

  if (value === null || value <= 0) {
    warnings.push("Missing width data");
    return 0;
  }

  const distance = Math.abs(value - target);

  if (distance === 0) {
    reasons.push(`Ngang gần ${target}m theo yêu cầu`);
    return 20;
  }
  if (distance <= 0.5) {
    reasons.push(`Ngang gần ${target}m theo yêu cầu`);
    return 16;
  }
  if (distance <= 1) {
    reasons.push(`Ngang gần ${target}m theo yêu cầu`);
    return 10;
  }

  return 0;
}

function scoreFloorsNearTarget(
  value: number | null,
  target: number | null,
  reasons: string[],
  warnings: string[]
) {
  if (target === null) return 0;

  if (value === null || value < 0) {
    warnings.push("Missing floor data");
    return 0;
  }

  const distance = Math.abs(value - target);

  if (distance === 0) {
    reasons.push("Kết cấu gần nhu cầu");
    return 15;
  }
  if (distance <= 1) {
    reasons.push("Kết cấu gần nhu cầu");
    return 8;
  }

  return 0;
}

function finiteDistance(value: number | null, target: number | null) {
  if (value === null || target === null) return null;
  return Math.abs(value - target);
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

function getCreatedAtTime(match: MatchResult) {
  const value = match.listing.created_at;

  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function getFreshnessScore(createdAt: unknown) {
  if (!createdAt) return 0;

  const created = new Date(String(createdAt));
  const time = created.getTime();

  if (!Number.isFinite(time)) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const createdDay = new Date(created);
  createdDay.setHours(0, 0, 0, 0);

  const days = Math.floor((today.getTime() - createdDay.getTime()) / 86400000);

  if (days <= 0) return 10;
  if (days <= 3) return 8;
  if (days <= 7) return 6;
  if (days <= 30) return 3;

  return 0;
}

export function normalizeLeadRequirement(requirement: LeadRequirement): NormalizedLeadRequirement {
  return {
    min_price: toNumber(requirement.min_price ?? requirement.minPrice),
    max_price: toNumber(requirement.max_price ?? requirement.maxPrice),
    target_price: toNumber(requirement.target_price ?? requirement.targetPrice),
    price_mode: normalizePriceMode(requirement.price_mode ?? requirement.priceMode),
    preferred_districts: normalizeDistricts(
      requirement.preferred_districts,
      requirement.district,
      requirement.preferredDistricts
    ),
    allow_nearby_districts: normalizeBoolean(
      requirement.allow_nearby_districts ?? requirement.allowNearbyDistricts
    ),
    preferred_wards: normalizeList(requirement.preferred_wards ?? requirement.preferredWards).map(normalizeText),
    preferred_streets: normalizeStreetList(requirement.preferred_streets ?? requirement.preferredStreets),
    min_area: toNumber(requirement.min_area ?? requirement.minArea),
    max_area: toNumber(requirement.max_area ?? requirement.maxArea),
    target_area: toNumber(requirement.target_area ?? requirement.targetArea),
    target_width: toNumber(requirement.target_width ?? requirement.targetWidth),
    target_floors: toNumber(requirement.target_floors ?? requirement.targetFloors),
    min_floors: toNumber(requirement.min_floors ?? requirement.minFloors),
    has_rooftop: normalizeBoolean(requirement.has_rooftop ?? requirement.hasRooftop),
    has_mezzanine: normalizeBoolean(requirement.has_mezzanine ?? requirement.hasMezzanine),
    bedrooms: toNumber(requirement.bedrooms),
    min_bedrooms: toNumber(requirement.min_bedrooms ?? requirement.minBedrooms),
    max_bedrooms: toNumber(requirement.max_bedrooms ?? requirement.maxBedrooms),
    note: requirement.note,
    businessTypes: normalizeList(requirement.businessTypes).map(normalizeText),
    concepts: normalizeList(requirement.concepts).map(normalizeText),
    propertyTypes: normalizeList(requirement.property_types ?? requirement.propertyTypes).map(normalizePropertyType),
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
  const compareDistance = (
    aDistance: number | null | undefined,
    bDistance: number | null | undefined
  ) => {
    const normalizedA =
      typeof aDistance === "number" && Number.isFinite(aDistance)
        ? aDistance
        : Number.POSITIVE_INFINITY;
    const normalizedB =
      typeof bDistance === "number" && Number.isFinite(bDistance)
        ? bDistance
        : Number.POSITIVE_INFINITY;

    return normalizedA - normalizedB;
  };

  return (
    b.score - a.score ||
    compareDistance(a.breakdown.priceDistance, b.breakdown.priceDistance) ||
    compareDistance(a.breakdown.areaDistance, b.breakdown.areaDistance) ||
    compareDistance(a.breakdown.widthDistance, b.breakdown.widthDistance) ||
    getCreatedAtTime(b) - getCreatedAtTime(a) ||
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
  const listingWidth = toNumber(listing.width);
  const listingFloors = toNumber(listing.floors);
  const listingBedrooms = toNumber(listing.bedrooms);
  const text = listingSearchText(listing);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (listingStatus && !["active", "available"].includes(listingStatus)) {
    return null;
  }

  if (!listingPassesHardFilters(listing, requirement)) {
    return null;
  }

  const hasPreferredDistricts = normalized.preferred_districts.length > 0;
  const matchesExactDistrict =
    !hasPreferredDistricts ||
    normalized.preferred_districts.some(
      (district) =>
        district === listingDistrict ||
        districtIsMentioned(text, district)
    );
  const matchesNearbyDistrict =
    hasPreferredDistricts &&
    normalized.allow_nearby_districts &&
    normalized.preferred_districts.some((district) =>
      districtIsNearby(district, listingDistrict)
    );
  const matchesRequestedDistrict =
    !hasPreferredDistricts || matchesExactDistrict || matchesNearbyDistrict;

  if (!matchesRequestedDistrict) {
    return null;
  }

  const hasPreferredStreets = normalized.preferred_streets.length > 0;
  const matchesPreferredStreet =
    !hasPreferredStreets ||
    listingMatchesNormalizedStreet(listing, normalized.preferred_streets);

  if (hasPreferredStreets && !matchesPreferredStreet) {
    return null;
  }

  const breakdown: ScoreBreakdown = {
    district_score: 0,
    ward_score: 0,
    street_score: 0,
    price_score: 0,
    area_score: 0,
    bedroom_score: 0,
    property_type_score: 0,
    freshness_score: 0,
    matching_score: 0,
    final_score: 0,
    business_score: 0,
    feature_score: 0,
    customer_score: 0,
    contract_score: 0,
    data_quality_penalty: 0,
    priceDistance: null,
    areaDistance: null,
    widthDistance: null,
    total_score: 0,
    reasons,
  };

  if (hasPreferredDistricts) {
    if (matchesExactDistrict) {
      breakdown.district_score = 30;
      reasons.push("District matches preference");
    } else if (matchesNearbyDistrict) {
      breakdown.district_score = 15;
      reasons.push("Nearby district matches preference");
    }
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
    if (matchesPreferredStreet) {
      breakdown.street_score = 80;
      reasons.push("Street matches preference");
    } else {
      warnings.push("Listing dung quan nhung chua thay dung duong uu tien");
    }
  }

  breakdown.priceDistance = finiteDistance(listingPrice, normalized.target_price);
  breakdown.price_score =
    normalized.target_price !== null
      ? scorePriceNearTarget(listingPrice, normalized.target_price, reasons, warnings)
      : scoreRange(
          listingPrice,
          normalized.min_price,
          normalized.max_price,
          20,
          "Gia",
          reasons,
          warnings
        );

  breakdown.areaDistance = finiteDistance(listingArea, normalized.target_area);
  breakdown.area_score =
    normalized.target_area !== null
      ? scoreAreaNearTarget(listingArea, normalized.target_area, reasons, warnings)
      : scoreRange(
          listingArea,
          normalized.min_area,
          normalized.max_area,
          20,
          "Area",
          reasons,
          warnings
        );

  breakdown.widthDistance = finiteDistance(listingWidth, normalized.target_width);
  breakdown.width_score = scoreWidthNearTarget(
    listingWidth,
    normalized.target_width,
    reasons,
    warnings
  );

  breakdown.structure_score = scoreFloorsNearTarget(
    listingFloors,
    normalized.target_floors,
    reasons,
    warnings
  );

  const requestedMinBedrooms = normalized.min_bedrooms ?? normalized.bedrooms;
  const requestedMaxBedrooms = normalized.max_bedrooms ?? normalized.bedrooms;

  if (requestedMinBedrooms !== null || requestedMaxBedrooms !== null) {
    if (listingBedrooms === null) {
      warnings.push("Missing bedroom data");
    } else {
      const minBedrooms = requestedMinBedrooms ?? requestedMaxBedrooms;
      const maxBedrooms = requestedMaxBedrooms ?? requestedMinBedrooms;
      const inRequestedRange =
        (minBedrooms === null || listingBedrooms >= minBedrooms) &&
        (maxBedrooms === null || listingBedrooms <= maxBedrooms);

      if (inRequestedRange) {
        breakdown.bedroom_score = 10;
        reasons.push("Bedrooms match requirement");
      } else {
        const nearestBoundary =
          minBedrooms !== null && listingBedrooms < minBedrooms
            ? minBedrooms
            : maxBedrooms;
        const distance =
          nearestBoundary !== null
            ? Math.abs(listingBedrooms - nearestBoundary)
            : Number.POSITIVE_INFINITY;

        breakdown.bedroom_score = distance <= 1 ? -4 : -8;
        warnings.push("So phong ngu khong dung nhu cau");
      }
    }
  }

  if (normalized.propertyTypes.length > 0) {
    const listingPropertyTypes = detectListingPropertyTypes(text);
    const propertyMatched = normalized.propertyTypes.some((type) =>
      listingPropertyTypes.includes(type)
    );
    const propertyConflicted = normalized.propertyTypes.some((type) =>
      (propertyTypeConflicts[type] || []).some((conflict) =>
        listingPropertyTypes.includes(conflict)
      )
    );

    if (propertyMatched) {
      breakdown.property_type_score = 10;
      reasons.push("Property type matches requirement");
    } else if (propertyConflicted) {
      breakdown.property_type_score = -12;
      warnings.push("Loai nha khong dung nhu cau");
    } else {
      warnings.push("Listing chua neu ro loai nha");
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
    (breakdown.width_score || 0) +
    (breakdown.structure_score || 0) +
    breakdown.bedroom_score +
    (breakdown.property_type_score || 0) +
    breakdown.business_score +
    (breakdown.feature_score || 0) +
    (breakdown.customer_score || 0) +
    (breakdown.contract_score || 0) +
    breakdown.data_quality_penalty;

  breakdown.matching_score = Math.max(0, Math.min(100, Math.round(rawTotal)));
  breakdown.freshness_score = getFreshnessScore(listing.created_at);
  if (breakdown.freshness_score > 0) {
    reasons.push("Tin mới đăng");
  }
  breakdown.final_score = breakdown.matching_score + breakdown.freshness_score;
  breakdown.total_score = breakdown.final_score;

  if (breakdown.matching_score <= 0) {
    return null;
  }

  return {
    listing_id: listing.id,
    score: breakdown.final_score,
    breakdown,
    reasons: getMatchReasons(breakdown),
    warnings,
    listing,
  };
}

export function listingPassesHardFilters(
  listing: ListingMatchCandidate,
  requirement: LeadRequirement
) {
  const normalized = normalizeLeadRequirement(requirement);
  const listingPrice = toNumber(listing.price);

  if (
    (normalized.price_mode === "max" ||
      (normalized.price_mode === null && normalized.target_price === null)) &&
    normalized.max_price !== null &&
    listingPrice !== null &&
    listingPrice > normalized.max_price * 1.05
  ) {
    return false;
  }

  if (
    normalized.price_mode === "range" &&
    normalized.max_price !== null &&
    listingPrice !== null &&
    listingPrice > normalized.max_price * 1.05
  ) {
    return false;
  }

  if (
    normalized.price_mode === "target" &&
    normalized.target_price !== null &&
    listingPrice !== null &&
    listingPrice > normalized.target_price * 1.5
  ) {
    return false;
  }

  return true;
}
