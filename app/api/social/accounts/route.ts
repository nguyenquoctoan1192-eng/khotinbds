import { NextResponse } from "next/server";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export const dynamic = "force-dynamic";

function cleanFacebookProfileUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();

  if (!url) return null;

  if (
    !/^https:\/\/(?:www\.)?facebook\.com\/(?!groups\/)[^\s]+$/i.test(
      url,
    )
  ) {
    throw new Error(
      "Link nick phải có dạng https://www.facebook.com/ten-tai-khoan",
    );
  }

  return url.replace(/\/+$/, "");
}

function normalizeIntervals(
  minValue: unknown,
  maxValue: unknown,
): {
  intervalMinMinutes: number;
  intervalMaxMinutes: number;
} {
  const min = Math.min(
    6,
    Math.max(1, Number(minValue) || 1),
  );

  const max = Math.min(
    6,
    Math.max(min, Number(maxValue) || 6),
  );

  return {
    intervalMinMinutes: min,
    intervalMaxMinutes: max,
  };
}

export async function GET() {
  const { data, error } = await getSocialAdminClient()
    .from("facebook_accounts")
    .select(`
      id,
      name,
      profile_url,
      is_active,
      posting_mode,
      start_time,
      end_time,
      interval_min_minutes,
      interval_max_minutes,
      max_posts_per_day,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: true });

  return error
    ? NextResponse.json(
        { error: error.message },
        { status: 500 },
      )
    : NextResponse.json({ accounts: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const profileUrl = cleanFacebookProfileUrl(
      body?.profileUrl ?? body?.profile_url,
    );

    if (!name) {
      return NextResponse.json(
        { error: "Thiếu tên nick" },
        { status: 400 },
      );
    }

    if (!profileUrl) {
      return NextResponse.json(
        { error: "Thiếu link Facebook của nick đã đăng nhập" },
        { status: 400 },
      );
    }

    const intervals = normalizeIntervals(
      body?.intervalMinMinutes,
      body?.intervalMaxMinutes,
    );

    const postingMode =
      body?.postingMode === "scheduled"
        ? "scheduled"
        : "live";

    const { data, error } =
      await getSocialAdminClient()
        .from("facebook_accounts")
        .insert({
          name,
          profile_url: profileUrl,
          is_active: true,
          posting_mode: postingMode,
          start_time: body?.startTime || "00:00",
          end_time: body?.endTime || "23:59",
          interval_min_minutes:
            intervals.intervalMinMinutes,
          interval_max_minutes:
            intervals.intervalMaxMinutes,
          max_posts_per_day: Math.max(
            1,
            Number(body?.maxPostsPerDay) || 100,
          ),
        })
        .select()
        .single();

    return error
      ? NextResponse.json(
          { error: error.message },
          { status: 500 },
        )
      : NextResponse.json({ account: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thêm được nick Facebook",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Thiếu id nick Facebook" },
        { status: 400 },
      );
    }

    const name = String(body?.name ?? "").trim();
    const profileUrl = cleanFacebookProfileUrl(
      body?.profileUrl ?? body?.profile_url,
    );

    if (!name || !profileUrl) {
      return NextResponse.json(
        { error: "Thiếu tên hoặc link Facebook" },
        { status: 400 },
      );
    }

    const intervals = normalizeIntervals(
      body?.intervalMinMinutes,
      body?.intervalMaxMinutes,
    );

    const payload = {
      name,
      profile_url: profileUrl,
      is_active: body?.isActive !== false,
      posting_mode:
        body?.postingMode === "scheduled"
          ? "scheduled"
          : "live",
      start_time: body?.startTime || "00:00",
      end_time: body?.endTime || "23:59",
      interval_min_minutes:
        intervals.intervalMinMinutes,
      interval_max_minutes:
        intervals.intervalMaxMinutes,
      max_posts_per_day: Math.max(
        1,
        Number(body?.maxPostsPerDay) || 100,
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } =
      await getSocialAdminClient()
        .from("facebook_accounts")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    return error
      ? NextResponse.json(
          { error: error.message },
          { status: 500 },
        )
      : NextResponse.json({ account: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không lưu được nick Facebook",
      },
      { status: 400 },
    );
  }
}
