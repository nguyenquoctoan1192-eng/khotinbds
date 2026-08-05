import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { id } = await context.params;
  const groupId = String(id || "").trim();

  if (!groupId) {
    return NextResponse.json(
      { error: "Thiếu ID nhóm Facebook" },
      { status: 400 },
    );
  }

  const db = getSocialAdminClient();

  const { data: group, error: groupLookupError } = await db
    .from("facebook_groups")
    .select("id,name")
    .eq("id", groupId)
    .maybeSingle();

  if (groupLookupError) {
    return NextResponse.json(
      { error: groupLookupError.message },
      { status: 500 },
    );
  }

  if (!group) {
    return NextResponse.json(
      { error: "Không tìm thấy nhóm Facebook" },
      { status: 404 },
    );
  }

  // Xóa toàn bộ job liên quan trước để không vướng khóa ngoại.
  const { error: jobsError } = await db
    .from("social_post_jobs")
    .delete()
    .eq("facebook_group_id", groupId);

  if (jobsError) {
    return NextResponse.json(
      {
        error: `Không xóa được lịch đăng của nhóm: ${jobsError.message}`,
      },
      { status: 500 },
    );
  }

  // Xóa vĩnh viễn nhóm khỏi database.
  const { error: groupDeleteError } = await db
    .from("facebook_groups")
    .delete()
    .eq("id", groupId);

  if (groupDeleteError) {
    return NextResponse.json(
      {
        error: `Không xóa được nhóm Facebook: ${groupDeleteError.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedGroup: {
      id: group.id,
      name: group.name,
    },
  });
}