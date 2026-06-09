import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

      const matches: any[] = [];

      for (const listing of listings || []) {
        let score = 0;

        if (listing.price >= min_price && listing.price <= max_price) {
          score += 30;
        }

        if (preferred_districts?.includes(listing.district)) {
          score += 30;
        }

        if (listing.area >= min_area) {
          score += 20;
        }

        if (listing.bedrooms >= bedrooms) {
          score += 20;
        }

        if (score > 0) {
          matches.push({
            lead_id: lead.id,
            listing_id: listing.id,
            score,
            listing,
          });
        }
      }

      matches.sort((a, b) => b.score - a.score);

      const top10 = matches.slice(0, 10);

      if (top10.length > 0) {
        await supabase.from("lead_matches").insert(
          top10.map((m) => ({
            lead_id: m.lead_id,
            listing_id: m.listing_id,
            score: m.score,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        lead,
        matches: top10,
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

      scored.sort((a, b) => b.score - a.score);

      return NextResponse.json({
        success: true,
        matches: scored.slice(0, 10),
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