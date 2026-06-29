import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeRequest } from "@/lib/auth";
import {
  compareMatchResults,
  scoreListingForLead,
  type LeadRequirement,
  type MatchResult,
} from "@/lib/matching";
import { parseVietnameseRequirement } from "@/lib/requirementParser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req, ["admin"]);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: "Chỉ Admin được truy cập kho nhà." },
        { status: 403 }
      );
    }

    const { query } = await req.json();
    const rawQuery = String(query || "").trim();

    if (!rawQuery) {
      return NextResponse.json({ success: false, message: "Missing query" });
    }

    const parsed = parseVietnameseRequirement(rawQuery);
    const requirement: LeadRequirement = {
      rawText: rawQuery,
      preferred_districts: parsed.preferred_districts,
      preferredDistricts: parsed.preferredDistricts,
      allow_nearby_districts: parsed.allowNearbyDistricts,
      allowNearbyDistricts: parsed.allowNearbyDistricts,
      min_price: parsed.min_price,
      max_price: parsed.max_price,
      min_area: parsed.min_area,
      max_area: parsed.max_area,
      bedrooms: parsed.bedrooms,
      min_bedrooms: parsed.min_bedrooms,
      max_bedrooms: parsed.max_bedrooms,
      property_types: parsed.property_types,
      propertyTypes: parsed.propertyTypes,
      note: parsed.note,
      businessTypes: parsed.businessTypes,
      concepts: parsed.concepts,
      features: parsed.features,
      targetCustomers: parsed.targetCustomers,
      purpose: parsed.purpose,
    };

    const { data: listings, error } = await supabase
      .from("listings")
      .select("*");

    if (error) throw error;

    const matches = (listings || [])
      .map((listing) => scoreListingForLead(listing, requirement))
      .filter((match): match is MatchResult => Boolean(match))
      .sort(compareMatchResults)
      .slice(0, 10)
      .map((match) => ({
        ...match.listing,
        listing_id: match.listing_id,
        score: match.score,
        breakdown: match.breakdown,
        reasons: match.reasons,
        warnings: match.warnings || [],
      }));

    return NextResponse.json({
      success: true,
      matches,
      query: rawQuery,
      normalizedRequirement: {
        preferredDistricts: parsed.preferredDistricts,
        allowNearbyDistricts: parsed.allowNearbyDistricts,
        maxPrice: parsed.maxPrice,
        bedrooms: parsed.bedrooms,
        minBedrooms: parsed.minBedrooms,
        maxBedrooms: parsed.maxBedrooms,
        propertyTypes: parsed.propertyTypes,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
