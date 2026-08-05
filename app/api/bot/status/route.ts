import { NextResponse } from "next/server";
import {
  getAccountCounts,
  getDb,
  getLicenseId,
  listOwnedFacebookAccounts,
  requireBotAuth,
  serializeAccount,
  unauthorizedResponse,
} from "@/lib/bot/readModel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireBotAuth(request);
    if (!auth) return unauthorizedResponse();

    const db = getDb();
    const accounts = await listOwnedFacebookAccounts(auth);

    const [accountResults, deviceResult] = await Promise.all([
      Promise.all(
        accounts.map(async (account) =>
          serializeAccount(account, await getAccountCounts(account.id)),
        ),
      ),
      db
        .from("bot_devices")
        .select(
          [
            "id",
            "device_uid",
            "device_name",
            "platform",
            "app_version",
            "is_active",
            "last_seen_at",
            "current_status",
            "status_message",
            "current_job_id",
            "current_step",
            "progress_percent",
            "current_group_count",
            "total_group_count",
            "last_error",
            "activity_updated_at",
          ].join(","),
        )
        .eq("id", auth.device.id)
        .eq("license_id", getLicenseId(auth))
        .maybeSingle(),
    ]);

    if (deviceResult.error) {
      throw new Error(deviceResult.error.message);
    }

    const totals = accountResults.reduce(
      (sum, account) => ({
        groups: sum.groups + Number(account.counts?.groups ?? 0),
        queue: sum.queue + Number(account.counts?.queue ?? 0),
        processing:
          sum.processing + Number(account.counts?.processing ?? 0),
        posted: sum.posted + Number(account.counts?.posted ?? 0),
        failed: sum.failed + Number(account.counts?.failed ?? 0),
        scheduled:
          sum.scheduled + Number(account.counts?.scheduled ?? 0),
      }),
      {
        groups: 0,
        queue: 0,
        processing: 0,
        posted: 0,
        failed: 0,
        scheduled: 0,
      },
    );

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      license: {
        id: auth.license.id,
        maxFacebookAccounts:
          auth.license.max_facebook_accounts,
      },
      device: deviceResult.data ?? null,
      accounts: accountResults,
      totals,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được trạng thái Bot MG",
      },
      { status: 500 },
    );
  }
}
