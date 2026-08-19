
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";

type LeadRow = {
  id: string;
  fullname: string | null;
  phone: string | null;
  zalo?: string | null;
  facebook?: string | null;
  district?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  bedrooms?: number | null;
  note: string | null;
  status: string | null;
  created_at: string | null;
  property_type?: string | null;
  preferred_districts: unknown;
  min_area?: number | null;
  max_area?: number | null;
  bathrooms?: number | null;
  furniture?: string | null;
  move_in_date?: string | null;
  assigned_broker?: string | null;
  matched_listing_id?: string | null;
  updated_at?: string | null;
  assigned_to?: string | null;
  lead_score?: number | null;
  lead_temperature?: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at: string | null;
};

export async function GET(req: Request) {
  const access = await getAccess(req, ["admin", "agent"]);

  if (!access) {
    return NextResponse.json(
      {
        success: false,
        leads: [],
        activities: [],
        error: "Không có quyền truy cập.",
      },
      { status: 403 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        success: false,
        leads: [],
        activities: [],
        error: "Thiếu cấu hình Supabase để tải danh sách khách.",
      },
      { status: 200 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    /*
     * Các cột CRM cần sử dụng.
     */
    const leadColumns = [
      "id",
      "fullname",
      "phone",
      "zalo",
      "facebook",
      "district",
      "min_price",
      "max_price",
      "bedrooms",
      "note",
      "status",
      "created_at",
      "property_type",
      "preferred_districts",
      "min_area",
      "max_area",
      "bathrooms",
      "furniture",
      "move_in_date",
      "assigned_broker",
      "matched_listing_id",
      "updated_at",
      "assigned_to",
      "lead_score",
      "lead_temperature",
    ].join(", ");

    /*
     * Query chính.
     */
    let leadQuery = supabase
      .from("leads")
      .select(leadColumns)
      .order("created_at", { ascending: false })
      .limit(200);

    /*
     * Agent chỉ xem lead được phân công cho mình.
     * Admin xem toàn bộ.
     */
    if (access.isAgent) {
      leadQuery = leadQuery.eq("assigned_to", access.profile.id);
    }

    const leadSelect = await leadQuery;

    /*
     * Không ép trực tiếp data -> LeadRow[].
     * Dùng unknown trung gian để tránh lỗi TypeScript
     * do kiểu trả về động của Supabase.
     */
    let data: LeadRow[] = (
      leadSelect.data || []
    ) as unknown as LeadRow[];

    let error = leadSelect.error;

    /*
     * Một số database cũ chưa có:
     * - lead_score
     * - lead_temperature
     *
     * Nếu query chính lỗi vì hai cột này,
     * chạy query fallback không lấy hai cột scoring.
     */
    if (
      error &&
      /lead_score|lead_temperature/i.test(
        String(error.message || "")
      )
    ) {
      console.warn(
        "Lead scoring columns missing; loading leads without scoring columns.",
        error.message
      );

      let fallbackQuery = supabase
        .from("leads")
        .select(
          [
            "id",
            "fullname",
            "phone",
            "zalo",
            "facebook",
            "district",
            "min_price",
            "max_price",
            "bedrooms",
            "note",
            "status",
            "created_at",
            "property_type",
            "preferred_districts",
            "min_area",
            "max_area",
            "bathrooms",
            "furniture",
            "move_in_date",
            "assigned_broker",
            "matched_listing_id",
            "updated_at",
            "assigned_to",
          ].join(", ")
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (access.isAgent) {
        fallbackQuery = fallbackQuery.eq(
          "assigned_to",
          access.profile.id
        );
      }

      const fallbackSelect = await fallbackQuery;

      data = (
        fallbackSelect.data || []
      ) as unknown as LeadRow[];

      error = fallbackSelect.error;
    }

    /*
     * Nếu query vẫn lỗi thì trả lỗi thật ra API.
     */
    if (error) {
      console.error(
        "GET /api/leads/list - leads query error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          leads: [],
          activities: [],
          error: error.message,
        },
        { status: 200 }
      );
    }

    /*
     * Lấy activity của toàn bộ lead.
     */
    const leadIds = data
      .map((lead) => lead.id)
      .filter((id): id is string => Boolean(id));

    let activities: LeadActivity[] = [];

    if (leadIds.length > 0) {
      const activitiesResult = await supabase
        .from("lead_activities")
        .select(
          "id, lead_id, type, content, created_at"
        )
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (activitiesResult.error) {
        console.error(
          "GET /api/leads/list - activities query error:",
          activitiesResult.error
        );

        return NextResponse.json(
          {
            success: false,
            leads: [],
            activities: [],
            error: activitiesResult.error.message,
          },
          { status: 200 }
        );
      }

      activities = (
        activitiesResult.data || []
      ) as unknown as LeadActivity[];
    }

    /*
     * Trả dữ liệu cho /admin/customers.
     */
    return NextResponse.json({
      success: true,
      leads: data,
      activities,
      error: "",
    });
  } catch (error) {
    console.error(
      "GET /api/leads/list - unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        leads: [],
        activities: [],
        error:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách khách.",
      },
      { status: 200 }
    );
  }
}


