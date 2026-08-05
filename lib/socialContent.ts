export type SocialListingInput = {
  title?: string | null;
  district?: string | null;
  address?: string | null;
  description?: string | null;
  contact_phone_override?: string | null;
};

const PHONE_REGEX = /(?:\+?84|0)(?:[ .-]?\d){9,10}/g;
const CONTACT_LINE_REGEX = /^.*(?:liên hệ|lien he|hotline|zalo|sđt|sdt|điện thoại|dien thoai).*$/gimu;
const HASHTAG_LINE_REGEX = /^\s*(?:#[\p{L}\p{N}_]+\s*)+$/gimu;

export function normalizeVietnamPhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(normalized) ? normalized : null;
}

export function formatVietnamPhone(value: string): string {
  const phone = normalizeVietnamPhone(value) ?? value;
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
}

export function slugVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function districtSlug(district: string | null | undefined): string {
  const raw = slugVietnamese(String(district ?? ""));
  if (!raw) return "tphcm";
  if (/^(q|quan)\d+$/.test(raw)) return `quan${raw.replace(/\D/g, "")}`;
  return raw.replace(/^quan/, "quan");
}

function detectTypeHashtags(listing: SocialListingInput): string[] {
  const source = slugVietnamese(
    [listing.title, listing.address, listing.description].filter(Boolean).join(" "),
  );
  const tags = new Set<string>();
  if (source.includes("mattien") || source.includes("showroom")) tags.add("matbang");
  if (source.includes("vanphong")) tags.add("vanphong");
  if (source.includes("spa")) tags.add("spa");
  if (source.includes("cafe") || source.includes("caphe")) tags.add("cafe");
  if (source.includes("nhahang") || source.includes("quanan")) tags.add("quanan");
  return [...tags];
}

export function buildDistrictHashtags(listing: SocialListingInput): string[] {
  const d = districtSlug(listing.district);
  const tags = new Set<string>([
    "#nhachothue",
    "#nhachothuenguyencan",
    `#chothuenha${d}`,
    `#nha${d}`,
  ]);
  for (const type of detectTypeHashtags(listing)) tags.add(`#${type}${d}`);
  return [...tags].slice(0, 7);
}

export function stripContactAndHashtags(content: string): string {
  return String(content ?? "")
    .replace(CONTACT_LINE_REGEX, "")
    .replace(HASHTAG_LINE_REGEX, "")
    .replace(PHONE_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const ADMIN_DEFAULT_CONTACT_PHONE =
  normalizeVietnamPhone(process.env.ADMIN_DEFAULT_CONTACT_PHONE) ?? "0946497253";

export function resolveContactPhone(input: {
  listingOverride?: unknown;
  brokerDefault?: unknown;
  listingPhone?: unknown;
  adminDefault?: unknown;
  requireBrokerPhone?: boolean;
}): string {
  const override = normalizeVietnamPhone(input.listingOverride);
  if (override) return override;

  const brokerDefault = normalizeVietnamPhone(input.brokerDefault);
  if (brokerDefault) return brokerDefault;

  // Tin thuộc tài khoản môi giới: tuyệt đối không lấy SĐT chủ nhà/tin thô.
  if (input.requireBrokerPhone) throw new Error("BROKER_PHONE_REQUIRED");

  // Tài khoản Admin cũ vẫn hoạt động như trước, không bắt cấu hình hồ sơ môi giới.
  const listingPhone = normalizeVietnamPhone(input.listingPhone);
  if (listingPhone) return listingPhone;

  const adminDefault =
    normalizeVietnamPhone(input.adminDefault) ?? ADMIN_DEFAULT_CONTACT_PHONE;
  if (adminDefault) return adminDefault;

  throw new Error("CONTACT_PHONE_REQUIRED");
}

export function finalizeFacebookContent(input: {
  baseContent: string;
  listing: SocialListingInput;
  contactPhone: string;
}): { content: string; hashtags: string[] } {
  const cleaned = stripContactAndHashtags(input.baseContent);
  const hashtags = buildDistrictHashtags(input.listing);
  return {
    content: [
      cleaned,
      `☎️ Liên hệ: ${formatVietnamPhone(input.contactPhone)}`,
      hashtags.join(" "),
    ].filter(Boolean).join("\n\n"),
    hashtags,
  };
}
