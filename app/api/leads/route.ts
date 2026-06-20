import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LeadRequirement,
  ListingMatchCandidate,
  MatchResult,
  compareMatchResults,
  getMatchReasons,
  normalizeLeadRequirement,
  scoreListingForLead,
} from "@/lib/matching";
import { calculateLeadScoring } from "@/lib/leadScoring";
import {
  getDistrictLabel,
  noSearchResultsMessage,
  normalizeDistrictQuery,
  normalizedDistrictNames,
  normalizeSearchText,
} from "@/lib/searchNormalization";

type MatchWithLead = MatchResult & { lead_id: string };

const MIN_MATCH_SCORE = 40;
const KEYWORD_MATCH_SCORE = 45;

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

  return districts.some(
    (district) => normalizeDistrictText(district) === listingDistrict
  );
}

function getDistrictFilteredListings(
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

function scoreListingKeyword(listing: Record<string, unknown>, keywordSearch: unknown) {
  const keyword = normalizeKeywordText(keywordSearch);

  if (!keyword) return 0;

  return getListingKeywordText(listing).includes(keyword) ? KEYWORD_MATCH_SCORE : 0;
}

function hasStructuredRequirement(requirement: LeadRequirement) {
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

    if (mode === "match") {
      const { data: listings } = await supabase
        .from("listings")
        .select("*");

      const requirement: LeadRequirement = {
        min_price,
        max_price,
        preferred_districts,
        min_area,
        bedrooms,
        note,
      };
      const hasStructuredFilters = hasStructuredRequirement(requirement);
      const { listingsForScoring, fallbackWarning } = getSearchFilteredListings(
        listings || [],
        preferred_districts,
        keywordSearch
      );
      const scoringRequirement: LeadRequirement = requirement;

      const matches: MatchResult[] = [];
      const minimumScore = MIN_MATCH_SCORE;
      const hasSearchFilter =
        normalizePreferredDistricts(preferred_districts).length > 0 ||
        Boolean(normalizeKeywordText(keywordSearch));

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);
        const keywordScore = scoreListingKeyword(listing, keywordSearch);

        if (match && (hasSearchFilter || match.score >= minimumScore)) {
          if (keywordScore > 0) {
            match.score += keywordScore;
            match.breakdown.total_score += keywordScore;
            match.breakdown.reasons.push("Keyword matches title/address/content");
            match.reasons = getMatchReasons(match.breakdown);
          }
          matches.push(match);
          continue;
        }

        if (hasSearchFilter && isSearchableListing(listing)) {
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
            listing,
          });
        }
      }

      matches.sort(compareMatchResults);

      return NextResponse.json({
        success: true,
        matches,
        fallbackWarning,
      });
    }

    // =================================================
    // 🟢 MODE 1: LEAD + MATCHING (giữ logic cũ)
    // =================================================
    if (!mode || mode === "lead") {
      const leadScoring = calculateLeadScoring({
        phone,
        max_price,
        min_price,
        preferred_districts,
        note,
        detected_intent,
      });
      const leadPayload = {
        fullname,
        phone,
        min_price,
        max_price,
        preferred_districts,
        min_area,
        bedrooms,
        note,
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

      const requirement: LeadRequirement = {
        min_price,
        max_price,
        preferred_districts,
        min_area,
        bedrooms,
        note,
      };

      console.log(
        "lead-match-debug normalized requirement:",
        normalizeLeadRequirement(requirement)
      );
      console.log(
        "lead-match-debug listings before scoring:",
        listings?.length || 0
      );
      const { listingsForScoring, fallbackWarning } = getSearchFilteredListings(
        listings || [],
        preferred_districts,
        keywordSearch
      );
      const scoringRequirement: LeadRequirement = requirement;

      const matches: MatchWithLead[] = [];
      const minimumScore = MIN_MATCH_SCORE;
      const hasSearchFilter =
        normalizePreferredDistricts(preferred_districts).length > 0 ||
        Boolean(normalizeKeywordText(keywordSearch));

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);

        if (match && (hasSearchFilter || match.score >= minimumScore)) {
          matches.push({
            ...match,
            lead_id: lead.id,
          });
          continue;
        }

        if (hasSearchFilter && isSearchableListing(listing)) {
          matches.push({
            ...createSearchMatch(listing),
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
        matches,
        fallbackWarning,
      });
    }

    // =================================================
    // 🔵 MODE 2: SEARCH BAR (LEVEL 2 UI SEARCH)
    // =================================================
    if (mode === "search") {
      const { data: listings } = await supabase
        .from("listings")
        .select("*");

      const district = getDistrictLabel(query);
      const hardDistricts = district ? [district] : [];
      const keyword = normalizeKeywordText(query);
      const { listingsForScoring, fallbackWarning } = getSearchFilteredListings(
        listings || [],
        hardDistricts,
        district ? null : keyword
      );

      const scored = listingsForScoring.map((item) => {
        let score = 0;
        const bedrooms = Number(item.bedrooms || 0);

        if (hardDistricts.length > 0 && listingMatchesDistrict(item, hardDistricts)) score += 40;
        if (keyword && getListingKeywordText(item).includes(keyword)) score += KEYWORD_MATCH_SCORE;
        if (keyword.includes("phong") && bedrooms >= 1) score += 20;
        if ((keyword.includes("ty") || keyword.includes("ti")) && item.price) score += 20;

        return { ...item, score };
      });

      const matches = scored
        .filter((item) => item.score >= MIN_MATCH_SCORE)
        .sort((a, b) => b.score - a.score);

      return NextResponse.json({
        success: true,
        matches,
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
