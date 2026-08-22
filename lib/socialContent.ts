export type SocialListingInput = {
  id?: string | null;
  title?: string | null;

  address?: string | null;
  street?: string | null;
  ward?: string | null;
  district?: string | null;

  description?: string | null;

  price?: number | string | null;
  area?: number | string | null;
  width?: number | string | null;
  length?: number | string | null;
  floors?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;

  contact_phone?: string | null;
  contact_phone_override?: string | null;
};

export type NearbyPlace = {
  name: string;
  category: string;
  distanceMeters?: number;
};

export type SocialListingContentOptions = {
  contactPhone?: string;
  contactLabel?: string;
  rawText?: string | null;
  nearbyPlaces?: NearbyPlace[];
};

export type SocialListingContentResult = {
  title: string;
  content: string;
  publicStreet: string | null;
  district: string | null;
  ward: string | null;
  suitableFor: string[];
  extras: string[];
  nearbyPlaces: NearbyPlace[];
};

/* =========================================================
   TEXT
========================================================= */

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const clean = (value: unknown): string =>
  String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

function titleCaseVietnamese(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(" ");
}

/* =========================================================
   PHONE
========================================================= */

const PHONE_REGEX = /(?:\+?84|0)(?:[ .-]?\d){9,10}/g;

const CONTACT_LINE_REGEX =
  /^.*(?:liên hệ|lien he|hotline|zalo|sđt|sdt|điện thoại|dien thoai).*$/gimu;

const HASHTAG_LINE_REGEX =
  /^\s*(?:#[\p{L}\p{N}_]+\s*)+$/gimu;

export function normalizeVietnamPhone(
  value: unknown,
): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("84")
    ? `0${digits.slice(2)}`
    : digits;

  return /^0\d{9}$/.test(normalized)
    ? normalized
    : null;
}

export function formatVietnamPhone(
  value: string,
): string {
  const phone =
    normalizeVietnamPhone(value) ?? value;

  return phone.replace(
    /^(\d{4})(\d{3})(\d{3})$/,
    "$1 $2 $3",
  );
}

/* =========================================================
   SLUG / HASHTAG
========================================================= */

export function slugVietnamese(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function districtSlug(
  district: string | null | undefined,
): string {
  const raw = slugVietnamese(
    String(district ?? ""),
  );

  if (!raw) {
    return "tphcm";
  }

  if (/^(q|quan)\d+$/.test(raw)) {
    return `quan${raw.replace(/\D/g, "")}`;
  }

  return raw.replace(/^quan/, "quan");
}

function detectTypeHashtags(
  listing: SocialListingInput,
): string[] {
  const source = slugVietnamese(
    [
      listing.title,
      listing.address,
      listing.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const tags = new Set<string>();

  if (
    source.includes("mattien") ||
    source.includes("showroom")
  ) {
    tags.add("matbang");
  }

  if (source.includes("vanphong")) {
    tags.add("vanphong");
  }

  if (source.includes("spa")) {
    tags.add("spa");
  }

  if (
    source.includes("cafe") ||
    source.includes("caphe")
  ) {
    tags.add("cafe");
  }

  if (
    source.includes("nhahang") ||
    source.includes("quanan")
  ) {
    tags.add("quanan");
  }

  return [...tags];
}

export function buildDistrictHashtags(
  listing: SocialListingInput,
): string[] {
  const d = districtSlug(listing.district);

  const tags = new Set<string>([
    "#nhachothue",
    "#nhachothuenguyencan",
    `#chothuenha${d}`,
    `#nha${d}`,
  ]);

  for (const type of detectTypeHashtags(listing)) {
    tags.add(`#${type}${d}`);
  }

  return [...tags].slice(0, 7);
}

/* =========================================================
   CONTACT / CLEAN CONTENT
========================================================= */

export function stripContactAndHashtags(
  content: string,
): string {
  return String(content ?? "")
    .replace(CONTACT_LINE_REGEX, "")
    .replace(HASHTAG_LINE_REGEX, "")
    .replace(PHONE_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const ADMIN_DEFAULT_CONTACT_PHONE =
  normalizeVietnamPhone(
    process.env.ADMIN_DEFAULT_CONTACT_PHONE,
  ) ?? "0946497253";

export function resolveContactPhone(input: {
  listingOverride?: unknown;
  brokerDefault?: unknown;
  listingPhone?: unknown;
  adminDefault?: unknown;
  requireBrokerPhone?: boolean;
}): string {
  const override = normalizeVietnamPhone(
    input.listingOverride,
  );

  if (override) {
    return override;
  }

  const brokerDefault = normalizeVietnamPhone(
    input.brokerDefault,
  );

  if (brokerDefault) {
    return brokerDefault;
  }

  if (input.requireBrokerPhone) {
    throw new Error("BROKER_PHONE_REQUIRED");
  }

  const listingPhone = normalizeVietnamPhone(
    input.listingPhone,
  );

  if (listingPhone) {
    return listingPhone;
  }

  const adminDefault =
    normalizeVietnamPhone(input.adminDefault) ??
    ADMIN_DEFAULT_CONTACT_PHONE;

  if (adminDefault) {
    return adminDefault;
  }

  throw new Error("CONTACT_PHONE_REQUIRED");
}

/* =========================================================
   ADDRESS
   QUAN TRỌNG:
   FACEBOOK KHÔNG ĐƯỢC LỘ SỐ NHÀ / SỐ HẺM / ĐỊA CHỈ RIÊNG
========================================================= */

const ADDRESS_PREFIXES = [
  {
    regex: /\bgoc\s*2\s*mt\b|\bgoc\s*2mt\b/i,
    label: "Góc Hai Mặt Tiền",
  },
  {
    regex: /\bgoc\s*2\s*mb\b|\bgoc\s*2mb\b/i,
    label: "Góc Hai Mặt Bằng",
  },
  {
    regex: /\b2\s*mb\s*truoc\s*sau\b/i,
    label: "Hai Mặt Bằng Trước Sau",
  },
  {
    regex: /\b2\s*mt\b/i,
    label: "Hai Mặt Tiền",
  },
  {
    regex: /\b2\s*mb\b/i,
    label: "Hai Mặt Bằng",
  },
  {
    regex: /\bgoc\b/i,
    label: "Góc",
  },
  {
    regex:
      /\bhxh\b|hem\s*xe\s*hoi|hẻm\s*xe\s*hơi/i,
    label: "Hẻm Xe Hơi",
  },
  {
    regex:
      /\bhxt\b|hem\s*xe\s*tai|hẻm\s*xe*tải/i,
    label: "Hẻm Xe Tải",
  },
  {
    regex:
      /\bhxm\b|hem\s*xe\s*may|hẻm\s*xe\s*máy/i,
    label: "Hẻm Xe Máy",
  },
  {
    regex:
      /\bh3g\b|hem\s*ba\s*gac|hẻm\s*ba\s*gác/i,
    label: "Hẻm Ba Gác",
  },
  {
    regex:
      /\bmb\b|mat\s*bang|mặt\s*bằng/i,
    label: "Mặt Bằng",
  },
  {
    regex:
      /\bmt\b|mat\s*tien|mặt\s*tiền/i,
    label: "Mặt Tiền",
  },
];

function detectAddressPrefix(
  raw: string,
): string {
  const normalized = normalizeText(raw);

  for (const item of ADDRESS_PREFIXES) {
    if (item.regex.test(normalized)) {
      return item.label;
    }
  }

  const firstLine =
    raw.split("\n")[0] ?? "";

  return firstLine.includes("/")
    ? "Hẻm"
    : "Mặt Tiền";
}

/**
 * Chỉ lấy TÊN ĐƯỜNG.
 *
 * Ví dụ:
 *  "215 Thành Công, P.14, Q.Tân Bình"
 *       -> "Thành Công"
 *
 *  "24 Hoàng Văn Thụ, P.4, Q.Tân Bình"
 *       -> "Hoàng Văn Thụ"
 *
 *  "Nguyễn Văn Trỗi, Phú Nhuận"
 *       -> "Nguyễn Văn Trỗi"
 *
 * Tuyệt đối không trả lại số nhà.
 */
function extractPublicStreet(
  raw: string,
): string | null {
  const firstLine =
    raw.split("\n")[0] ?? "";

  let value = clean(firstLine);

  if (!value) {
    return null;
  }

  // Bỏ các prefix loại mặt bằng / hẻm.
  value = value.replace(
    /^\s*(?:góc\s*2\s*mt|góc\s*2\s*mb|2\s*mt|2\s*mb|góc|hxh|hxt|hxm|h3g|mb|mt)\s*/i,
    "",
  );

  // Bỏ số nhà / số hẻm đầu chuỗi.
  value = value.replace(
    /^\s*\d+(?:[a-zA-Z]|\s*\/\s*\d+)?(?:[-./]\d+)*\s+/i,
    "",
  );

  // Bỏ P./Phường/Q./Quận phía sau.
  value = value.replace(
    /,?\s*(?:P\.?\s*\w+|Phường\s+[^,]+|Q\.?\s*\w+|Quận\s+[^,]+).*$/iu,
    "",
  );

  // Chỉ lấy phần trước dấu phẩy.
  value = value
    .split(",")[0]
    .trim();

  // Nếu vẫn còn số nhà ở đầu thì bỏ lần cuối.
  value = value.replace(
    /^\d+(?:[a-zA-Z]|\s*\/\s*\d+)?\s+/,
    "",
  );

  return value
    ? titleCaseVietnamese(value)
    : null;
}

/* =========================================================
   PARSE ZALO
========================================================= */

import {
  parseZaloListingText,
} from "@/lib/zaloListingParser";

type ParsedListing = ReturnType<
  typeof parseZaloListingText
>;

function getPublicDistrict(
  listing: SocialListingInput,
  parsed: ParsedListing,
): string | null {
  return (
    clean(listing.district) ||
    clean(parsed.district) ||
    null
  );
}

function getPublicWard(
  listing: SocialListingInput,
  parsed: ParsedListing,
  rawText: string,
): string | null {
  const listingWard =
    clean(listing.ward);

  if (listingWard) {
    const match =
      listingWard.match(
        /(?:P\.?|Phường)\s*(\d{1,2})/iu,
      );

    if (match) {
      return `P.${Number(match[1])}`;
    }

    return listingWard;
  }

  const source = [
    parsed.address || "",
    rawText || "",
  ].join("\n");

  const match = source.match(
    /\b(?:p|phường)\.?\s*(\d{1,2})\b/iu,
  );

  if (match) {
    return `P.${Number(match[1])}`;
  }

  return null;
}

/* =========================================================
   STRUCTURE
========================================================= */

function getStructure(raw: string): string {
  const normalized =
    normalizeText(raw);

  const parts: string[] = [];

  const basement =
    /\bh[aà]m\b/.test(normalized);

  const mezzanine =
    /\bl[uử]ng\b|\bmezzanine\b/.test(
      normalized,
    );

  const tret =
    normalized.match(
      /(\d+)?\s*tr[eệ]t\b/,
    );

  const floor =
    normalized.match(
      /(\d+)\s*l[aầ]u\b/,
    );

  const floorShort =
    normalized.match(
      /(\d+)\s*l\b(?!\w)/,
    );

  const st =
    /\bst\b|\bs[aâ]n\s*th[uư]ợng\b/.test(
      normalized,
    );

  const rooms =
    normalized.match(
      /(\d+)\s*(?:p\b|ph[oò]ng\b)/,
    );

  if (basement) {
    parts.push("Hầm");
  }

  if (tret) {
    parts.push(`${tret[1] ?? "1"} Trệt`);
  }

  if (mezzanine) {
    parts.push("Lửng");
  }

  if (floor?.[1]) {
    parts.push(
      `${floor[1]} Lầu`,
    );
  } else if (floorShort?.[1]) {
    parts.push(
      `${floorShort[1]} Lầu`,
    );
  }

  if (st) {
    parts.push("Sân Thượng");
  }

  if (rooms?.[1]) {
    parts.push(
      `${rooms[1]} Phòng`,
    );
  }

  return parts.join(" ");
}

/* =========================================================
   EXTRAS
========================================================= */

function getExtras(raw: string): string[] {
  const normalized =
    normalizeText(raw);

  const extras: string[] = [];

  if (
    /\bfull\s*nt\b/.test(normalized) ||
    /\bfull\s*noi\s*that\b/.test(
      normalized,
    )
  ) {
    extras.push("Full Nội Thất");
  }

  if (
    /\bntcb\b/.test(normalized) ||
    /\bnoi\s*that\s*co\s*ban\b/.test(
      normalized,
    )
  ) {
    extras.push("Nội Thất Cơ Bản");
  }

  if (
    /\bco\s*nt\b/.test(normalized) ||
    /\bco\s*noi\s*that\b/.test(
      normalized,
    )
  ) {
    extras.push("Có Nội Thất");
  }

  if (/\bpccc\b/.test(normalized)) {
    extras.push("PCCC");
  }

  if (
    /\bktm\b/.test(normalized) ||
    /\bkhong\s*thang\s*may\b/.test(
      normalized,
    )
  ) {
    extras.push("Không Thang Máy");
  } else if (
    /\btm\b/.test(normalized) ||
    /\bthang\s*may\b/.test(
      normalized,
    )
  ) {
    extras.push("Có Thang Máy");
  }

  return [...new Set(extras)];
}

/* =========================================================
   BEDROOM / WC
========================================================= */

function getBedrooms(
  raw: string,
  listing: SocialListingInput,
  parsed: ParsedListing,
): number | null {
  const match =
    normalizeText(raw).match(
      /(\d+)\s*(?:pn|ph[oò]ng\s*ng[uủ])/,
    );

  if (match?.[1]) {
    return Number(match[1]);
  }

  const value = Number(
    listing.bedrooms ??
      parsed.bedrooms ??
      0,
  );

  return value > 0 ? value : null;
}

function getBathrooms(
  raw: string,
  listing: SocialListingInput,
  parsed: ParsedListing,
): number | null {
  const match =
    normalizeText(raw).match(
      /(\d+)\s*(?:wc|toilet|nh[aà]\s*v[eệ]\s*sinh)/,
    );

  if (match?.[1]) {
    return Number(match[1]);
  }

  const value = Number(
    listing.bathrooms ??
      parsed.bathrooms ??
      0,
  );

  return value > 0 ? value : null;
}

/* =========================================================
   PRICE
========================================================= */

function formatPrice(
  value: unknown,
): string {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "";
  }

  if (number >= 1_000_000_000) {
    const billions =
      number / 1_000_000_000;

    return `${
      Number.isInteger(billions)
        ? billions
        : billions.toFixed(1)
    } tỷ`;
  }

  if (number >= 1_000_000) {
    const millions =
      number / 1_000_000;

    return `${
      Number.isInteger(millions)
        ? millions
        : millions.toFixed(1)
    }tr`;
  }

  return number.toLocaleString(
    "vi-VN",
  );
}

/* =========================================================
   DIMENSIONS
========================================================= */

function getDimensions(
  listing: SocialListingInput,
  parsed: ParsedListing,
  raw: string,
): string {
  const size =
    raw.match(
      /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
    );

  if (size) {
    return `${size[1].replace(",", ".")}x${size[2].replace(",", ".")}`;
  }

  if (
    parsed.width &&
    parsed.length
  ) {
    return `${parsed.width}x${parsed.length}`;
  }

  if (
    listing.width &&
    listing.length
  ) {
    return `${listing.width}x${listing.length}`;
  }

  if (
    listing.area ||
    parsed.area
  ) {
    return `${listing.area ?? parsed.area}m²`;
  }

  return "";
}

/* =========================================================
   PHÙ HỢP
   CHỈ LẤY NHỮNG GÌ TIN GỐC THỰC SỰ ĐỀ CẬP
========================================================= */

function buildSuitableFor(
  raw: string,
): string[] {
  const normalized =
    normalizeText(raw);

  const result: string[] = [];

  const hasCHDV =
    /\bchdv\b/.test(normalized) ||
    /can\s*ho\s*dich\s*vu/.test(
      normalized,
    ) ||
    /cho\s*thue\s*can\s*ho\s*dich\s*vu/.test(
      normalized,
    ) ||
    /cho\s*chdv/.test(normalized) ||
    /lam\s*chdv/.test(normalized);

  const hasHomestay =
    /\bhomestay\b/.test(normalized) ||
    /cho\s*homestay/.test(normalized);

  const hasHotel =
    /\bkhach\s*san\b/.test(
      normalized,
    ) ||
    /luu\s*tru/.test(normalized) ||
    /nha\s*nghi/.test(normalized);

  const hasOffice =
    /\bvan\s*phong\b/.test(
      normalized,
    ) ||
    /\boffice\b/.test(normalized) ||
    /cong\s*ty/.test(normalized);

  const hasShowroom =
    /\bshowroom\b/.test(normalized);

  const hasShop =
    /\bshop\b/.test(normalized) ||
    /cua\s*hang/.test(normalized) ||
    /ban\s*le/.test(normalized);

  const hasSpa =
    /\bspa\b/.test(normalized) ||
    /tham\s*my/.test(normalized) ||
    /\bnail\b/.test(normalized) ||
    /\bsalon\b/.test(normalized);

  const hasClinic =
    /\bclinic\b/.test(normalized) ||
    /phong\s*kham/.test(
      normalized,
    ) ||
    /nha\s*khoa/.test(normalized);

  const hasRestaurant =
    /nha\s*hang/.test(normalized) ||
    /quan\s*an/.test(normalized) ||
    /\bcafe\b/.test(normalized) ||
    /ca\s*phe/.test(normalized);

  const hasWarehouse =
    /\bkho\b/.test(normalized) ||
    /\bxuong\b/.test(normalized);

  if (hasCHDV) {
    result.push(
      "🛏️ Căn hộ dịch vụ",
    );
  }

  if (hasHomestay) {
    result.push("🏠 Homestay");
  }

  if (hasHotel) {
    result.push(
      "🏨 Khách sạn / lưu trú / nhà nghỉ",
    );
  }

  if (hasOffice) {
    result.push(
      "🏢 Văn phòng công ty",
    );
  }

  if (hasShowroom) {
    result.push("🏬 Showroom");
  }

  if (hasShop) {
    result.push(
      "🛍️ Cửa hàng / bán lẻ",
    );
  }

  if (hasSpa) {
    result.push(
      "💆 Spa / nail / salon / thẩm mỹ",
    );
  }

  if (hasClinic) {
    result.push(
      "🏥 Phòng khám / clinic / nha khoa",
    );
  }

  if (hasRestaurant) {
    result.push(
      "🍜 Nhà hàng / café / ăn uống",
    );
  }

  if (hasWarehouse) {
    result.push(
      "📦 Kho / xưởng",
    );
  }

  if (
    /gia\s*dinh/.test(normalized) ||
    /\bo\b/.test(normalized) ||
    /nha\s*nguyen\s*can/.test(
      normalized,
    )
  ) {
    result.push(
      "🏠 Gia đình / ở lâu dài",
    );
  }

  return [...new Set(result)];
}

/* =========================================================
   XUNG QUANH
   KHÔNG TỰ BỊA ĐỊA ĐIỂM
========================================================= */

const PRIORITY_CATEGORY_ORDER = [
  "university",
  "school",
  "hospital",
  "park",
  "sports",
  "market",
  "mall",
  "transit",
  "residential",
  "commercial",
];

function cleanNearbyPlaces(
  places: NearbyPlace[],
): NearbyPlace[] {
  const seen = new Set<string>();

  return places
    .filter(
      (place) => place?.name,
    )
    .sort((a, b) => {
      const ai =
        PRIORITY_CATEGORY_ORDER.indexOf(
          a.category,
        );

      const bi =
        PRIORITY_CATEGORY_ORDER.indexOf(
          b.category,
        );

      return (
        (ai === -1 ? 999 : ai) -
        (bi === -1 ? 999 : bi)
      );
    })
    .filter((place) => {
      const key = normalizeText(
        place.name,
      );

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .slice(0, 5);
}

function buildNearbySection(
  street: string | null,
  district: string | null,
  places: NearbyPlace[],
): string {
  const nearby =
    cleanNearbyPlaces(places);

  if (!nearby.length) {
    return `Khu vực ${
      street ||
      district ||
      "trung tâm"
    }${
      district
        ? `, ${district}`
        : ""
    } thuận tiện sinh hoạt, di chuyển và tiếp cận các tiện ích dân sinh.`;
  }

  const names = nearby.map(
    (place) => place.name,
  );

  if (names.length === 1) {
    return `Vị trí gần ${names[0]}, thuận tiện di chuyển và kết nối các tiện ích, khu dân cư và hoạt động kinh doanh xung quanh.`;
  }

  if (names.length === 2) {
    return `Vị trí gần ${names[0]} và ${names[1]}, thuận tiện di chuyển, tiếp cận các tiện ích và khu vực dân cư xung quanh.`;
  }

  return `Vị trí gần ${names
    .slice(0, -1)
    .join(", ")} và ${
    names[names.length - 1]
  }, thuận tiện di chuyển, nhận diện vị trí và tiếp cận các tiện ích, khu dân cư, trường học và khu vực kinh doanh xung quanh.`;
}

/* =========================================================
   BUILD ĐÚNG TEMPLATE FACEBOOK
========================================================= */

export function buildSocialListingContent(
  listing: SocialListingInput,
  options: SocialListingContentOptions = {},
): SocialListingContentResult {
  const raw =
    clean(options.rawText) ||
    clean(listing.description) ||
    [
      listing.address,
      listing.title,
      listing.area,
      listing.width &&
      listing.length
        ? `${listing.width}x${listing.length}`
        : "",
      listing.floors,
      listing.bedrooms
        ? `${listing.bedrooms}pn`
        : "",
      listing.bathrooms
        ? `${listing.bathrooms}wc`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

  const parsed =
    parseZaloListingText(raw);

  const prefix =
    detectAddressPrefix(raw);

  /*
   * KHÔNG dùng nguyên listing.address.
   * Chỉ lấy tên đường.
   */
  const publicStreet =
    clean(listing.street)
      ? extractPublicStreet(
          clean(listing.street) as string,
        )
      : extractPublicStreet(
          listing.address ||
            raw,
        );

  const district =
    getPublicDistrict(
      listing,
      parsed,
    );

  const ward =
    getPublicWard(
      listing,
      parsed,
      raw,
    );

  const dimensions =
    getDimensions(
      listing,
      parsed,
      raw,
    );

  const structure =
    getStructure(raw);

  const bedrooms =
    getBedrooms(
      raw,
      listing,
      parsed,
    );

  const bathrooms =
    getBathrooms(
      raw,
      listing,
      parsed,
    );

  const extras =
    getExtras(raw);

  const suitableFor =
    buildSuitableFor(raw);

  const price =
    formatPrice(
      listing.price ??
        parsed.price,
    );

  /*
   * TIÊU ĐỀ:
   * "Mặt Tiền Thành Công P.14 Tân Bình"
   *
   * Không bao giờ:
   * "Mặt Tiền 215 Thành Công..."
   */
  const titleParts = [
    prefix,
    publicStreet,
    ward,
    district,
  ].filter(Boolean);

  const title =
    titleParts.join(" ");

  const nearbyPlaces =
    cleanNearbyPlaces(
      options.nearbyPlaces ?? [],
    );

  const nearbyText =
    buildNearbySection(
      publicStreet,
      district,
      nearbyPlaces,
    );

  const lines: string[] = [];

  /*
   * TEMPLATE
   */
  lines.push(
    title ||
      "Mặt Bằng Cho Thuê",
  );

  lines.push("");

  if (dimensions) {
    lines.push(
      `📐 DT: ${dimensions}`,
    );
  }

  if (structure) {
    lines.push(
      `🏢 KC: ${structure}`,
    );
  }

  if (
    bedrooms ||
    bathrooms
  ) {
    const roomParts: string[] =
      [];

    if (bedrooms) {
      roomParts.push(
        `${bedrooms} Phòng Ngủ`,
      );
    }

    if (bathrooms) {
      roomParts.push(
        `${bathrooms} WC`,
      );
    }

    lines.push(
      `🚪 ${roomParts.join(" – ")}`,
    );
  }

  if (extras.length) {
    lines.push(
      `🛡️ ${extras.join(" · ")}`,
    );
  }

  if (price) {
    lines.push(
      `💰 Giá: ${price}/tháng`,
    );
  }

  if (suitableFor.length) {
    lines.push("");

    lines.push(
      "🔥 PHÙ HỢP:",
    );

    for (const item of suitableFor) {
      lines.push(item);
    }
  }

  lines.push("");

  lines.push(
    `📍 XUNG QUANH: ${nearbyText}`,
  );

  const contactPhone =
    clean(options.contactPhone);

  if (contactPhone) {
    lines.push("");

    lines.push(
      `📞 Liên hệ: ${formatVietnamPhone(
        contactPhone,
      )}${
        options.contactLabel
          ? ` (${options.contactLabel})`
          : ""
      }`,
    );
  }

  return {
    title,
    content: lines
      .join("\n")
      .trim(),
    publicStreet,
    district,
    ward,
    suitableFor,
    extras,
    nearbyPlaces,
  };
}

/* =========================================================
   FINAL FACEBOOK CONTENT
   DÙNG CHUNG CHO sync-today + next-job
========================================================= */

export function finalizeFacebookContent(
  input: {
    baseContent?: string;
    listing: SocialListingInput;
    contactPhone: string;
    contactLabel?: string;
    rawText?: string | null;
    nearbyPlaces?: NearbyPlace[];
  },
): {
  content: string;
  hashtags: string[];
} {
  /*
   * KHÔNG lấy baseContent cũ làm template.
   *
   * Luôn build lại bằng template chuẩn.
   */
  const generated =
    buildSocialListingContent(
      input.listing,
      {
        contactPhone:
          input.contactPhone,
        contactLabel:
          input.contactLabel,
        rawText:
          input.rawText ||
          [
            input.listing.address,
            input.listing.description,
            input.listing.title,
          ]
            .filter(Boolean)
            .join("\n"),
        nearbyPlaces:
          input.nearbyPlaces ?? [],
      },
    );

  /*
   * Kiểm tra lần cuối:
   * không cho số nhà lọt vào nội dung Facebook.
   */
  const safeContent =
    sanitizeFacebookAddress(
      generated.content,
      input.listing,
    );

  const hashtags =
    buildDistrictHashtags(
      input.listing,
    );

  return {
    content: [
      safeContent,
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n\n"),
    hashtags,
  };
}

/* =========================================================
   FACEBOOK ADDRESS SAFETY CHECK
========================================================= */

function sanitizeFacebookAddress(
  content: string,
  listing: SocialListingInput,
): string {
  let result = String(
    content ?? "",
  );

  const privateAddress =
    clean(listing.address);

  if (privateAddress) {
    result = result.replace(
      new RegExp(
        escapeRegExp(
          privateAddress,
        ),
        "giu",
      ),
      "",
    );
  }

  /*
   * Không cho dạng:
   * 215 Thành Công
   * 24 Hoàng Văn Thụ
   * 123A Nguyễn Trãi
   */
  result = result.replace(
    /(^|\n)([^\n]*?)\b\d{1,5}[A-Za-z]?\s+[A-ZÀ-ỸĐ][^\n,]*?(?=\s+P\.|\s+Phường|\s+Q\.|\s+Quận|,|$)/giu,
    "$1$2",
  );

  /*
   * Không cho số nhà xuất hiện ngay sau prefix.
   */
  result = result.replace(
    /(\b(?:Mặt Tiền|Mặt Bằng|Hẻm|Góc|Hai Mặt Tiền|Hai Mặt Bằng))\s+\d{1,5}[A-Za-z]?\s+/giu,
    "$1 ",
  );

  return result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}