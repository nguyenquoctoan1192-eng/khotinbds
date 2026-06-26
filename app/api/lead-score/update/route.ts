import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScore } from "@/lib/leadScore";
import { getAccess } from "@/lib/access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const access = await getAccess(req, ["admin", "agent"]);

if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const customerId = body?.customerId;

    // 🚨 1. validate input
    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing customerId",
        },
        { status: 400 }
      );
    }

    // 🚨 2. get customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer not found",
        },
        { status: 404 }
      );
    }

    // 🚨 3. get events (safe fallback)
    const { data: events, error: eventsError } = await supabase
      .from("customer_events")
      .select("*")
      .eq("customer_id", customerId);

    const safeEvents = events ?? [];

    // 🚨 4. calculate score safely
    const score = calculateLeadScore(safeEvents, customer);

    // 🚨 5. status mapping
    let status: "cold" | "warm" | "hot" = "cold";

    if (score > 80) status = "hot";
    else if (score > 50) status = "warm";

    // 🚨 6. update customer
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        lead_score: score,
        status,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    // 🚨 7. response
    return NextResponse.json({
      success: true,
      score,
      status,
      events_count: safeEvents.length,
    });
  } catch (err) {
    console.error("lead-score-error:", err);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
