import { NextResponse } from "next/server";
import {
  getAccountCounts,
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

    const accounts = await listOwnedFacebookAccounts(auth);
    const result = await Promise.all(
      accounts.map(async (account) =>
        serializeAccount(account, await getAccountCounts(account.id)),
      ),
    );

    return NextResponse.json({
      success: true,
      accounts: result,
      total: result.length,
      maxFacebookAccounts: Number(
        auth.license.max_facebook_accounts ?? 1,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không đọc được tài khoản Facebook",
      },
      { status: 500 },
    );
  }
}
