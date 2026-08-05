import { NextResponse } from "next/server";
import {
  getDb,
  getOwnedFacebookAccount,
  loadListingsByIds,
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
    const from =
      url.searchParams.get("from") ?? new Date().toISOString();
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit")) || 100),
    );

    const db = getDb();
    const { data, error } = await db
      .from("social_post_jobs")
      .select(
        [
          "id",
          "batch_id",
          "listing_id",
          "facebook_group_id",
          "status",
          "scheduled_at",
          "attempt_count",
          "created_at",
          "facebook_groups(id,name,url,district,category)",
        ].join(","),
      )
      .eq("facebook_account_id", id)
      .in("status", ["pending", "processing"])
      .gte("scheduled_at", from)
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

  type SocialPostJob = {
  id: string;
  batch_id: string | null;
  listing_id: string | null;
  facebook_group_id: string | null;
  status: string;
  scheduled_at: string | null;
  attempt_count: number | null;
  created_at: string;
  facebook_groups: unknown;
};

const jobs = (data ?? []) as unknown as SocialPostJob[];
    const listingMap = await loadListingsByIds(
      jobs.map((job) => String(job.listing_id)),
    );

    return NextResponse.json({
      success: true,
      accountId: id,
      schedule: jobs.map((job) => ({
        ...job,
        listing: listingMap.get(String(job.listing_id)) ?? null,
      })),
      total: jobs.length,
      from,
      readOnly: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được lịch đăng",
      },
      { status: 500 },
    );
  }
}
