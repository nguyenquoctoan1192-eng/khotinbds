import { NextResponse } from "next/server";

import {
  getAccountCounts,
  getDb,
  getOwnedFacebookAccount,
  loadListingsByIds,
  requireBotAuth,
  serializeAccount,
  unauthorizedResponse,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CurrentJobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string | null;
  facebook_account_id: string | null;
  facebook_group_id: string | null;
  content: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  facebook_post_url: string | null;
  attempt_count: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
};

type BatchJobRow = {
  id: string;
  batch_id: string | null;
  listing_id: string | null;
  facebook_group_id: string | null;
  status: string;
};

type FacebookGroupRow = {
  id: string;
  name: string;
  url: string | null;
  district: string | null;
  category: string | null;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id: accountId } = await context.params;
    const account = await getOwnedFacebookAccount(auth, accountId);

    if (!account) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy tài khoản Facebook thuộc license này",
        },
        { status: 404 },
      );
    }

    const db = getDb();

    const [currentJobResult, counts] = await Promise.all([
      db
        .from("social_post_jobs")
        .select(
          [
            "id","batch_id","listing_id","facebook_account_id",
            "facebook_group_id","content","status","scheduled_at",
            "posted_at","facebook_post_url","attempt_count",
            "last_error","created_at","updated_at",
          ].join(","),
        )
        .eq("facebook_account_id", accountId)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      getAccountCounts(accountId),
    ]);

    if (currentJobResult.error) {
      throw new Error(currentJobResult.error.message);
    }

    const currentJob =
      (currentJobResult.data as unknown as CurrentJobRow | null) ??
      null;

    if (!currentJob) {
      return NextResponse.json({
        success: true,
        account: serializeAccount(account, counts),
        currentJob: null,
      });
    }

    const listingMap = currentJob.listing_id
      ? await loadListingsByIds([String(currentJob.listing_id)])
      : new Map();

    const listing = currentJob.listing_id
      ? listingMap.get(String(currentJob.listing_id)) ?? null
      : null;

    let batchQuery = db
      .from("social_post_jobs")
      .select(
        "id,batch_id,listing_id,facebook_group_id,status",
      )
      .eq("facebook_account_id", accountId);

    if (currentJob.batch_id) {
      batchQuery = batchQuery.eq("batch_id", currentJob.batch_id);
    } else if (currentJob.listing_id) {
      batchQuery = batchQuery.eq(
        "listing_id",
        currentJob.listing_id,
      );
    } else {
      batchQuery = batchQuery.eq("id", currentJob.id);
    }

    const batchJobsResult = await batchQuery;

    if (batchJobsResult.error) {
      throw new Error(batchJobsResult.error.message);
    }

    const batchJobs =
      (batchJobsResult.data ?? []) as unknown as BatchJobRow[];

    const uniqueGroupIds = Array.from(
      new Set(
        batchJobs
          .map((job) => job.facebook_group_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let groups: FacebookGroupRow[] = [];

    if (uniqueGroupIds.length > 0) {
      const groupsResult = await db
        .from("facebook_groups")
        .select("id,name,url,district,category")
        .in("id", uniqueGroupIds);

      if (groupsResult.error) {
        throw new Error(groupsResult.error.message);
      }

      groups =
        (groupsResult.data ?? []) as unknown as FacebookGroupRow[];
    }

    const countStatus = (status: string) =>
      batchJobs.filter((job) => job.status === status).length;

    return NextResponse.json({
      success: true,
      account: serializeAccount(account, counts),
      currentJob: {
        ...currentJob,
        listing,
        batch: {
          id: currentJob.batch_id,
          listingId: currentJob.listing_id,
          totalGroups: uniqueGroupIds.length,
          pendingGroups: countStatus("pending"),
          processingGroups: countStatus("processing"),
          postedGroups: countStatus("posted"),
          failedGroups: countStatus("failed"),
          groups,
        },
      },
    });
  } catch (error) {
    console.error("[BOT ACCOUNT DETAIL ERROR]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được chi tiết tài khoản",
      },
      { status: 500 },
    );
  }
}
