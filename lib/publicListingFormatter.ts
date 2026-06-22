export const PUBLIC_CONTACT_PHONE = "0946497253";

export type PublicListing = {
  publicTitle: string;
  area: string;
  structure: string;
  price: string;
  contactPhone: string;
};

type ListingLike = Record<string, unknown>;

const PREFIX_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:HXH|HẺM\s+XE\s+HƠI)\b/iu, "Hẻm Xe Hơi"],
  [/\b(?:HXM|HẺM\s+XE\s+MÁY)\b/iu, "Hẻm Xe Máy"],
  [/\b(?:HXT|HẺM\s+XE\s+TẢI)\b/iu, "Hẻm Xe Tải"],
  [/\b(?:H3G|HẺM\s+BA\s+GÁC)\b/iu, "Hẻm Ba Gác"],
  [/\b(?:2MT|HAI\s+MẶT\s+TIỀN)\b/iu, "Hai Mặt Tiền"],
  [/\b(?:MB|MẶT\s+BẰNG)\b/iu, "Mặt Bằng"],
  [/\b(?:MT|MẶT\s+TIỀN)\b/iu, "Mặt Tiền"],
];

const PREFIX_AT_START =
  /^\s*(?:HXH|HXM|HXT|H3G|2MT|MB|MT|Hẻm\s+Xe\s+Hơi|Hẻm\s+Xe\s+Máy|Hẻm\s+Xe\s+Tải|Hẻm\s+Ba\s+Gác|Hai\s+Mặt\s+Tiền|Mặt\s+Bằng|Mặt\s+Tiền)\s*[-:–—]?\s*/iu;

const HOUSE_NUMBER_AT_START =
  /^\s*\d+[A-Za-z]?(?:(?:\s*[-–]\s*\d+[A-Za-z]?)|(?:\/[A-Za-z0-9]+)+)?\s+/u;

const SIZE_PATTERN = /\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\b/iu;
const PRICE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|triệu|tỷ|ty|k|nghìn|ngàn)(?!\p{L})(?:\s*\/\s*tháng)?/iu;
const PHONE_PATTERN = /(?:\+?84|0)(?:[\s.()-]*\d){8,10}\b/gu;
const INTERNAL_BOUNDARY_PATTERN =
  /\b(?:hh(?:tt|\s*báo\s*sau|\d+\s*(?:n\s*\d*t|tr)?|1\s*\/\s*2)?|lh|sđt|sdt|nđ|nd)\b\s*:?.*$/iu;

const asText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const firstContentLine = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";

const detectExplicitPrefix = (rawText: string) => {
  for (const [pattern, label] of PREFIX_PATTERNS) {
    if (pattern.test(rawText)) return label;
  }

  return "";
};

export function detectListingPrefix(rawText: string): string {
  const text = asText(rawText);
  const explicitPrefix = detectExplicitPrefix(text);

  if (explicitPrefix) return explicitPrefix;
  return firstContentLine(text).includes("/") ? "Hẻm" : "Mặt Tiền";
}

const sanitizeAddressWithContext = (rawAddressOrTitle: string, context: string) => {
  const addressLine = firstContentLine(rawAddressOrTitle);
  const prefix =
    detectExplicitPrefix(context) ||
    (addressLine.includes("/") ? "Hẻm" : "Mặt Tiền");

  const safeAddress = addressLine
    .replace(PREFIX_AT_START, "")
    .replace(HOUSE_NUMBER_AT_START, "")
    .replace(PHONE_PATTERN, "")
    .replace(INTERNAL_BOUNDARY_PATTERN, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:\s]+$/u, "")
    .trim();

  return [prefix, safeAddress].filter(Boolean).join(" ").trim();
};

export function sanitizePublicAddress(rawAddressOrTitle: string): string {
  const text = asText(rawAddressOrTitle);
  return sanitizeAddressWithContext(text, text);
}

export function extractPublicPrice(rawText: string): string {
  const match = asText(rawText).match(PRICE_PATTERN);
  return match?.[0].replace(/\s+/g, "").replace(/\/tháng/iu, "/tháng") || "";
}

export function extractPublicSize(rawText: string): string {
  const match = asText(rawText).match(SIZE_PATTERN);
  return match?.[0].replace(/\s*[xX×]\s*/u, "x").replace(/\s+/g, "") || "";
}

export function extractPublicStructure(rawText: string): string {
  const text = asText(rawText);
  const sizeMatch = SIZE_PATTERN.exec(text);

  if (!sizeMatch || sizeMatch.index === undefined) return "";

  let structure = text.slice(sizeMatch.index + sizeMatch[0].length);
  const boundaries = [
    /\bgiá\s*:/iu,
    PRICE_PATTERN,
    /\bhh/iu,
    PHONE_PATTERN,
    /\b(?:lh|sđt|sdt|nđ|nd)\s*:/iu,
  ];
  let endIndex = structure.length;

  for (const pattern of boundaries) {
    pattern.lastIndex = 0;
    const match = pattern.exec(structure);
    if (match?.index !== undefined) endIndex = Math.min(endIndex, match.index);
  }

  structure = structure
    .slice(0, endIndex)
    .replace(/^\s*(?:kết\s*cấu|kc)\s*:\s*/iu, "")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();

  return structure;
}

const formatNumericPrice = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? `${number.toLocaleString("vi-VN")} VNĐ`
    : "Liên hệ";
};

export function formatPublicListing(listing: ListingLike): PublicListing {
  const title = asText(listing.title);
  const address = asText(listing.address);
  const description = asText(listing.description);
  const rawInput = asText(listing.raw_input);
  const distinctParts = [title, address, description, rawInput].filter(
    (part, index, parts) => part && parts.indexOf(part) === index
  );
  const rawText = distinctParts.join("\n");
  const addressSource = title || address;
  const extractedArea = extractPublicSize(rawText);
  const structuredArea = asText(listing.area);
  const dimensions =
    asText(listing.width) && asText(listing.length)
      ? `${asText(listing.width)}x${asText(listing.length)}`
      : "";
  const extractedStructure = extractPublicStructure(rawText);
  const structuredStructure = asText(listing.structure);
  const extractedPrice = extractPublicPrice(rawText);

  return {
    publicTitle: sanitizeAddressWithContext(addressSource, rawText),
    area: extractedArea || dimensions || structuredArea,
    structure: extractedStructure || structuredStructure,
    price: extractedPrice || formatNumericPrice(listing.price),
    contactPhone: PUBLIC_CONTACT_PHONE,
  };
}
