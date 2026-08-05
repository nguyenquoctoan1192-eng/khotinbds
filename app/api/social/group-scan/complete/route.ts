import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

const GROUP_SCAN_COMPLETE_VERSION = "verified-v7";

type ScannedGroup = {
  name?: unknown;
  url?: unknown;
};

type ExistingGroup = {
  id: string;
  url: string | null;
  name: string | null;
};

function normalizeGroupName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGroupUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, "https://www.facebook.com");
    const match = url.pathname.match(/^\/groups\/([^/?#]+)\/?$/i);

    if (!match) return "";

    const slug = match[1].trim();
    const excluded = new Set([
      "feed",
      "discover",
      "joins",
      "create",
      "notifications",
    ]);

    if (!slug || excluded.has(slug.toLowerCase())) return "";

    return `https://www.facebook.com/groups/${slug}`;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const db = getSocialAdminClient();
  let requestId = "";

  try {
    const body = await request.json().catch(() => ({}));

    requestId = String(body?.requestId || "").trim();
    const accountId = String(
      body?.accountId ||
        body?.facebookAccountId ||
        body?.facebook_account_id ||
        "",
    ).trim();

    const groups = Array.isArray(body?.groups)
      ? (body.groups as ScannedGroup[])
      : [];

    console.log(
      `[GROUP-SCAN COMPLETE ${GROUP_SCAN_COMPLETE_VERSION}] request=${requestId} | account=${accountId} | nhận=${groups.length}`,
    );

    if (!requestId || !accountId) {
      return NextResponse.json(
        { error: "Thiếu requestId hoặc accountId" },
        { status: 400 },
      );
    }

    const { data: scanRequest, error: requestError } = await db
      .from("facebook_group_scan_requests")
      .select("id,facebook_account_id,status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);

    if (!scanRequest) {
      return NextResponse.json(
        { error: "Không tìm thấy yêu cầu quét nhóm" },
        { status: 404 },
      );
    }

    if (String(scanRequest.facebook_account_id) !== accountId) {
      return NextResponse.json(
        { error: "Yêu cầu quét không thuộc tài khoản Facebook này" },
        { status: 403 },
      );
    }

    if (scanRequest.status !== "processing") {
      return NextResponse.json(
        {
          error: `Yêu cầu quét đang ở trạng thái ${scanRequest.status}`,
        },
        { status: 409 },
      );
    }

    const invalidNames = new Set([
      "xem nhóm",
      "mở nhóm",
      "open group",
      "view group",
    ]);

    const unique = new Map<string, { name: string; url: string }>();

    for (const item of groups) {
      const name = String(item?.name ?? "")
        .replace(/\s+/g, " ")
        .trim();

      const url = normalizeGroupUrl(item?.url);
      const normalizedName = name.toLowerCase();

      if (
        !name ||
        name.length < 3 ||
        name.length > 180 ||
        invalidNames.has(normalizedName) ||
        !url
      ) {
        continue;
      }

      unique.set(url.toLowerCase(), { name, url });
    }

    console.log(
      `[GROUP-SCAN COMPLETE] hợp lệ=${unique.size} | loại=${groups.length - unique.size}`,
    );

    if (!unique.size) {
      throw new Error(
        `Worker gửi ${groups.length} nhóm nhưng không có nhóm hợp lệ để lưu`,
      );
    }

    const { data: existingRows, error: existingError } = await db
      .from("facebook_groups")
      .select("id,url,name")
      .limit(10000);

    if (existingError) throw new Error(existingError.message);

    const existingByUrl = new Map<string, ExistingGroup>();
    const existingByName = new Map<string, ExistingGroup>();

    for (const row of (existingRows ?? []) as ExistingGroup[]) {
      const normalizedUrl = normalizeGroupUrl(row.url);
      const normalizedName = normalizeGroupName(row.name);

      if (normalizedUrl) {
        existingByUrl.set(normalizedUrl.toLowerCase(), row);
      }

      /*
       * Dữ liệu cũ có thể dùng link share/g nên không chuẩn hóa được về
       * /groups/{slug}. Khi đó dùng đúng tên nhóm đã chuẩn hóa để nhận diện,
       * nhưng vẫn chỉ cập nhật name + url, không đụng cấu hình Admin.
       */
      if (normalizedName && !existingByName.has(normalizedName)) {
        existingByName.set(normalizedName, row);
      }
    }

    let addedCount = 0;
    let existingCount = 0;
    let failedCount = 0;

    const failures: Array<{
      name: string;
      url: string;
      error: string;
    }> = [];

    for (const group of unique.values()) {
      const key = group.url.toLowerCase();
      const nameKey = normalizeGroupName(group.name);
      const existing =
        existingByUrl.get(key) ||
        existingByName.get(nameKey);

      if (existing?.id) {
        const { error: updateError } = await db
          .from("facebook_groups")
          .update({
            name: group.name,
            url: group.url,
          })
          .eq("id", existing.id);

        if (updateError) {
          failedCount += 1;
          failures.push({
            ...group,
            error: updateError.message,
          });
          continue;
        }

        existingCount += 1;
        continue;
      }

      const payload = {
        name: group.name,
        url: group.url,
        district: null,
        category: "general",
        priority: 100,
        is_active: true,
      };

      let insertResult = await db
        .from("facebook_groups")
        .insert({
          ...payload,
          facebook_account_id: accountId,
        });

      if (
        insertResult.error &&
        /facebook_account_id/i.test(insertResult.error.message)
      ) {
        insertResult = await db
          .from("facebook_groups")
          .insert(payload);
      }

      if (insertResult.error) {
        const duplicate =
          insertResult.error.code === "23505" ||
          /duplicate|unique/i.test(insertResult.error.message);

        if (duplicate) {
          const { data: duplicateRows, error: duplicateLookupError } =
            await db
              .from("facebook_groups")
              .select("id,url,name")
              .or(
                `url.eq.${group.url},name.eq.${group.name}`,
              )
              .limit(5);

          if (!duplicateLookupError && duplicateRows?.[0]?.id) {
            const { error: duplicateUpdateError } = await db
              .from("facebook_groups")
              .update({
                name: group.name,
                url: group.url,
              })
              .eq("id", duplicateRows[0].id);

            if (!duplicateUpdateError) {
              existingCount += 1;
              continue;
            }
          }

          failedCount += 1;
          failures.push({
            ...group,
            error:
              duplicateLookupError?.message ||
              "Nhóm bị trùng nhưng không cập nhật được tên/link",
          });
          continue;
        }

        failedCount += 1;
        failures.push({
          ...group,
          error: insertResult.error.message,
        });
        continue;
      }

      addedCount += 1;
    }

    const savedCount = addedCount + existingCount;

    console.log(
      `[GROUP-SCAN COMPLETE] thêm=${addedCount} | có sẵn=${existingCount} | lỗi=${failedCount}`,
    );

    if (failures.length) {
      console.warn(
        "[GROUP-SCAN COMPLETE] lỗi mẫu:",
        JSON.stringify(failures.slice(0, 10)),
      );
    }

    if (savedCount === 0) {
      throw new Error(
        `Không lưu được nhóm nào. Lỗi đầu tiên: ${
          failures[0]?.error || "không xác định"
        }`,
      );
    }

    const { error: finishError } = await db
      .from("facebook_group_scan_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        found_count: unique.size,
        saved_count: savedCount,
        last_error:
          failedCount > 0
            ? `${failedCount} nhóm không lưu được`
            : null,
      })
      .eq("id", requestId)
      .eq("status", "processing");

    if (finishError) throw new Error(finishError.message);

    return NextResponse.json({
      success: true,
      version: GROUP_SCAN_COMPLETE_VERSION,
      foundCount: unique.size,
      savedCount,
      addedCount,
      existingCount,
      failedCount,
      failures: failures.slice(0, 20),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không lưu được nhóm đã quét";

    if (requestId) {
      await db
        .from("facebook_group_scan_requests")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          last_error: message,
        })
        .eq("id", requestId)
        .eq("status", "processing");
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
