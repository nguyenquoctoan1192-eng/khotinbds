import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LeadRequirement,
  MatchResult,
  compareMatchResults,
  normalizeLeadRequirement,
  scoreListingForLead,
} from "@/lib/matching";

type MatchWithLead = MatchResult & { lead_id: string };

const MIN_MATCH_SCORE = 40;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      mode, // 👈 THÊM MODE
      query, // 👈 SEARCH MODE
    } = body;

    console.log("lead-match-debug mode:", mode);
    console.log("lead-match-debug preferred_districts:", preferred_districts);

    // =================================================
    // 🟢 MODE 1: LEAD + MATCHING (giữ logic cũ)
    // =================================================
    if (!mode || mode === "lead") {
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
