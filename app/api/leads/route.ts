import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LeadRequirement,
  ListingMatchCandidate,
  MatchResult,
  compareMatchResults,
  getMatchReasons,
  listingMatchesPreferredStreet,
  listingPassesHardFilters,
  normalizeLeadRequirement,
  scoreListingForLead,
} from "@/lib/matching";
import { calculateLeadScoring } from "@/lib/leadScoring";
import { parseVietnameseRequirement } from "@/lib/requirementParser";
import {
  getDistrictLabel,
  noSearchResultsMessage,
  normalizeDistrictQuery,
  normalizedDistrictNames,
  normalizeSearchText,
} from "@/lib/searchNormalization";
import { districtIsNearby } from "@/lib/nearbyDistricts";

type MatchWithLead = MatchResult & { lead_id: string };

const MIN_MATCH_SCORE = 40;
const KEYWORD_MATCH_SCORE = 45;
const DEFAULT_MATCH_PAGE_SIZE = 20;
const MAX_MATCH_PAGE_SIZE = 20;
const SEARCH_BATCH_SIZE = 1000;

const hardFilterDistricts = normalizedDistrictNames.map((district) => district.label);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeKeywordText(value: unknown) {
  return normalizeSearchText(value);
}

function normalizeDistrictText(value: unknown) {
  return normalizeDistrictQuery(value) || normalizeKeywordText(value);
}

function normalizePreferredDistricts(value: unknown) {
  const rawDistricts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return rawDistricts
    .map((district) => String(district || "").trim())
    .filter(Boolean);
}

function normalizeStringList(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,/|\n]+/g)
      : [];

  return rawValues
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function clampPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function getListingPagination(body: Record<string, unknown>) {
  const page = clampPositiveInteger(body.page, 1, 100000);
  const limit = clampPositiveInteger(
    body.limit ?? body.pageSize,
    DEFAULT_MATCH_PAGE_SIZE,
    MAX_MATCH_PAGE_SIZE
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, from, to };
}

function buildPaginationMeta(
  pagination: ReturnType<typeof getListingPagination>,
  total: number | null
) {
  const safeTotal = total || 0;

  return {
    page: pagination.page,
    limit: pagination.limit,
    pageSize: pagination.limit,
    total: safeTotal,
    totalPages: Math.ceil(safeTotal / pagination.limit),
    hasNextPage: pagination.to + 1 < safeTotal,
  };
}

function paginateItems<T>(
  items: T[],
  pagination: ReturnType<typeof getListingPagination>
) {
  return items.slice(pagination.from, pagination.to + 1);
}

function getRoughPriceBounds(requirement: LeadRequirement) {
  const normalized = normalizeLeadRequirement(requirement);
  const roughMin =
    normalized.min_price !== null
      ? Math.max(0, Math.floor(normalized.min_price * 0.75))
      : null;
  const roughMax =
    normalized.price_mode === "target" && normalized.target_price !== null
      ? Math.ceil(normalized.target_price * 1.5)
      : normalized.max_price !== null
        ? Math.ceil(normalized.max_price * 1.05)
        : null;

  return { roughMin, roughMax };
}

function buildRoughListingsQuery(
  requirement: LeadRequirement,
  count?: "exact"
) {
  const { roughMin, roughMax } = getRoughPriceBounds(requirement);
  let query = supabase
    .from("listings")
    .select("*", count ? { count } : undefined)
    .order("updated_at", { ascending: false });

  if (roughMin !== null) {
    query = query.gte("price", roughMin);
  }

  if (roughMax !== null) {
    query = query.lte("price", roughMax);
  }

  return query;
}

async function fetchRoughListingsForScoring(requirement: LeadRequirement) {
  const listings: ListingMatchCandidate[] = [];
  let total: number | null = null;
  let from = 0;

  while (total === null || from < total) {
    const to = from + SEARCH_BATCH_SIZE - 1;
    const { data, error, count } = await buildRoughListingsQuery(
      requirement,
      total === null ? "exact" : undefined
    ).range(from, to);

    if (error) {
      throw error;
    }

    if (typeof count === "number") {
      total = count;
    }

    const batch = data || [];
    listings.push(...batch);

    if (batch.length < SEARCH_BATCH_SIZE) {
      break;
    }

    from += SEARCH_BATCH_SIZE;
  }

  return listings;
}

function buildStreetFallbackWarning(streets: string[], districts: string[]) {
  const streetText = streets.join(", ");
  const districtText = districts.join(", ");

  if (districtText) {
    return `Không tìm thấy căn trên đường ${streetText}.\nĐang hiển thị các căn cùng ${districtText}.`;
  }

  return `Không tìm thấy căn trên đường ${streetText}.`;
}

function firstDefined<T>(...values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined);
}

function firstScalar(...values: unknown[]): string | number | null {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  return null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return /^(true|1|yes|co|có)$/i.test(value.trim());
  }

  return false;
}

function getHardFilterDistricts(value: unknown) {
  const preferred = normalizePreferredDistricts(value);
  const allowed = new Map(
    hardFilterDistricts.map((district) => [normalizeDistrictText(district), district])
  );

  return preferred.filter((district) => allowed.has(normalizeDistrictText(district)));
}

function extractHardFilterDistrictsFromText(value: unknown) {
  const normalized = normalizeKeywordText(value);
  const matches: string[] = [];

  for (const district of hardFilterDistricts) {
    const normalizedDistrict = normalizeDistrictText(district);
    const withoutPrefix = normalizedDistrict.replace(/^quan\s+/, "");
    const pattern = /^\d+$/.test(withoutPrefix)
      ? new RegExp(`\\b(?:quan|q)\\.?\\s*${withoutPrefix}\\b`)
      : new RegExp(`\\b${withoutPrefix}\\b`);

    if (pattern.test(normalized)) {
      matches.push(district);
    }
  }

  return matches;
}

function listingMatchesDistrict(listing: Record<string, unknown>, districts: string[]) {
  const listingDistrict = normalizeDistrictText(listing.district);
  const listingText = getListingKeywordText(listing);

  return districts.some(
    (district) => {
      const normalizedDistrict = normalizeDistrictText(district);
      const withoutPrefix = normalizedDistrict.replace(/^quan\s+/, "");

      if (normalizedDistrict === listingDistrict) return true;

      if (/^\d+$/.test(withoutPrefix)) {
        return new RegExp(`\\b(?:quan|q)\\.?\\s*${withoutPrefix}\\b`).test(listingText);
      }

      return listingText.includes(withoutPrefix);
    }
  );
}

function listingMatchesNearbyDistrict(
  listing: Record<string, unknown>,
  districts: string[]
) {
  return districts.some((district) => districtIsNearby(district, listing.district));
}

function getDistrictFilteredListings(
  listings: ListingMatchCandidate[],
  preferredDistricts: unknown,
  allowNearbyDistricts: unknown
) {
  const districts = getHardFilterDistricts(preferredDistricts);
  const allowNearby = normalizeBoolean(allowNearbyDistricts);

  if (districts.length === 0) {
    return {
      districts,
      listingsForScoring: listings,
      fallbackWarning: null as string | null,
    };
  }

  const filteredListings = listings.filter((listing) =>
    listingMatchesDistrict(listing, districts) ||
    (allowNearby && listingMatchesNearbyDistrict(listing, districts))
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

function isSearchableListing(listing: ListingMatchCandidate) {
  const status = normalizeKeywordText(listing.status);
  return !status || ["active", "available"].includes(status);
}

function createSearchMatch(
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
    warnings: [],
    listing,
  };
}

function getListingKeywordText(listing: Record<string, unknown>) {
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

function getSearchFilteredListings(
  listings: ListingMatchCandidate[],
  preferredDistricts: unknown,
  allowNearbyDistricts: unknown,
  preferredStreets: unknown,
  keywordSearch: unknown
) {
  const districtResult = getDistrictFilteredListings(
    listings,
    preferredDistricts,
    allowNearbyDistricts
  );
  const streets = normalizeStringList(preferredStreets);

  if (streets.length > 0) {
    const streetMatches = districtResult.listingsForScoring.filter((listing) =>
      listingMatchesPreferredStreet(listing, streets)
    );

    if (streetMatches.length > 0) {
      return {
        ...districtResult,
        listingsForScoring: streetMatches,
        streetFallback: false,
      };
    }

    if (districtResult.districts.length > 0 && districtResult.listingsForScoring.length > 0) {
      return {
        ...districtResult,
        fallbackWarning: buildStreetFallbackWarning(streets, districtResult.districts),
        streetFallback: true,
      };
    }

    return {
      districts: districtResult.districts,
      listingsForScoring: [] as ListingMatchCandidate[],
      fallbackWarning:
        districtResult.fallbackWarning ||
        buildStreetFallbackWarning(streets, districtResult.districts),
      streetFallback: false,
    };
  }

  if (districtResult.districts.length > 0) {
    return {
      ...districtResult,
      streetFallback: false,
    };
  }

  const keyword = normalizeKeywordText(keywordSearch);

  if (!keyword) {
    return {
      ...districtResult,
      streetFallback: false,
    };
  }

  const filteredListings = listings.filter((listing) =>
    getListingKeywordText(listing).includes(keyword)
  );

  return {
    districts: [] as string[],
    listingsForScoring: filteredListings,
    fallbackWarning: filteredListings.length === 0 ? noSearchResultsMessage : null,
    streetFallback: false,
  };
}

function scoreListingKeyword(listing: Record<string, unknown>, keywordSearch: unknown) {
  const keyword = normalizeKeywordText(keywordSearch);

  if (!keyword) return 0;

  return getListingKeywordText(listing).includes(keyword) ? KEYWORD_MATCH_SCORE : 0;
}

function hasStructuredRequirement(requirement: LeadRequirement) {
  return Boolean(
    requirement.min_price ||
      requirement.minPrice ||
      requirement.max_price ||
      requirement.maxPrice ||
      requirement.target_price ||
      requirement.targetPrice ||
      requirement.min_area ||
      requirement.minArea ||
      requirement.max_area ||
      requirement.maxArea ||
      requirement.target_area ||
      requirement.targetArea ||
      requirement.target_width ||
      requirement.targetWidth ||
      requirement.target_floors ||
      requirement.targetFloors ||
      requirement.bedrooms ||
      requirement.min_bedrooms ||
      requirement.minBedrooms ||
      requirement.max_bedrooms ||
      requirement.maxBedrooms ||
      requirement.note ||
      normalizeStringList(requirement.property_types).length > 0 ||
      normalizeStringList(requirement.propertyTypes).length > 0 ||
      (Array.isArray(requirement.businessTypes) &&
        requirement.businessTypes.length > 0) ||
      (Array.isArray(requirement.concepts) &&
        requirement.concepts.length > 0) ||
      (Array.isArray(requirement.features) &&
        requirement.features.length > 0) ||
      (Array.isArray(requirement.targetCustomers) &&
        requirement.targetCustomers.length > 0) ||
      (Array.isArray(requirement.preferredWards) &&
        requirement.preferredWards.length > 0) ||
      (Array.isArray(requirement.preferredStreets) &&
        requirement.preferredStreets.length > 0) ||
      (Array.isArray(requirement.preferred_streets) &&
        requirement.preferred_streets.length > 0) ||
      (typeof requirement.preferred_streets === "string" &&
        requirement.preferred_streets.trim()) ||
      (Array.isArray(requirement.preferred_districts) &&
        requirement.preferred_districts.length > 0) ||
      (typeof requirement.preferred_districts === "string" &&
        requirement.preferred_districts.trim())
  );
}

function buildRequirementFromBody(body: Record<string, unknown>): LeadRequirement & {
  keywordSearch?: string | null;
} {
  const rawText = String(
    body.query ||
      body.rawText ||
      body.requirementText ||
      body.search ||
      body.note ||
      body.keywordSearch ||
      ""
  );
  const parsed = parseVietnameseRequirement(rawText);
  const preferredDistricts = normalizePreferredDistricts(body.preferred_districts).length > 0
    ? normalizePreferredDistricts(body.preferred_districts)
    : normalizeStringList(body.preferredDistricts).length > 0
      ? normalizeStringList(body.preferredDistricts)
      : parsed.preferred_districts;
  const preferredWards = normalizeStringList(body.preferredWards).length > 0
    ? normalizeStringList(body.preferredWards)
    : normalizeStringList(body.preferred_wards).length > 0
      ? normalizeStringList(body.preferred_wards)
      : parsed.preferredWards;
  const preferredStreets = normalizeStringList(body.preferredStreets).length > 0
    ? normalizeStringList(body.preferredStreets)
    : normalizeStringList(body.preferred_streets).length > 0
      ? normalizeStringList(body.preferred_streets)
      : parsed.preferredStreets;
  const businessTypes = normalizeStringList(body.businessTypes).length > 0
    ? normalizeStringList(body.businessTypes)
    : parsed.businessTypes;
  const concepts = normalizeStringList(body.concepts).length > 0
    ? normalizeStringList(body.concepts)
    : parsed.concepts;
  const features = normalizeStringList(body.features).length > 0
    ? normalizeStringList(body.features)
    : parsed.features;
  const targetCustomers = normalizeStringList(body.targetCustomers).length > 0
    ? normalizeStringList(body.targetCustomers)
    : parsed.targetCustomers;
  const propertyTypes = normalizeStringList(body.propertyTypes).length > 0
    ? normalizeStringList(body.propertyTypes)
    : normalizeStringList(body.property_types).length > 0
      ? normalizeStringList(body.property_types)
      : parsed.propertyTypes;
  const note = String(firstDefined(body.note, parsed.note, "") || "").trim();
  const requirement: LeadRequirement & { keywordSearch?: string | null } = {
    rawText: rawText || parsed.rawText,
    min_price: firstScalar(body.min_price, body.minPrice, parsed.min_price),
    max_price: firstScalar(body.max_price, body.maxPrice, parsed.max_price),
    target_price: firstScalar(body.target_price, body.targetPrice, parsed.target_price),
    minPrice: firstScalar(body.minPrice, body.min_price, parsed.minPrice),
    maxPrice: firstScalar(body.maxPrice, body.max_price, parsed.maxPrice),
    targetPrice: firstScalar(body.targetPrice, body.target_price, parsed.targetPrice),
    priceMode: String(firstDefined(body.priceMode, body.price_mode, parsed.priceMode, "") || "").trim() || null,
    price_mode: String(firstDefined(body.price_mode, body.priceMode, parsed.priceMode, "") || "").trim() || null,
    min_area: firstScalar(body.min_area, body.minArea, parsed.min_area),
    max_area: firstScalar(body.max_area, body.maxArea, parsed.max_area),
    target_area: firstScalar(body.target_area, body.targetArea, parsed.target_area),
    target_width: firstScalar(body.target_width, body.targetWidth, parsed.target_width),
    minArea: firstScalar(body.minArea, body.min_area, parsed.minArea),
    maxArea: firstScalar(body.maxArea, body.max_area, parsed.maxArea),
    targetArea: firstScalar(body.targetArea, body.target_area, parsed.targetArea),
    targetWidth: firstScalar(body.targetWidth, body.target_width, parsed.targetWidth),
    target_floors: firstScalar(body.target_floors, body.targetFloors, parsed.target_floors),
    min_floors: firstScalar(body.min_floors, body.minFloors, parsed.min_floors),
    targetFloors: firstScalar(body.targetFloors, body.target_floors, parsed.targetFloors),
    minFloors: firstScalar(body.minFloors, body.min_floors, parsed.minFloors),
    has_rooftop: firstDefined(body.has_rooftop, body.hasRooftop, parsed.has_rooftop) as boolean,
    has_mezzanine: firstDefined(body.has_mezzanine, body.hasMezzanine, parsed.has_mezzanine) as boolean,
    hasRooftop: firstDefined(body.hasRooftop, body.has_rooftop, parsed.hasRooftop) as boolean,
    hasMezzanine: firstDefined(body.hasMezzanine, body.has_mezzanine, parsed.hasMezzanine) as boolean,
    preferred_districts: preferredDistricts,
    preferredDistricts,
    preferred_wards: preferredWards,
    preferredWards,
    preferred_streets: preferredStreets,
    preferredStreets,
    allow_nearby_districts: firstDefined(
      body.allow_nearby_districts,
      body.allowNearbyDistricts,
      parsed.allowNearbyDistricts
    ) as boolean,
    allowNearbyDistricts: firstDefined(
      body.allowNearbyDistricts,
      body.allow_nearby_districts,
      parsed.allowNearbyDistricts
    ) as boolean,
    bedrooms: firstScalar(body.bedrooms, parsed.bedrooms),
    min_bedrooms: firstScalar(body.min_bedrooms, body.minBedrooms, parsed.min_bedrooms),
    max_bedrooms: firstScalar(body.max_bedrooms, body.maxBedrooms, parsed.max_bedrooms),
    minBedrooms: firstScalar(body.minBedrooms, body.min_bedrooms, parsed.minBedrooms),
    maxBedrooms: firstScalar(body.maxBedrooms, body.max_bedrooms, parsed.maxBedrooms),
    note: note || null,
    businessTypes,
    concepts,
    property_types: propertyTypes,
    propertyTypes,
    features,
    targetCustomers,
    purpose: String(firstDefined(body.purpose, parsed.purpose, "") || "").trim() || null,
    keywordSearch: String(firstDefined(body.keywordSearch, parsed.keywordSearch, "") || "").trim() || null,
  };

  return requirement;
}

function buildNormalizedRequirementResponse(requirement: LeadRequirement & {
  keywordSearch?: string | null;
}) {
  const normalized = normalizeLeadRequirement(requirement);

  return {
    rawText: requirement.rawText || "",
    businessTypes: normalized.businessTypes,
    concepts: normalized.concepts,
    preferredDistricts: normalizeStringList(requirement.preferredDistricts).length > 0
      ? normalizeStringList(requirement.preferredDistricts)
      : normalizeStringList(requirement.preferred_districts),
    allowNearbyDistricts: normalized.allow_nearby_districts,
    preferredWards: normalizeStringList(requirement.preferredWards),
    preferredStreets: normalizeStringList(requirement.preferredStreets).length > 0
      ? normalizeStringList(requirement.preferredStreets)
      : normalizeStringList(requirement.preferred_streets),
    minArea: normalized.min_area ?? undefined,
    maxArea: normalized.max_area ?? undefined,
    targetArea: normalized.target_area ?? undefined,
    targetWidth: normalized.target_width ?? undefined,
    minPrice: normalized.min_price ?? undefined,
    maxPrice: normalized.max_price ?? undefined,
    targetPrice: normalized.target_price ?? undefined,
    priceMode: normalized.price_mode ?? undefined,
    targetFloors: normalized.target_floors ?? undefined,
    minFloors: normalized.min_floors ?? undefined,
    hasRooftop: normalized.has_rooftop,
    hasMezzanine: normalized.has_mezzanine,
    bedrooms: normalized.bedrooms ?? undefined,
    minBedrooms: normalized.min_bedrooms ?? undefined,
    maxBedrooms: normalized.max_bedrooms ?? undefined,
    propertyTypes: normalized.propertyTypes,
    features: normalized.features,
    targetCustomers: normalized.targetCustomers,
    purpose: requirement.purpose || undefined,
    preferred_districts: normalizeStringList(requirement.preferred_districts),
    preferred_streets: normalizeStringList(requirement.preferred_streets),
    allow_nearby_districts: normalized.allow_nearby_districts,
    min_price: normalized.min_price,
    max_price: normalized.max_price,
    target_price: normalized.target_price,
    price_mode: normalized.price_mode,
    min_area: normalized.min_area,
    max_area: normalized.max_area,
    target_area: normalized.target_area,
    target_width: normalized.target_width,
    target_floors: normalized.target_floors,
    min_floors: normalized.min_floors,
    has_rooftop: normalized.has_rooftop,
    has_mezzanine: normalized.has_mezzanine,
    min_bedrooms: normalized.min_bedrooms,
    max_bedrooms: normalized.max_bedrooms,
    property_types: normalized.propertyTypes,
    keywordSearch: requirement.keywordSearch || null,
    note: requirement.note || "",
  };
}

export async function POST(req: Request) {
  console.log("URL:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("ANON:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log("SERVICE:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();

    const {
      fullname,
      phone,
      min_price,
      max_price,
      preferred_districts,
      min_area,
      bedrooms,
      note,
      keywordSearch,
      detected_intent,
      mode, // 👈 THÊM MODE
      query, // 👈 SEARCH MODE
    } = body;

    console.log("lead-match-debug mode:", mode);
    console.log("lead-match-debug preferred_districts:", preferred_districts);

    const requestRequirement = buildRequirementFromBody(body);
    const normalizedRequirement =
      buildNormalizedRequirementResponse(requestRequirement);
    const listingPagination = getListingPagination(body);

    if (mode === "match") {
      const listings = await fetchRoughListingsForScoring(requestRequirement);

      const requirement: LeadRequirement = requestRequirement;
      const hasStructuredFilters = hasStructuredRequirement(requirement);
      const { listingsForScoring, fallbackWarning, streetFallback } = getSearchFilteredListings(
        listings || [],
        requestRequirement.preferred_districts,
        requestRequirement.allowNearbyDistricts,
        requestRequirement.preferred_streets,
        hasStructuredFilters ? null : requestRequirement.keywordSearch
      );
      const scoringRequirement: LeadRequirement = streetFallback
        ? { ...requirement, preferred_streets: [], preferredStreets: [] }
        : requirement;

      const matches: MatchResult[] = [];
      const minimumScore = MIN_MATCH_SCORE;
      const hasDistrictFilter =
        normalizePreferredDistricts(requestRequirement.preferred_districts).length > 0;
      const hasStreetFilter =
        normalizeStringList(requestRequirement.preferred_streets).length > 0;

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);
        const keywordScore = hasStreetFilter
          ? 0
          : scoreListingKeyword(listing, requestRequirement.keywordSearch);

        if (match && (hasDistrictFilter || match.score + keywordScore >= minimumScore)) {
          if (keywordScore > 0) {
            match.score += keywordScore;
            match.breakdown.total_score += keywordScore;
            match.breakdown.matching_score =
              (match.breakdown.matching_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.final_score =
              (match.breakdown.final_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.reasons.push("Keyword matches title/address/content");
            match.reasons = getMatchReasons(match.breakdown);
          }
          matches.push(match);
          continue;
        }

        if (!listingPassesHardFilters(listing, scoringRequirement)) {
          continue;
        }

        if (keywordScore >= minimumScore && isSearchableListing(listing)) {
          matches.push(
            createSearchMatch(
              listing,
              keywordScore || KEYWORD_MATCH_SCORE,
              "Search text matches listing"
            )
          );
          continue;
        }

        if (!hasStructuredFilters && keywordScore >= MIN_MATCH_SCORE) {
          matches.push({
            listing_id: listing.id,
            score: keywordScore,
            breakdown: {
              district_score: 0,
              price_score: 0,
              area_score: 0,
              bedroom_score: 0,
              business_score: 0,
              data_quality_penalty: 0,
              total_score: keywordScore,
              reasons: ["Keyword matches title/address/content"],
            },
            reasons: ["Keyword matches title/address/content"],
            warnings: [],
            listing,
          });
        }
      }

      matches.sort(compareMatchResults);
      const pagedMatches = paginateItems(matches, listingPagination);
      const pagination = buildPaginationMeta(listingPagination, matches.length);

      return NextResponse.json({
        success: true,
        normalizedRequirement,
        listings: pagedMatches,
        matches: pagedMatches,
        total: pagination.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: pagination.totalPages,
        pagination,
        fallbackWarning,
      });
    }

    // =================================================
    // 🟢 MODE 1: LEAD + MATCHING (giữ logic cũ)
    // =================================================
    if (!mode || mode === "lead") {
      const leadPreferredDistricts =
        normalizeStringList(requestRequirement.preferred_districts);
      const leadMinPrice = requestRequirement.min_price ?? null;
      const leadMaxPrice = requestRequirement.max_price ?? null;
      const leadMinArea = requestRequirement.min_area ?? null;
      const leadNote = requestRequirement.note || note || null;
      const leadScoring = calculateLeadScoring({
        phone,
        max_price: leadMaxPrice,
        min_price: leadMinPrice,
        preferred_districts: leadPreferredDistricts,
        note: leadNote,
        detected_intent,
      });
      const leadPayload = {
        fullname,
        phone,
        min_price: leadMinPrice,
        max_price: leadMaxPrice,
        preferred_districts: leadPreferredDistricts,
        min_area: leadMinArea,
        bedrooms,
        note: leadNote,
      };
      let { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert([
          {
            ...leadPayload,
            ...leadScoring,
          },
        ])
        .select()
        .single();

      if (
        leadError &&
        String(leadError.message || "").includes("lead_score")
      ) {
        console.error("lead scoring columns missing; saving lead without score", leadError);
        const fallbackInsert = await supabase
          .from("leads")
          .insert([leadPayload])
          .select()
          .single();

        lead = fallbackInsert.data;
        leadError = fallbackInsert.error;
      }

      if (leadError) throw leadError;

      const { data: listings } = await supabase
        .from("listings")
        .select("*");

      const requirement: LeadRequirement = requestRequirement;

      console.log(
        "lead-match-debug normalized requirement:",
        normalizeLeadRequirement(requirement)
      );
      console.log(
        "lead-match-debug listings before scoring:",
        listings?.length || 0
      );
      const { listingsForScoring, fallbackWarning, streetFallback } = getSearchFilteredListings(
        listings || [],
        requestRequirement.preferred_districts,
        requestRequirement.allowNearbyDistricts,
        requestRequirement.preferred_streets,
        hasStructuredRequirement(requirement) ? null : requestRequirement.keywordSearch
      );
      const scoringRequirement: LeadRequirement = streetFallback
        ? { ...requirement, preferred_streets: [], preferredStreets: [] }
        : requirement;

      const matches: MatchWithLead[] = [];
      const minimumScore = MIN_MATCH_SCORE;
      const hasDistrictFilter =
        normalizePreferredDistricts(requestRequirement.preferred_districts).length > 0;
      const hasStreetFilter =
        normalizeStringList(requestRequirement.preferred_streets).length > 0;

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);
        const keywordScore = hasStreetFilter
          ? 0
          : scoreListingKeyword(listing, requestRequirement.keywordSearch);

        if (match && (hasDistrictFilter || match.score + keywordScore >= minimumScore)) {
          if (keywordScore > 0) {
            match.score += keywordScore;
            match.breakdown.total_score += keywordScore;
            match.breakdown.matching_score =
              (match.breakdown.matching_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.final_score =
              (match.breakdown.final_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.reasons.push("Keyword matches title/address/content");
            match.reasons = getMatchReasons(match.breakdown);
          }
          matches.push({
            ...match,
            lead_id: lead.id,
          });
          continue;
        }

        if (!listingPassesHardFilters(listing, scoringRequirement)) {
          continue;
        }

        if (keywordScore >= minimumScore && isSearchableListing(listing)) {
          matches.push({
            ...createSearchMatch(listing, keywordScore, "Search text matches listing"),
            lead_id: lead.id,
          });
        }
      }

      console.log(
        "lead-match-debug matches after scoring:",
        matches.length
      );

      matches.sort(compareMatchResults);

      if (matches.length > 0) {
        await supabase.from("lead_matches").insert(
          matches.map((m) => ({
            lead_id: m.lead_id,
            listing_id: m.listing_id,
            score: m.score,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        lead,
        normalizedRequirement,
        matches,
        fallbackWarning,
      });
    }

    // =================================================
    // 🔵 MODE 2: SEARCH BAR (LEVEL 2 UI SEARCH)
    // =================================================
    if (mode === "search") {
      const listings = await fetchRoughListingsForScoring(requestRequirement);

      const district = getDistrictLabel(query);
      const hardDistricts =
        normalizeStringList(requestRequirement.preferred_districts).length > 0
          ? normalizeStringList(requestRequirement.preferred_districts)
          : district
            ? [district]
            : [];
      const keyword = requestRequirement.keywordSearch || normalizeKeywordText(query);
      const searchRequirement: LeadRequirement = {
        ...requestRequirement,
        preferred_districts: hardDistricts,
        preferredDistricts: hardDistricts,
      };
      const hasStructuredFilters = hasStructuredRequirement(searchRequirement);
      const { listingsForScoring, fallbackWarning, streetFallback } = getSearchFilteredListings(
        listings || [],
        hardDistricts,
        searchRequirement.allowNearbyDistricts,
        searchRequirement.preferred_streets,
        hasStructuredFilters ? null : keyword
      );
      const scoringRequirement: LeadRequirement = streetFallback
        ? { ...searchRequirement, preferred_streets: [], preferredStreets: [] }
        : searchRequirement;
      const hasStreetFilter =
        normalizeStringList(searchRequirement.preferred_streets).length > 0;

      const matches: MatchResult[] = [];

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);
        const keywordScore = hasStreetFilter ? 0 : scoreListingKeyword(listing, keyword);

        if (match && match.score + keywordScore >= MIN_MATCH_SCORE) {
          if (keywordScore > 0) {
            match.score += keywordScore;
            match.breakdown.total_score += keywordScore;
            match.breakdown.matching_score =
              (match.breakdown.matching_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.final_score =
              (match.breakdown.final_score || match.breakdown.total_score) +
              keywordScore;
            match.breakdown.reasons.push("Keyword matches title/address/content");
            match.reasons = getMatchReasons(match.breakdown);
          }

          matches.push(match);
          continue;
        }

        if (!listingPassesHardFilters(listing, scoringRequirement)) {
          continue;
        }

        if (keywordScore >= MIN_MATCH_SCORE && isSearchableListing(listing)) {
          matches.push(
            createSearchMatch(listing, keywordScore, "Search text matches listing")
          );
        }
      }

      matches.sort(compareMatchResults);
      const pagedMatches = paginateItems(matches, listingPagination);
      const pagination = buildPaginationMeta(listingPagination, matches.length);

      return NextResponse.json({
        success: true,
        normalizedRequirement,
        listings: pagedMatches,
        matches: pagedMatches,
        total: pagination.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: pagination.totalPages,
        pagination,
        fallbackWarning,
      });
    }

    return NextResponse.json({
      success: false,
      message: "Invalid mode",
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
