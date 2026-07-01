export type ParsedZaloListing = {
  title: string;
  price: number | null;
  district: string;
  address: string;
  area: number | null;
  width: number | null;
  length: number | null;
  floors: number;
  phone: string;
  furnishing: "Trống" | "Cơ bản" | "Đầy đủ";
  description: string;
  bedrooms: number | null;
  bathrooms: number | null;
};

const namedDistricts = [
  "Thủ Đức",
  "Bình Thạnh",
  "Gò Vấp",
  "Tân Bình",
  "Tân Phú",
  "Phú Nhuận",
  "Bình Chánh",
  "Nhà Bè",
  "Củ Chi",
  "Hóc Môn",
  "Cần Giờ",
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const formatDistrict = (district: string) => `Quận ${district.trim()}`;

const trimExtraPunctuation = (value: string) =>
  value.replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();

const stripTrailingHouseTag = (value: string) =>
  value.replace(/\s+(?:hxh|hxt|h3g|mt|hxm|mb|2mt|2mb)\s*$/iu, "").trim();

const stripLeadingHouseNumber = (value: string) =>
  value.replace(
    /^\s*\d+[A-Za-zÀ-ỹ]?(?:\s*[-–]\s*\d+[A-Za-zÀ-ỹ]?)?(?:\/\d+[A-Za-zÀ-ỹ]?)*\s*,?\s*/u,
    ""
  );

const roundArea = (value: number) => Math.round(value * 10) / 10;

function parsePrice(text: string) {
  const match = text.match(
    /(?:^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(?:triệu|tr(?!\p{L}))/iu
  );

  if (!match) return null;

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 1000000) : null;
}

function parsePhone(text: string) {
  const match = text.match(/(?:^|\D)(0\d{9})(?!\d)/);
  return match ? match[1] : "";
}

function normalizeDistrict(text: string) {
  const numericMatch = text.match(/\b(?:q|quận)\.?\s*(\d{1,2})\b/iu);
  if (numericMatch) return formatDistrict(String(Number(numericMatch[1])));

  const normalized = normalizeText(text);
  const normalizedNamedDistricts = namedDistricts.map((district) => ({
    district,
    normalized: normalizeText(district),
  }));

  for (const { district, normalized: normalizedDistrict } of normalizedNamedDistricts) {
    const pattern = new RegExp(
      `(?:\\bq\\.?\\s*)?\\b${escapeRegExp(normalizedDistrict)}\\b`,
      "i"
    );
    if (pattern.test(normalized)) return formatDistrict(district);
  }

  return "";
}

function detectHouseType(addressLine: string, text: string) {
  if (/\b2mt\b/iu.test(text)) return "Hai Mặt Tiền";
  if (/\bmt\b/iu.test(text)) return "Mặt Tiền";
  if (/\b2mb\b/iu.test(text)) return "Hai Mặt Bằng";
  if (/\bmb\b/iu.test(text)) return "Mặt Bằng";
  if (/\bhxt\b/iu.test(text)) return "Hẻm Xe Tải";
  if (/\bhxh\b/iu.test(text)) return "Hẻm Xe Hơi";
  if (/\bhxm\b/iu.test(text)) return "Hẻm Xe Máy";
  if (/^\s*\d+[A-Za-zÀ-ỹ]?(?:\/\d+[A-Za-zÀ-ỹ]?)+/u.test(addressLine)) {
    return "Hẻm";
  }
  return "Mặt Tiền";
}

const stripHouseTypeTags = (value: string) =>
  value.replace(/\b(?:2mt|2mb|hxt|hxh|hxm|mt|mb)\b\.?/giu, " ");

const normalizeDistrictForTitle = (value: string) =>
  value
    .replace(/\bquận\.?\s*/giu, "Quận ")
    .replace(/\bq(?:\.|\s+)?(?=\d)/giu, "Quận ")
    .replace(/\bq(?:\.|\s+)(?=\p{L})/giu, "Quận ");

function buildTitleAddress(addressLine: string) {
  return trimExtraPunctuation(
    normalizeDistrictForTitle(
      stripLeadingHouseNumber(stripHouseTypeTags(stripTrailingHouseTag(addressLine)))
    )
  )
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ");
}

function buildTitle(addressLine: string, text: string) {
  return [detectHouseType(addressLine, text), buildTitleAddress(addressLine)]
    .filter(Boolean)
    .join(" ");
}

function removeDistrictFromStreet(value: string) {
  let street = value
    .replace(/\b(?:q|quận)\.?\s*\d{1,2}\b.*$/iu, "")
    .replace(/\b(?:p|phường)\.?\s*\d+\b.*$/iu, "");

  for (const district of namedDistricts) {
    const escaped = escapeRegExp(district);
    street = street.replace(
      new RegExp(`(?:,|\\s)+(?:q\\.?\\s*)?${escaped}\\s*$`, "iu"),
      ""
    );
  }

  return street;
}

function extractStreetName(addressLine: string) {
  const withoutTag = stripTrailingHouseTag(addressLine)
    .replace(/^\s*(?:hxh|hxt|h3g|mt)\s+/iu, "");
  const withoutHouseNumber = stripLeadingHouseNumber(withoutTag);

  const withoutWard = withoutHouseNumber.replace(
    /,\s*(?:p|phường|q|quận)\.?\s*[^,]+.*$/iu,
    ""
  );

  return trimExtraPunctuation(removeDistrictFromStreet(withoutWard));
}

function parseDimensions(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/iu);
  if (!match) return { width: null, length: null };

  const width = Number(match[1].replace(",", "."));
  const length = Number(match[2].replace(",", "."));

  if (!Number.isFinite(width) || !Number.isFinite(length)) {
    return { width: null, length: null };
  }

  return { width, length };
}

function parseExplicitArea(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*m\s*(?:2|²)\b/iu);
  if (!match) return null;

  const area = Number(match[1].replace(",", "."));
  return Number.isFinite(area) ? area : null;
}

function parseMainFloors(text: string) {
  const normalized = normalizeText(text);
  const explicitMainFloors = normalized.match(/\btret\s*(\d+)\s*lau\b/i);
  if (explicitMainFloors) return Number(explicitMainFloors[1]);

  if (/\btret\s*lau\b/i.test(normalized)) return 1;

  const looseFloors = normalized.match(/\b(\d+)\s*lau\b/i);
  if (looseFloors) return Number(looseFloors[1]);

  return 0;
}

function parseAreaMultiplier(text: string, mainFloors: number) {
  const normalized = normalizeText(text);
  const hasMezzanine = /\blung\b/i.test(normalized);
  const hasTerrace = /\bst\b|\bsan\s*thuong\b/i.test(normalized);

  return 1 + mainFloors + (hasMezzanine ? 0.5 : 0) + (hasTerrace ? 1 : 0);
}

function parseFurnishing(text: string): ParsedZaloListing["furnishing"] {
  const normalized = normalizeText(text);

  if (/\bfull\s*nt\b|\bfull\s*noi\s*that\b|\bday\s*du\b/i.test(normalized)) {
    return "Đầy đủ";
  }

  if (/\bcb\b|\bco\s*ban\b/i.test(normalized)) {
    return "Cơ bản";
  }

  return "Trống";
}

function parseRoomCount(text: string, label: "pn" | "wc") {
  const match = text.match(new RegExp(`(\\d+)\\s*${label}\\b`, "i"));
  return match ? Number(match[1]) : null;
}

export function parseZaloListingText(input: string): ParsedZaloListing {
  const text = input.trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0] || "";
  const address = stripTrailingHouseTag(firstLine);
  const district = normalizeDistrict(text);
  const price = parsePrice(text);
  const phone = parsePhone(text);
  const { width, length } = parseDimensions(text);
  const floors = parseMainFloors(text);
  const explicitArea = width && length ? null : parseExplicitArea(text);
  const area =
    width && length
      ? roundArea(width * length * parseAreaMultiplier(text, floors))
      : explicitArea;

  return {
    title: buildTitle(firstLine, text),
    price,
    district,
    address,
    area,
    width,
    length,
    floors,
    phone,
    furnishing: parseFurnishing(text),
    description: lines.slice(1).join("\n"),
    bedrooms: parseRoomCount(text, "pn"),
    bathrooms: parseRoomCount(text, "wc"),
  };
}
