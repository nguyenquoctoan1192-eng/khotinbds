import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSocialAdminClient } from "@/lib/socialSupabase";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createLicenseKey(): string {
  return `KTB-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function createBotToken(): string {
  return `khotin_${randomBytes(32).toString("base64url")}`;
}

export function safeEqualHash(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticateBot(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
const botHeader = request.headers.get("x-bot-mg-token") ?? "";

let token = "";

if (auth.startsWith("Bearer ")) {
  token = auth.slice(7).trim();
} else if (botHeader.startsWith("Bearer ")) {
  token = botHeader.slice(7).trim();
} else {
  token = botHeader.trim();
}

if (!token) return null;

  const db = getSocialAdminClient();
  const { data: device } = await db
    .from("bot_devices")
    .select(
      "id,license_id,device_uid,device_name,platform,app_version,is_active,token_expires_at,bot_licenses!inner(id,is_active,expires_at,max_facebook_accounts)",
    )
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (!device?.is_active) return null;
  const license = Array.isArray(device.bot_licenses)
    ? device.bot_licenses[0]
    : device.bot_licenses;
  if (!license?.is_active) return null;
  if (device.token_expires_at && new Date(device.token_expires_at) <= new Date()) return null;
  if (license.expires_at && new Date(license.expires_at) <= new Date()) return null;

  return { device, license };
}
