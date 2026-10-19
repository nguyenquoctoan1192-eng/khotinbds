
import { NextResponse } from "next/server";
import {
  addRandomMinutes,
  selectCrosspostGroups,
  type GroupCandidate,
} from "@/lib/socialPosting";
import { getSocialAdminClient } from "@/lib/socialSupabase";
import {
  buildDistrictHashtags,
  finalizeFacebookContent,
  resolveContactPhone,
} from "@/lib/socialContent";

export const dynamic = "force-dynamic";

type ListingRow = {
  id: string;
  title: string | null;
  district: string | null;
  address: string | null;
  price: number | null;
  area: number | null;
  width: number | null;
  length: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  contact_phone: string | null;
  contact_phone_override: string | null;
  images: string[] | null;
  status: string | null;
  created_at: string;
};

type FacebookAccountRow = {
  id: string;
  license_id: string | null;
  broker_profile_id: string | null;
  is_active: boolean | null;
};

type BrokerProfileRow = {
  id: string;
  agent_user_id: string | null;
  default_contact_phone: string | null;
  is_active: boolean | null;
};

type ExistingBatchRow = {
  listing_id: string;
};

type FacebookGroupDbRow = {
  id: string;
  name: string | null;
  districts: unknown;
  category: string | null;
  priority: number | string | null;
  facebook_account_id: string | null;
};

function formatPrice(price: number | null): string {
  if (
    price === null ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return "Liên hệ";
  }

  return `${price.toLocaleString("vi-VN")} đồng/tháng`;
}

function detectCategories(
  listing: ListingRow,
): string[] {
  const source = [
    listing.title,
    listing.address,
    listing.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const categories = new Set<string>([
    "whole-house",
    "general",
  ]);

  if (
    source.includes("mặt tiền") ||
    source.includes("mat tien") ||
    /\bmt\b/.test(source)
  ) {
    categories.add("frontage");
    categories.add("business");
  }

  if (
    source.includes("văn phòng") ||
    source.includes("van phong")
  ) {
    categories.add("office");
  }

  if (
    source.includes("phòng trọ") ||
    source.includes("phong tro")
  ) {
    categories.add("room");
  }

  if (
    /kinh doanh|showroom|spa|nhà hàng|nha hang|cafe/.test(
      source,
    )
  ) {
    categories.add("business");
  }

  return [...categories];
}

function buildBaseContents(
  listing: ListingRow,
): string[] {
  const dimensions =
    listing.width && listing.length
      ? `${listing.width}x${listing.length}m`
      : listing.area
        ? `${listing.area}m²`
        : "";

  const structure = [
    listing.floors
      ? `${listing.floors} tầng`
      : "",
    listing.bedrooms
      ? `${listing.bedrooms} phòng ngủ`
      : "",
    listing.bathrooms
      ? `${listing.bathrooms} WC`
      : "",
  ].filter(Boolean);

  const description =
    listing.description?.trim() ||
    "Phù hợp thuê ở, làm văn phòng hoặc kinh doanh tùy nhu cầu.";

  return [
    [
      `🔥 ${listing.title || "CHO THUÊ BẤT ĐỘNG SẢN"}`,
      listing.district
        ? `📍 ${listing.district}`
        : "",
      dimensions
        ? `📐 Diện tích: ${dimensions}`
        : "",
      structure.length
        ? `🏢 ${structure.join(" – ")}`
        : "",
      `💰 Giá thuê: ${formatPrice(listing.price)}`,
      "",
      description,
    ],
    [
      `🏠 CHO THUÊ ${(
        listing.title ||
        listing.district ||
        "BẤT ĐỘNG SẢN"
      ).toUpperCase()}`,
      listing.district
        ? `Khu vực: ${listing.district}`
        : "",
      dimensions
        ? `Diện tích: ${dimensions}`
        : "",
      structure.length
        ? `Công năng: ${structure.join(", ")}`
        : "",
      `Giá: ${formatPrice(listing.price)}`,
      "",
      description,
    ],
  ].map((parts) =>
    parts.filter(Boolean).join("\n").trim(),
  );
}

function normalizeDistrictArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (district): district is string =>
        typeof district === "string",
    )
    .map((district) => district.trim())
    .filter(Boolean);
}

function toGroupCandidate(
  group: FacebookGroupDbRow,
): GroupCandidate {
  const priorityValue = Number(group.priority);

  return {
    id: String(group.id),
    name: String(group.name ?? "").trim(),
    districts: normalizeDistrictArray(
      group.districts,
    ),
    category: String(
      group.category ?? "general",
    ).trim(),
    priority: Number.isFinite(priorityValue)
      ? priorityValue
      : 100,
  };
}

async function getAccount(
  db: ReturnType<typeof getSocialAdminClient>,
  requestedAccountId?: string | null,
): Promise<FacebookAccountRow | null> {
  let query = db
    .from("facebook_accounts")
    .select(
      "id,license_id,broker_profile_id,is_active",
    );

  if (requestedAccountId) {
    query = query.eq("id", requestedAccountId);
  } else {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data as FacebookAccountRow | null) ?? null
  );
}

async function getBrokerProfile(
  db: ReturnType<typeof getSocialAdminClient>,
  account: FacebookAccountRow,
): Promise<BrokerProfileRow | null> {
  if (account.broker_profile_id) {
    const { data, error } = await db
      .from("bot_broker_profiles")
      .select(
        "id,agent_user_id,default_contact_phone,is_active",
      )
      .eq("id", account.broker_profile_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (
      (data as BrokerProfileRow | null) ?? null
    );
  }

  if (account.license_id) {
    const { data, error } = await db
      .from("bot_broker_profiles")
      .select(
        "id,agent_user_id,default_contact_phone,is_active",
      )
      .eq("license_id", account.license_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (
      (data as BrokerProfileRow | null) ?? null
    );
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const db = getSocialAdminClient();

    const body = await request
      .json()
      .catch(() => ({}));

    /*
     * NGUYÊN TẮC:
     * Chỉ xử lý các listingId được giao diện gửi lên.
     * Không tự quét toàn bộ tin đăng trong ngày.
     * Không có danh sách chọn thì không tạo hàng chờ.
     */
    
const requestedListingIds: string[] = Array.isArray(body?.listingIds)
  ? [
      ...new Set<string>(
        (body.listingIds as unknown[])
          .filter((id): id is string | number => typeof id === "string" || typeof id === "number")
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0),
      ),
    ]
  : [];


    if (requestedListingIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bạn chưa chọn tin nào. Hãy chọn tin cần đưa vào hàng chờ.",
          found: 0,
          queuedListings: 0,
          skippedListings: 0,
          createdJobs: 0,
          results: [],
        },
        { status: 400 },
      );
    }

    const requestedAccountId = String(
      body?.facebookAccountId ||
        body?.accountId ||
        "",
    ).trim();

    const account = await getAccount(
      db,
      requestedAccountId || null,
    );

    if (!account || account.is_active !== true) {
      return NextResponse.json(
        {
          error:
            "Chưa có tài khoản Facebook đang hoạt động",
        },
        { status: 409 },
      );
    }

    const profile = await getBrokerProfile(
      db,
      account,
    );

    const isBrokerAccount = Boolean(
      profile?.agent_user_id,
    );

    const brokerDefaultPhone =
      profile?.is_active === true
        ? profile.default_contact_phone
        : null;

    /*
     * CHỈ TRUY VẤN CÁC TIN ĐƯỢC CHỌN.
     * Không lọc theo ngày tạo.
     * Không tự bổ sung tin khác.
     */
    const { data: listingsData, error: listingsError } =
      await db
        .from("listings")
        .select(
          [
            "id",
            "title",
            "district",
            "address",
            "price",
            "area",
            "width",
            "length",
            "floors",
            "bedrooms",
            "bathrooms",
            "description",
            "contact_phone",
            "contact_phone_override",
            "images",
            "status",
            "created_at",
          ].join(","),
        )
        .in("id", requestedListingIds);

    if (listingsError) {
      return NextResponse.json(
        { error: listingsError.message },
        { status: 500 },
      );
    }

    const selectedListings =
      (listingsData ?? []) as unknown as ListingRow[];

    /*
     * Giữ nguyên điều kiện trạng thái:
     * chỉ xử lý tin chưa có trạng thái hoặc đang available.
     */
    const availableListings = selectedListings.filter(
      (listing) =>
        !listing.status ||
        listing.status === "available",
    );

    const availableIds = new Set(
      availableListings.map((listing) =>
        String(listing.id),
      ),
    );

    const results: Record<string, unknown>[] = [];

    /*
     * Báo rõ những ID được chọn nhưng không tìm thấy
     * hoặc không còn đủ điều kiện đăng.
     */
    for (const listingId of requestedListingIds) {
      if (!availableIds.has(listingId)) {
        const foundListing = selectedListings.find(
          (listing) =>
            String(listing.id) === listingId,
        );

        results.push({
          listingId,
          status: "skipped",
          reason: foundListing
            ? `Tin không ở trạng thái được phép đăng: ${
                foundListing.status || "không xác định"
              }`
            : "Không tìm thấy tin đã chọn",
        });
      }
    }

    const listingIds = availableListings.map(
      (listing) => listing.id,
    );

    let existingBatches: ExistingBatchRow[] = [];

    if (listingIds.length > 0) {
      const { data, error } = await db
        .from("social_post_batches")
        .select("listing_id")
        .eq(
          "facebook_account_id",
          account.id,
        )
        .in("listing_id", listingIds);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 },
        );
      }

      existingBatches =
        (data ?? []) as unknown as ExistingBatchRow[];
    }

    const queuedListingIds = new Set(
      existingBatches.map((item) =>
        String(item.listing_id),
      ),
    );

    const { data: groupsData, error: groupsError } =
      await db
        .from("facebook_groups")
        .select(
          "id,name,districts,category,priority,facebook_account_id",
        )
        .eq("is_active", true)
        .eq("facebook_account_id", account.id);

    if (groupsError) {
      return NextResponse.json(
        { error: groupsError.message },
        { status: 500 },
      );
    }

    const activeGroups: GroupCandidate[] = (
      (groupsData ?? []) as unknown as FacebookGroupDbRow[]
    )
      .map(toGroupCandidate)
      .filter(
        (group) =>
          Boolean(group.id) &&
          Boolean(group.name),
      );

    let createdJobs = 0;
    let queuedListings = 0;
    let skippedListings = 0;
    let nextStartAt = new Date();

    for (const listing of availableListings) {
      if (queuedListingIds.has(listing.id)) {
        skippedListings++;

        results.push({
          listingId: listing.id,
          status: "skipped",
          reason: "Đã có lịch Facebook",
        });

        continue;
      }

      const district =
        listing.district?.trim() ?? "";

      if (!district) {
        skippedListings++;

        results.push({
          listingId: listing.id,
          status: "skipped",
          reason: "Tin chưa có quận",
        });

        continue;
      }

      let contactPhone: string;

      try {
        contactPhone = resolveContactPhone({
          listingOverride:
            listing.contact_phone_override,
          brokerDefault: brokerDefaultPhone,
          listingPhone: listing.contact_phone,
          requireBrokerPhone: isBrokerAccount,
        });
      } catch {
        skippedListings++;

        results.push({
          listingId: listing.id,
          status: "blocked",
          reason: isBrokerAccount
            ? "Môi giới chưa cài SĐT liên hệ mặc định"
            : "Tin chưa có SĐT liên hệ",
        });

        continue;
      }

      const selectedGroups =
        selectCrosspostGroups(
          activeGroups,
          district,
          detectCategories(listing),
        );

      if (selectedGroups.length === 0) {
        skippedListings++;

        results.push({
          listingId: listing.id,
          status: "skipped",
          reason: "Không có nhóm phù hợp",
        });

        continue;
      }

      const {
        data: batch,
        error: batchError,
      } = await db
        .from("social_post_batches")
        .insert({
          listing_id: listing.id,
          facebook_account_id: account.id,
          broker_profile_id:
            profile?.id ?? null,
          contact_phone_snapshot:
            contactPhone,
        })
        .select("id")
        .single();

      if (batchError || !batch) {
        results.push({
          listingId: listing.id,
          status: "error",
          reason:
            batchError?.message ||
            "Không tạo được batch",
        });

        continue;
      }

      const baseContents =
        buildBaseContents(listing);

      /*
       * Một listing là một lần đăng chéo lên các nhóm phù hợp.
       * Job con trong cùng batch dùng chung scheduled_at.
       */
      const listingScheduledAt =
        new Date(nextStartAt);

      const jobs = selectedGroups.map(
        (group, index) => {
          const finalized =
            finalizeFacebookContent({
              baseContent:
                baseContents[
                  index % baseContents.length
                ],
              listing,
              contactPhone,
            });

          return {
            batch_id: batch.id,
            listing_id: listing.id,
            facebook_account_id: account.id,
            facebook_group_id: group.id,
            content_version:
              (index % baseContents.length) + 1,
            content: finalized.content,
            contact_phone_snapshot:
              contactPhone,
            hashtags_snapshot:
              finalized.hashtags,
            scheduled_at:
              listingScheduledAt.toISOString(),
            status: "pending",
          };
        },
      );

      const { error: insertJobsError } =
        await db
          .from("social_post_jobs")
          .insert(jobs);

      if (insertJobsError) {
        await db
          .from("social_post_batches")
          .delete()
          .eq("id", batch.id);

        results.push({
          listingId: listing.id,
          status: "error",
          reason: insertJobsError.message,
        });

        continue;
      }

      queuedListings++;
      createdJobs += jobs.length;

      /*
       * Chỉ giãn lịch giữa các listing khác nhau.
       */
      nextStartAt = addRandomMinutes(
        listingScheduledAt,
        5,
        15,
      );

      results.push({
        listingId: listing.id,
        status: "queued",
        groupCount: jobs.length,
        contactPhone,
        hashtags:
          buildDistrictHashtags(listing),
      });
    }

    skippedListings += results.filter(
      (result) =>
        result.status === "skipped" ||
        result.status === "blocked",
    ).length - results.filter(
      (result) =>
        result.reason === "Đã có lịch Facebook" ||
        result.reason === "Tin chưa có quận" ||
        result.reason === "Không có nhóm phù hợp" ||
        result.reason ===
          "Tin chưa có SĐT liên hệ" ||
        result.reason ===
          "Môi giới chưa cài SĐT liên hệ mặc định",
    ).length;

    return NextResponse.json({
      success: true,
      facebookAccountId: account.id,
      found: availableListings.length,
      selected: requestedListingIds.length,
      queuedListings,
      skippedListings,
      createdJobs,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đồng bộ được tin Facebook",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Endpoint này chỉ nhận POST kèm danh sách listingIds đã chọn.",
    },
    { status: 405 },
  );
}
