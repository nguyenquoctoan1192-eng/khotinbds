import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        success: false,
        leads: [],
        error: "Thiếu cấu hình Supabase để tải danh sách khách.",
      },
      { status: 200 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const leadSelect = await supabase
      .from("leads")
      .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    let data: any[] | null = leadSelect.data;
    let error = leadSelect.error;

    if (
      error &&
      String(error.message || "").includes("lead_score")
    ) {
      console.error("lead scoring columns missing; loading leads without score", error);
      const fallbackSelect = await supabase
        .from("leads")
        .select("id, fullname, phone, preferred_districts, note, max_price, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      data = fallbackSelect.data;
      error = fallbackSelect.error;
    }

    if (error) {
      return NextResponse.json(
        {
          success: false,
          leads: [],
          error: error.message,
        },
        { status: 200 }
      );
    }

    const leadIds = (data || []).map((lead) => lead.id).filter(Boolean);
    const { data: activities, error: activitiesError } = leadIds.length > 0
      ? await supabase
          .from("lead_activities")
          .select("id, lead_id, type, content, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (activitiesError) {
      return NextResponse.json(
        {
          success: false,
          leads: [],
          activities: [],
          error: activitiesError.message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      leads: data || [],
      activities: activities || [],
      error: "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        leads: [],
        error: error instanceof Error ? error.message : "Không tải được danh sách khách.",
      },
      { status: 200 }
    );
  }
}
