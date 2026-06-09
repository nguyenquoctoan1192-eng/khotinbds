import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) return NextResponse.json({ success: false, message: "Missing query" });

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, title, address, district, price, area, bedrooms");

    if (error) throw error;

    const q = query.toLowerCase();

    const scored = (listings || []).map(item => {
      let score = 0;
      const district = item.district?.toLowerCase() || "";

      if (q.includes(district)) score += 40;
      if (q.includes("tỷ") && item.price) score += 20;

      const bedMatch = q.match(/(\d+)\s*phòng|(\d+)\s*pn/);
      const beds = Number(bedMatch?.[1] || bedMatch?.[2] || 0);
      if (beds && item.bedrooms >= beds) score += 30;

      return { ...item, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ success: true, matches: scored.slice(0, 10), query });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}