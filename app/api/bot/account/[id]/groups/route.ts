import { NextResponse } from "next/server";
import {
  getDb,
  getOwnedFacebookAccount,
  requireBotAuth,
  unauthorizedResponse,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await context.params;
    const account = await getOwnedFacebookAccount(auth, id);

    if (!account) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản Facebook thuộc license này" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const district = String(
      url.searchParams.get("district") ?? "",
    ).trim();
    const includeShared =
      url.searchParams.get("includeShared") !== "false";

    const db = getDb();
    let query = db
      .from("facebook_groups")
      .select(
        [
          "id",
          "facebook_account_id",
          "facebook_group_id",
          "name",
          "url",
          "district",
          "category",
          "priority",
          "is_active",
          "source",
          "last_synced_at",
          "group_status",
          "muted_until",
          "daily_post_limit",
          "posts_today",
          "allowed_start_hour",
          "allowed_end_hour",
          "post_interval_hours",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("name", { ascending: true });

    query = includeShared
      ? query.or(
          `facebook_account_id.eq.${id},facebook_account_id.is.null`,
        )
      : query.eq("facebook_account_id", id);

    if (district) query = query.eq("district", district);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      accountId: id,
      groups: data ?? [],
      total: data?.length ?? 0,
      includeShared,
      readOnly: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được danh sách nhóm",
      },
      { status: 500 },
    );
  }
}
