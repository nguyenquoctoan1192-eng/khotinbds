import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "id,status,requested_at,claimed_at,completed_at,found_count,saved_count,last_error";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = String(
      body?.accountId || body?.facebookAccountId || "",
    ).trim();

    if (!accountId) {
      return NextResponse.json(
        { error: "Thiếu facebookAccountId" },
        { status: 400 },
      );
    }

    const db = getSocialAdminClient();

    const { data: account, error: accountError } = await db
      .from("facebook_accounts")
      .select("id,is_active")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);

    if (!account) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản Facebook" },
        { status: 404 },
      );
    }

    if (account.is_active === false) {
      return NextResponse.json(
        { error: "Tài khoản Facebook đang tắt" },
        { status: 409 },
      );
    }

    const { data: existing, error: existingError } = await db
      .from("facebook_group_scan_requests")
      .select(SELECT_COLUMNS)
      .eq("facebook_account_id", accountId)
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      return NextResponse.json({
        request: existing,
        alreadyRunning: true,
      });
    }

    const { data, error } = await db
      .from("facebook_group_scan_requests")
      .insert({
        facebook_account_id: accountId,
        status: "pending",
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tạo được yêu cầu quét nhóm",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const accountId = new URL(request.url)
      .searchParams.get("accountId")
      ?.trim();

    if (!accountId) {
      return NextResponse.json(
        { error: "Thiếu accountId" },
        { status: 400 },
      );
    }

    const { data, error } = await getSocialAdminClient()
      .from("facebook_group_scan_requests")
      .select(SELECT_COLUMNS)
      .eq("facebook_account_id", accountId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ request: data ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được trạng thái quét nhóm",
      },
      { status: 500 },
    );
  }
}

