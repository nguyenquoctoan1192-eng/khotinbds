import { NextResponse } from "next/server";
import {
  buildSchedule,
  MAX_GROUPS_PER_CROSSPOST,
  selectCrosspostGroups,
  type GroupCandidate,
} from "@/lib/socialPosting";
import { getSocialAdminClient } from "@/lib/socialSupabase";
import { replacePrivateAddressInContent } from "@/lib/addressNormalizer";

type Body = {
  listingId?: string;
  listing_id?: string;

  facebookAccountId?: string;
  facebook_account_id?: string;
  accountId?: string;

  district?: string;
  categories?: string[];

  contents?: string[];
  contentVariants?: string[];

  groupIds?: string[];
  startAt?: string;

  listing?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    const listingId = String(
      body.listingId || body.listing_id || "",
    ).trim();

    const contents = (
      body.contents?.length
        ? body.contents
        : body.contentVariants ?? []
    )
      .map((content) => String(content || "").trim())
      .filter(Boolean);

    if (!listingId || !contents.length) {
      return NextResponse.json(
        { error: "Thiếu mã tin hoặc nội dung đăng Facebook" },
        { status: 400 },
      );
    }

    if (
      (body.groupIds?.length || 0) >
      MAX_GROUPS_PER_CROSSPOST
    ) {
      return NextResponse.json(
        {
          error: `Mỗi lượt chỉ được chọn tối đa ${MAX_GROUPS_PER_CROSSPOST} nhóm`,
        },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    let facebookAccountId = String(
      body.facebookAccountId ||
        body.facebook_account_id ||
        body.accountId ||
        "",
    ).trim();

    if (!facebookAccountId) {
      const {
        data: activeAccount,
        error: accountError,
      } = await db
        .from("facebook_accounts")
        .select("id")
        .eq("is_active", true)
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (accountError) {
        return NextResponse.json(
          { error: accountError.message },
          { status: 500 },
        );
      }

      facebookAccountId = String(
        activeAccount?.id || "",
      ).trim();
    }

    if (!facebookAccountId) {
      return NextResponse.json(
        {
          error:
            "Chưa cấu hình nick Facebook đang hoạt động",
        },
        { status: 409 },
      );
    }

    const { data: account, error: selectedAccountError } = await db
      .from("facebook_accounts")
      .select(`
        id,
        posting_mode,
        start_time,
        end_time,
        interval_min_minutes,
        interval_max_minutes,
        max_posts_per_day,
        is_active
      `)
      .eq("id", facebookAccountId)
      .single();

    if (selectedAccountError || !account || !account.is_active) {
      return NextResponse.json(
        { error: selectedAccountError?.message || "Nick Facebook đang tắt hoặc không tồn tại" },
        { status: 409 },
      );
    }

    const {
      data: listing,
      error: listingError,
    } = await db
      .from("listings")
      .select(`
        id,
        status,
        title,
        district,
        address,
        description,
        price,
        area,
        width,
        length,
        floors,
        bedrooms,
        bathrooms,
        images,
        contact_phone
      `)
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        {
          error:
            listingError?.message ||
            "Không tìm thấy tin",
        },
        { status: 404 },
      );
    }

    if (
      listing.status &&
      listing.status !== "available"
    ) {
      return NextResponse.json(
        { error: "Tin không còn khả dụng" },
        { status: 409 },
      );
    }

    const listingPayload =
      body.listing &&
      typeof body.listing === "object"
        ? body.listing
        : {};

    const district = String(
      body.district ||
        listingPayload.district ||
        listing.district ||
        "",
    ).trim();

    if (!district) {
      return NextResponse.json(
        {
          error:
            "Không xác định được quận của tin đăng",
        },
        { status: 400 },
      );
    }

    const categories = Array.isArray(
      body.categories,
    )
      ? body.categories
          .map((category) =>
            String(category || "").trim(),
          )
          .filter(Boolean)
      : [];

    let groupsQuery = db
      .from("facebook_groups")
      .select(`
        id,
        name,
        districts,
        category,
        priority
      `)
      .eq("is_active", true);

    if (body.groupIds?.length) {
      groupsQuery = groupsQuery.in(
        "id",
        body.groupIds,
      );
    }

    const {
      data: groupRows,
      error: groupsError,
    } = await groupsQuery;

    if (groupsError) {
      return NextResponse.json(
        { error: groupsError.message },
        { status: 500 },
      );
    }

    const groups: GroupCandidate[] = (
      groupRows ?? []
    ).map((group) => ({
      id: String(group.id),
      name: String(group.name || ""),
      districts: Array.isArray(
        group.districts,
      )
        ? group.districts.map(String)
        : [],
      category: String(
        group.category || "general",
      ),
      priority: Number(
        group.priority || 100,
      ),
    }));

    const selectedGroups =
      body.groupIds?.length
        ? groups.slice(
            0,
            MAX_GROUPS_PER_CROSSPOST,
          )
        : selectCrosspostGroups(
            groups,
            district,
            categories,
          );

    if (!selectedGroups.length) {
      return NextResponse.json(
        {
          error: `Chưa có nhóm Facebook phù hợp với ${district}`,
        },
        { status: 409 },
      );
    }

    const {
      data: existingBatch,
      error: existingBatchError,
    } = await db
      .from("social_post_batches")
      .select("id")
      .eq("listing_id", listingId)
      .eq(
        "facebook_account_id",
        facebookAccountId,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingBatchError) {
      return NextResponse.json(
        { error: existingBatchError.message },
        { status: 500 },
      );
    }

    if (existingBatch?.id) {
      const {
        data: existingJobs,
        error: existingJobsError,
      } = await db
        .from("social_post_jobs")
        .select("id,status")
        .eq("batch_id", existingBatch.id)
        .in("status", [
          "pending",
          "processing",
          "posting",
          "completed",
          "success",
        ])
        .limit(1);

      if (existingJobsError) {
        return NextResponse.json(
          {
            error: existingJobsError.message,
          },
          { status: 500 },
        );
      }

      if (
        Array.isArray(existingJobs) &&
        existingJobs.length > 0
      ) {
        return NextResponse.json(
          {
            success: true,
            skipped: true,
            message:
              "Tin này đã có trong hàng chờ Facebook",
            batchId: existingBatch.id,
            groupCount: 0,
            jobs: [],
          },
          { status: 200 },
        );
      }
    }

    const {
      data: batch,
      error: batchError,
    } = await db
      .from("social_post_batches")
      .insert({
        listing_id: listingId,
        facebook_account_id:
          facebookAccountId,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        {
          error:
            batchError?.message ||
            "Không tạo được lượt đăng",
        },
        { status: 500 },
      );
    }

    const startAt = body.startAt
      ? new Date(body.startAt)
      : new Date();

    if (Number.isNaN(startAt.getTime())) {
      await db
        .from("social_post_batches")
        .delete()
        .eq("id", batch.id);

      return NextResponse.json(
        {
          error:
            "Thời gian bắt đầu không hợp lệ",
        },
        { status: 400 },
      );
    }

    const safeContents = contents.map((content) =>
      replacePrivateAddressInContent(
        content,
        String(listing.address || ""),
        String(listing.description || ""),
      ),
    );

    const isLive = String(account.posting_mode || "scheduled") === "live";
    const schedule = buildSchedule(
      startAt,
      selectedGroups.length,
      isLive ? 0 : Number(account.interval_min_minutes || 3),
      isLive ? 0 : Number(account.interval_max_minutes || 10),
    );

    const jobs = selectedGroups.map(
      (group, index) => {
        const contentIndex = index % safeContents.length;

        return {
          batch_id: batch.id,
          listing_id: listingId,
          facebook_account_id:
            facebookAccountId,
          facebook_group_id: group.id,
          content_version:
            contentIndex + 1,
          content: safeContents[contentIndex],
          scheduled_at:
            schedule[index].toISOString(),
          status: "pending",
        };
      },
    );

    const { error: insertError } =
      await db
        .from("social_post_jobs")
        .insert(jobs);

    if (insertError) {
      await db
        .from("social_post_batches")
        .delete()
        .eq("id", batch.id);

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      listingId,
      facebookAccountId,
      district,
      groupCount: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error(
      "SOCIAL_ENQUEUE_ROUTE_ERROR =",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo hàng chờ Facebook",
      },
      { status: 500 },
    );
  }
}

