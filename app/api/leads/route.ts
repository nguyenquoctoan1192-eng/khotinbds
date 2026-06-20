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

type MatchWithLead = MatchResult & { lead_id: string };

const MIN_MATCH_SCORE = 40;
const KEYWORD_MATCH_SCORE = 45;

const hardFilterDistricts = [
  "Quận 1",
  "Quận 2",
  "Quận 3",
  "Quận 10",
  "Quận 11",
  "Phú Nhuận",
  "Bình Thạnh",
  "Gò Vấp",
  "Tân Bình",
  "Tân Phú",
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeKeywordText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrictText(value: unknown) {
  return normalizeKeywordText(value)
    .replace(/^quan\s+/, "quan ")
    .replace(/^q\s*\.?\s*/, "quan ")
    .trim();
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
    listingsForScoring: listings,
    fallbackWarning: `Không tìm thấy bất động sản đúng ${districts.join(", ")}. Đang hiển thị khu vực lân cận.`,
  };
}

function isSearchableListing(listing: ListingMatchCandidate) {
  const status = normalizeKeywordText(listing.status);
  return !status || ["active", "available"].includes(status);
}

function createFallbackMatch(listing: ListingMatchCandidate): MatchResult {
  return {
    listing_id: listing.id,
    score: 1,
    breakdown: {
      district_score: 0,
      price_score: 0,
      area_score: 0,
      bedroom_score: 0,
      business_score: 0,
      data_quality_penalty: 0,
      total_score: 1,
      reasons: ["Fallback nearby area"],
    },
    reasons: ["Fallback nearby area"],
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
    ]
      .filter(Boolean)
      .join(" ")
  );
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
      const { listingsForScoring, fallbackWarning } = getDistrictFilteredListings(
        listings || [],
        preferred_districts
      );
      const scoringRequirement: LeadRequirement = fallbackWarning
        ? {
            ...requirement,
            preferred_districts: [],
          }
        : requirement;

      const matches: MatchResult[] = [];
      const minimumScore = fallbackWarning ? 1 : MIN_MATCH_SCORE;

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);
        const keywordScore = scoreListingKeyword(listing, keywordSearch);

        if (match && match.score >= minimumScore) {
          if (keywordScore > 0) {
            match.score += keywordScore;
            match.breakdown.total_score += keywordScore;
            match.breakdown.reasons.push("Keyword matches title/address/content");
            match.reasons = getMatchReasons(match.breakdown);
          }
          matches.push(match);
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

      if (fallbackWarning && matches.length === 0) {
        matches.push(
          ...listingsForScoring
            .filter(isSearchableListing)
            .slice(0, 10)
            .map(createFallbackMatch)
        );
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
      const { listingsForScoring, fallbackWarning } = getDistrictFilteredListings(
        listings || [],
        preferred_districts
      );
      const scoringRequirement: LeadRequirement = fallbackWarning
        ? {
            ...requirement,
            preferred_districts: [],
          }
        : requirement;

      const matches: MatchWithLead[] = [];
      const minimumScore = fallbackWarning ? 1 : MIN_MATCH_SCORE;

      for (const listing of listingsForScoring) {
        const match = scoreListingForLead(listing, scoringRequirement);

        if (match && match.score >= minimumScore) {
          matches.push({
            ...match,
            lead_id: lead.id,
          });
        }
      }

      if (fallbackWarning && matches.length === 0) {
        matches.push(
          ...listingsForScoring
            .filter(isSearchableListing)
            .slice(0, 10)
            .map((listing) => ({
              ...createFallbackMatch(listing),
              lead_id: lead.id,
            }))
        );
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

      const q = (query || "").toLowerCase();
      const hardDistricts = extractHardFilterDistrictsFromText(query);
      const { listingsForScoring, fallbackWarning } = getDistrictFilteredListings(
        listings || [],
        hardDistricts
      );

      const scored = listingsForScoring.map((item) => {
        let score = 0;
        const bedrooms = Number(item.bedrooms || 0);

        if (hardDistricts.length > 0 && listingMatchesDistrict(item, hardDistricts)) score += 40;
        if (hardDistricts.length === 0 && q.includes(item.district?.toLowerCase())) score += 30;
        if (q.includes("phòng") && bedrooms >= 1) score += 20;
        if (q.includes("tỷ") && item.price) score += 20;

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
