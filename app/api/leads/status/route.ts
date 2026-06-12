import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const leadId = String(body.lead_id || "").trim();
    const newStatus = String(body.status || "").trim();

    if (!leadId || !newStatus) {
      return NextResponse.json(
        { success: false, error: "Thiếu trạng thái khách." },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .single();

    if (leadError) {
      throw leadError;
    }

    const oldStatus = String(lead?.status || "Khách mới");

    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId)
      .select("id, status")
      .single();

    if (updateError) {
      throw updateError;
    }

    const { data: activity, error: activityError } = await supabase
      .from("lead_activities")
      .insert([
        {
          lead_id: leadId,
          type: "Trạng thái",
          content: `Chuyển trạng thái: ${oldStatus} → ${newStatus}`,
        },
      ])
      .select("id, lead_id, type, content, created_at")
      .single();

    if (activityError) {
      throw activityError;
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không cập nhật được trạng thái.",
      },
      { status: 500 }
    );
  }
}
