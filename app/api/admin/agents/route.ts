import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";
import { AGENT_AREAS, isProfileStatus } from "@/lib/agentProfile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/agents
 *
 * Chỉ admin đã được approved mới được xem danh sách môi giới.
 *
 * Hỗ trợ:
 * ?area=Tân Bình
 * ?status=pending
 * ?keyword=nguyen
 */
export async function GET(req: Request) {
  try {
    const access = await getAccess(req, ["admin"]);

    if (!access) {
      return NextResponse.json(
        {
          success: false,
          error: "Không có quyền truy cập.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);

    const area = searchParams.get("area")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const keyword = searchParams.get("keyword")?.trim() || "";

    if (status && !isProfileStatus(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Trạng thái không hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (
      area &&
      !AGENT_AREAS.includes(
        area as (typeof AGENT_AREAS)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Khu vực không hợp lệ.",
        },
        { status: 400 }
      );
    }

    let query = supabase
      .from("profiles")
      .select(
        "id, full_name, phone, zalo, email, area, role, status, created_at, updated_at"
      )
      .eq("role", "agent")
      .order("created_at", { ascending: false });

    if (area) {
      query = query.eq("area", area);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (keyword) {
      const escapedKeyword = keyword
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/,/g, "\\,");

      query = query.or(
        `full_name.ilike.%${escapedKeyword}%,phone.ilike.%${escapedKeyword}%,zalo.ilike.%${escapedKeyword}%,email.ilike.%${escapedKeyword}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "GET /api/admin/agents failed:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Không tải được danh sách môi giới.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agents: data || [],
    });
  } catch (error) {
    console.error(
      "GET /api/admin/agents unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Lỗi máy chủ khi tải danh sách môi giới.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/agents
 *
 * Body:
 * {
 *   id: string,
 *   status: "pending" | "approved" | "rejected" | "suspended"
 * }
 */
export async function PATCH(req: Request) {
  try {
    const access = await getAccess(req, ["admin"]);

    if (!access) {
      return NextResponse.json(
        {
          success: false,
          error: "Không có quyền thực hiện thao tác này.",
        },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 }
      );
    }

    const payload = body as {
      id?: unknown;
      status?: unknown;
    };

    const id =
      typeof payload.id === "string"
        ? payload.id.trim()
        : "";

    const status = payload.status;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Thiếu ID môi giới.",
        },
        { status: 400 }
      );
    }

    if (!isProfileStatus(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Trạng thái không hợp lệ.",
        },
        { status: 400 }
      );
    }

    // Kiểm tra profile phải thực sự là agent.
    const {
      data: existingAgent,
      error: findError,
    } = await supabase
      .from("profiles")
      .select("id, role, status")
      .eq("id", id)
      .eq("role", "agent")
      .maybeSingle();

    if (findError) {
      console.error(
        "PATCH /api/admin/agents find failed:",
        findError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Không kiểm tra được môi giới.",
        },
        { status: 500 }
      );
    }

    if (!existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: "Không tìm thấy môi giới.",
        },
        { status: 404 }
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("role", "agent")
      .select(
        "id, full_name, phone, zalo, email, area, role, status, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error(
        "PATCH /api/admin/agents update failed:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Không cập nhật được trạng thái môi giới.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: data,
    });
  } catch (error) {
    console.error(
      "PATCH /api/admin/agents unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Lỗi máy chủ khi cập nhật môi giới.",
      },
      { status: 500 }
    );
  }
}