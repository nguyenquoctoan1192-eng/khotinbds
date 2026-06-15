import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LeadRequirement,
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

      const matches: MatchResult[] = [];

      for (const listing of listings || []) {
        const match = scoreListingForLead(listing, requirement);
        const keywordScore = scoreListingKeyword(listing, keywordSearch);

        if (match && match.score >= MIN_MATCH_SCORE) {
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

      matches.sort(compareMatchResults);

      return NextResponse.json({
        success: true,
        matches,
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
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert([
          {
            fullname,
            phone,
            min_price,
            max_price,
            preferred_districts,
            min_area,
            bedrooms,
            note,
            ...leadScoring,
          },
        ])
        .select()
        .single();

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

      const matches: MatchWithLead[] = [];

      for (const listing of listings || []) {
        const match = scoreListingForLead(listing, requirement);

        if (match && match.score >= MIN_MATCH_SCORE) {
          matches.push({
            ...match,
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

      const scored = (listings || []).map((item) => {
        let score = 0;

        if (q.includes(item.district?.toLowerCase())) score += 30;
        if (q.includes("phòng") && item.bedrooms >= 1) score += 20;
        if (q.includes("tỷ") && item.price) score += 20;

        return { ...item, score };
      });

      const matches = scored
        .filter((item) => item.score >= MIN_MATCH_SCORE)
        .sort((a, b) => b.score - a.score);

      return NextResponse.json({
        success: true,
        matches,
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
