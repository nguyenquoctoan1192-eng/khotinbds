import {
  parseZaloListingText,
} from "@/lib/zaloListingParser";

/* =========================================================
   TYPES
========================================================= */

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

type ParsedListing = ReturnType<
  typeof parseZaloListingText
>;

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

const PHONE_REGEX =
  /(?:\+?84|0)(?:[ .-]?\d){9,10}/g;

const CONTACT_LINE_REGEX =
  /^\s*(?:liên hệ|lien he|hotline|zalo|sđt|sdt|điện thoại|dien thoai)\s*:?.*$/gimu;

const HASHTAG_LINE_REGEX =
  /^\s*(?:#[\p{L}\p{N}_]+\s*)+$/gimu;

export function normalizeVietnamPhone(
  value: unknown,
): string | null {
  const digits = String(value ?? "").replace(
    /\D/g,
    "",
  );

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

  /*
   * Q1 / Q.1 / Quận 1
   * Sau slug:
   * Q1 -> q1
   * Quận 1 -> quan1
   */
  if (/^q\d+$/.test(raw)) {
    return `quan${raw.replace(/\D/g, "")}`;
  }

  if (/^quan\d+$/.test(raw)) {
    return raw;
  }

  /*
   * Phú Nhuận
   * -> quanphunhuan
   */
  if (raw.startsWith("quan")) {
    return raw;
  }

  return `quan${raw}`;
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

  /*
   * 2MT / mặt tiền / mặt bằng / showroom
   * -> matbang
   */
  if (
    source.includes("mattien") ||
    source.includes("matbang") ||
    source.includes("2mt") ||
    source.includes("2mb") ||
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
  const d = districtSlug(
    listing.district,
  );

  const tags = new Set<string>([
    "#nhachothue",
    "#nhachothuenguyencan",
    `#chothuenha${d}`,
    `#nha${d}`,
  ]);

  for (const type of detectTypeHashtags(
    listing,
  )) {
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

/*
 * Default chung của hệ thống.
 *
 * Facebook bên dưới vẫn dùng riêng:
 * 0924711550
 */

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
  const override =
    normalizeVietnamPhone(
      input.listingOverride,
    );

  if (override) {
    return override;
  }

  const brokerDefault =
    normalizeVietnamPhone(
      input.brokerDefault,
    );

  if (brokerDefault) {
    return brokerDefault;
  }

  if (input.requireBrokerPhone) {
    throw new Error(
      "BROKER_PHONE_REQUIRED",
    );
  }

  const listingPhone =
    normalizeVietnamPhone(
      input.listingPhone,
    );

  if (listingPhone) {
    return listingPhone;
  }

  const adminDefault =
    normalizeVietnamPhone(
      input.adminDefault,
    ) ?? ADMIN_DEFAULT_CONTACT_PHONE;

  if (adminDefault) {
    return adminDefault;
  }

  throw new Error(
    "CONTACT_PHONE_REQUIRED",
  );
}

/* =========================================================
   ADDRESS
========================================================= */

const ADDRESS_PREFIXES = [
  {
    regex:
      /\bgoc\s*2\s*mt\b|\bgoc\s*2mt\b/i,
    label: "Góc Hai Mặt Tiền",
  },
  {
    regex:
      /\bgoc\s*2\s*mb\b|\bgoc\s*2mb\b/i,
    label: "Góc Hai Mặt Bằng",
  },
  {
    regex:
      /\b2\s*mb\s*truoc\s*sau\b/i,
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
      /\bhxh\b|hem\s*xe\s*hoi/i,
    label: "Hẻm Xe Hơi",
  },
  {
    regex:
      /\bhxt\b|hem\s*xe\s*tai/i,
    label: "Hẻm Xe Tải",
  },
  {
    regex:
      /\bhxm\b|hem\s*xe\s*may/i,
    label: "Hẻm Xe Máy",
  },
  {
    regex:
      /\bh3g\b|hem\s*ba\s*gac/i,
    label: "Hẻm Ba Gác",
  },
  {
    regex:
      /\bmb\b|mat\s*bang/i,
    label: "Mặt Bằng",
  },
  {
    regex:
      /\bmt\b|mat\s*tien/i,
    label: "Mặt Tiền",
  },
];

function detectAddressPrefix(
  raw: string,
): string {
  const normalized =
    normalizeText(raw);

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

/* =========================================================
   PUBLIC STREET
========================================================= */

function isValidPublicStreet(
  value: string | null,
): value is string {
  const normalized = clean(value);

  if (!normalized) {
    return false;
  }

  if (
    !/[A-Za-zÀ-ỹĐđ]/u.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

function extractPublicStreet(
  raw: string,
): string | null {
  const firstLine =
    raw.split("\n")[0] ?? "";

  let value = clean(firstLine);

  if (!value) {
    return null;
  }

  /*
   * Bỏ prefix:
   * 2MT
   * 2MB
   * Góc
   * HXM
   * HXT
   * HXH
   * H3G
   * MT
   * MB
   */
  value = value.replace(
    /^\s*(?:góc\s*2\s*mt|góc\s*2\s*mb|2\s*mt|2\s*mb|góc|hxh|hxt|hxm|h3g|mb|mt)\s*/i,
    "",
  );

  /*
   * Bỏ số nhà / số hẻm đầu chuỗi.
   *
   * Ví dụ:
   * 200 Hồ Văn Huê
   * 215A Thành Công
   * 12/5 Nguyễn Trãi
   */
  value = value.replace(
    /^\s*\d+(?:[A-Za-z])?(?:\s*\/\s*\d+)?(?:[-.]\d+)?\s+/i,
    "",
  );

  /*
   * Bỏ P./Phường/Q./Quận.
   */
  value = value.replace(
    /,?\s*(?:P\.?\s*\d+|Phường\s+[^,]+|Q\.?\s*[^,\n]+|Quận\s+[^,\n]+).*$/iu,
    "",
  );

  /*
   * Chỉ lấy phần trước dấu phẩy.
   */
  value = value
    .split(",")[0]
    .trim();

  /*
   * Nếu vẫn còn số đầu chuỗi thì bỏ.
   */
  value = value.replace(
    /^\s*\d+(?:[A-Za-z])?(?:\s*\/\s*\d+)?\s+/,
    "",
  );

  value = clean(value);

  if (
    !isValidPublicStreet(value)
  ) {
    return null;
  }

  return titleCaseVietnamese(
    value,
  );
}

/* =========================================================
   PUBLIC DISTRICT
========================================================= */

function getPublicDistrict(
  listing: SocialListingInput,
  parsed: ParsedListing,
  rawText: string,
): string | null {
  /*
   * Ưu tiên district đã parse từ listing.
   */
  const direct =
    clean(listing.district) ||
    clean(parsed.district);

  if (direct) {
    return formatPublicDistrict(
      direct,
    );
  }

  /*
   * Fallback lấy trực tiếp từ raw text:
   *
   * Q.Phú Nhuận
   * Q.1
   * Quận Phú Nhuận
   */
  const normalizedRaw =
    clean(rawText);

  const match =
    normalizedRaw.match(
      /(?:^|[, ]+)(?:Q\.?\s*|Quận\s+)([^,\n]+)/iu,
    );

  if (match?.[1]) {
    return formatPublicDistrict(
      match[1],
    );
  }

  return null;
}

function formatPublicDistrict(
  district: string | null,
): string | null {
  const value = clean(district);

  if (!value) {
    return null;
  }

  const normalized =
    normalizeText(value);

  /*
   * Q.1 / Q1
   */
  const qNumber =
    normalized.match(
      /^q\.?\s*(\d+)$/,
    );

  if (qNumber?.[1]) {
    return `Quận ${qNumber[1]}`;
  }

  /*
   * Quận 1
   */
  const quanNumber =
    normalized.match(
      /^quan\s*(\d+)$/,
    );

  if (quanNumber?.[1]) {
    return `Quận ${quanNumber[1]}`;
  }

  /*
   * Nếu đã có chữ Quận
   */
  if (
    normalized.startsWith("quan ")
  ) {
    return titleCaseVietnamese(
      value,
    );
  }

  /*
   * Phú Nhuận
   * -> Quận Phú Nhuận
   */
  return `Quận ${titleCaseVietnamese(
    value,
  )}`;
}

/* =========================================================
   PUBLIC WARD
========================================================= */

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
      return `P.${Number(
        match[1],
      )}`;
    }

    return listingWard;
  }

  const source = [
    parsed.address || "",
    rawText || "",
  ].join("\n");

  const match =
    source.match(
      /\b(?:p|phường)\.?\s*(\d{1,2})\b/iu,
    );

  if (match) {
    return `P.${Number(
      match[1],
    )}`;
  }

  return null;
}

/* =========================================================
   STRUCTURE
========================================================= */

function getStructure(
  raw: string,
): string {
  const normalized =
    normalizeText(raw);

  const parts: string[] = [];

  const basement =
    /\bham\b/.test(normalized);

  const mezzanine =
    /\blung\b|\bmezzanine\b/.test(
      normalized,
    );

  const tret =
    /\btret\b/.test(normalized);

  /*
   * 2 lầu
   * 3 lầu
   */
  const floor =
    normalized.match(
      /(\d+)\s*lau\b/,
    );

  /*
   * 2L
   * 3L
   */
  const floorShort =
    normalized.match(
      /(\d+)\s*l\b(?!\w)/,
    );

  /*
   * Chỉ có "lầu"
   *
   * Ví dụ:
   * trệt lầu
   *
   * => 1 Lầu
   */
  const hasPlainFloor =
    /\blau\b/.test(normalized);

  const st =
    /\bst\b|\bsan\s*thuong\b/.test(
      normalized,
    );

  /*
   * 3PN
   * 3 PN
   * 3 phòng
   * 3 phòng ngủ
   */
  const bedrooms =
    normalized.match(
      /(\d+)\s*(?:pn\b|phong(?:\s*ngu)?\b)/,
    );

  /*
   * 2WC
   * 2 WC
   * 2 phòng WC
   * 2 phòng vệ sinh
   */
  const bathrooms =
    normalized.match(
      /(\d+)\s*(?:wc\b|phong\s*wc\b|phong\s*ve\s*sinh\b)/,
    );

  if (basement) {
    parts.push("Hầm");
  }

  /*
   * QUAN TRỌNG:
   *
   * "Trệt lầu"
   * => "Trệt 1 Lầu"
   *
   * "Trệt 2 lầu"
   * => "Trệt 2 Lầu"
   */
  if (
    tret &&
    (floor?.[1] ||
      floorShort?.[1])
  ) {
    const floorNumber =
      floor?.[1] ??
      floorShort?.[1];

    parts.push(
      `Trệt ${floorNumber} Lầu`,
    );
  } else if (
    tret &&
    hasPlainFloor
  ) {
    parts.push(
      "Trệt 1 Lầu",
    );
  } else if (tret) {
    parts.push("Trệt");
  } else if (floor?.[1]) {
    parts.push(
      `${floor[1]} Lầu`,
    );
  } else if (
    floorShort?.[1]
  ) {
    parts.push(
      `${floorShort[1]} Lầu`,
    );
  } else if (
    hasPlainFloor
  ) {
    parts.push("1 Lầu");
  }

  if (mezzanine) {
    parts.push("Lửng");
  }

  if (st) {
    parts.push("Sân Thượng");
  }

  if (bedrooms?.[1]) {
    parts.push(
      `${bedrooms[1]} Phòng`,
    );
  }

  if (bathrooms?.[1]) {
    parts.push(
      `${bathrooms[1]}WC`,
    );
  }

  return parts.join(" - ");
}

/* =========================================================
   EXTRAS
========================================================= */

function getExtras(
  raw: string,
): string[] {
  const normalized =
    normalizeText(raw);

  const extras: string[] = [];

  if (
    /\bfull\s*nt\b/.test(
      normalized,
    ) ||
    /\bfull\s*noi\s*that\b/.test(
      normalized,
    )
  ) {
    extras.push(
      "Full Nội Thất",
    );
  }

  if (
    /\bntcb\b/.test(
      normalized,
    ) ||
    /\bnoi\s*that\s*co\s*ban\b/.test(
      normalized,
    )
  ) {
    extras.push(
      "Nội Thất Cơ Bản",
    );
  }

  if (
    /\bco\s*nt\b/.test(
      normalized,
    ) ||
    /\bco\s*noi\s*that\b/.test(
      normalized,
    )
  ) {
    extras.push(
      "Có Nội Thất",
    );
  }

  if (
    /\bpccc\b/.test(
      normalized,
    )
  ) {
    extras.push("PCCC");
  }

  if (
    /\bktm\b/.test(
      normalized,
    ) ||
    /\bkhong\s*thang\s*may\b/.test(
      normalized,
    )
  ) {
    extras.push(
      "Không Thang Máy",
    );
  } else if (
    /\btm\b/.test(
      normalized,
    ) ||
    /\bthang\s*may\b/.test(
      normalized,
    )
  ) {
    extras.push(
      "Có Thang Máy",
    );
  }

  return [
    ...new Set(extras),
  ];
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
    return `${size[1].replace(
      ",",
      ".",
    )}x${size[2].replace(
      ",",
      ".",
    )}`;
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
   AREA
========================================================= */

function getAreaNumber(
  listing: SocialListingInput,
  parsed: ParsedListing,
  raw: string,
): number | null {
  const size =
    raw.match(
      /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
    );

  if (size) {
    const w = Number(
      size[1].replace(
        ",",
        ".",
      ),
    );

    const l = Number(
      size[2].replace(
        ",",
        ".",
      ),
    );

    if (
      Number.isFinite(w) &&
      Number.isFinite(l)
    ) {
      return Math.round(w * l);
    }
  }

  if (
    parsed.width &&
    parsed.length
  ) {
    const w = Number(
      parsed.width,
    );

    const l = Number(
      parsed.length,
    );

    if (
      Number.isFinite(w) &&
      Number.isFinite(l)
    ) {
      return Math.round(w * l);
    }
  }

  if (
    listing.width &&
    listing.length
  ) {
    const w = Number(
      listing.width,
    );

    const l = Number(
      listing.length,
    );

    if (
      Number.isFinite(w) &&
      Number.isFinite(l)
    ) {
      return Math.round(w * l);
    }
  }

  const areaVal = Number(
    listing.area ??
      parsed.area,
  );

  if (
    Number.isFinite(areaVal) &&
    areaVal > 0
  ) {
    return Math.round(
      areaVal,
    );
  }

  return null;
}

/* =========================================================
   FLOOR COUNT
========================================================= */

function getFloorCount(
  raw: string,
): number | null {
  const normalized =
    normalizeText(raw);

  const floor =
    normalized.match(
      /(\d+)\s*lau\b/,
    );

  const floorShort =
    normalized.match(
      /(\d+)\s*l\b(?!\w)/,
    );

  /*
   * "lầu" không có số
   * được tính là 1 lầu.
   */
  const hasPlainFloor =
    /\blau\b/.test(normalized);

  if (floor?.[1]) {
    return Number(
      floor[1],
    );
  }

  if (floorShort?.[1]) {
    return Number(
      floorShort[1],
    );
  }

  if (hasPlainFloor) {
    return 1;
  }

  return null;
}

/* =========================================================
   PHÙ HỢP
========================================================= */

function suggestIndustriesByAttributes(
  prefix: string,
  areaM2: number | null,
  floorCount: number | null,
): string[] {
  const result: string[] = [];

  const isMatTien =
    /mặt tiền|mặt bằng|góc/i.test(
      prefix,
    );

  /*
   * Mặt tiền / mặt bằng
   */
  if (isMatTien) {
    /*
     * Từ 50m² trở lên:
     *
     * Cửa hàng
     * Bán lẻ
     * Spa
     * Nail
     * Salon
     * Thẩm mỹ
     * Văn phòng công ty
     * Showroom
     * Trưng bày sản phẩm
     * Quán café
     * Trà sữa
     */
    if (
      (areaM2 !== null &&
        areaM2 >= 50) ||
      (floorCount !== null &&
        floorCount >= 3)
    ) {
      result.push(
        "Cửa hàng",
        "Bán lẻ",
        "Spa",
        "Nail",
        "Salon",
        "Thẩm mỹ",
        "Văn phòng công ty",
        "Showroom",
        "Trưng bày sản phẩm",
        "Quán café",
        "Trà sữa",
      );
    } else {
      /*
       * Mặt tiền nhỏ hơn 50m²
       */
      result.push(
        "Cửa hàng",
        "Bán lẻ",
        "Spa",
        "Nail",
        "Salon",
        "Thẩm mỹ",
        "Quán café",
        "Trà sữa",
      );
    }
  } else {
    /*
     * Hẻm xe hơi / xe tải
     */
    if (
      /xe hơi|xe tải/i.test(
        prefix,
      )
    ) {
      result.push(
        "Văn phòng nhỏ",
        "Xưởng nhẹ",
        "Kho chứa hàng",
      );
    }

    result.push(
      "Gia đình",
      "Ở lâu dài",
    );
  }

  return result;
}

/* =========================================================
   BUILD SUITABLE FOR
========================================================= */

function buildSuitableFor(
  raw: string,
  attrs: {
    prefix: string;
    areaM2: number | null;
    floorCount: number | null;
  },
): string[] {
  const normalized =
    normalizeText(raw);

  const result: string[] = [];

  /*
   * Nhận diện loại hình được ghi trực tiếp
   */
  const hasCHDV =
    /\bchdv\b/.test(
      normalized,
    ) ||
    /can\s*ho\s*dich\s*vu/.test(
      normalized,
    ) ||
    /cho\s*thue\s*can\s*ho\s*dich\s*vu/.test(
      normalized,
    ) ||
    /cho\s*chdv/.test(
      normalized,
    ) ||
    /lam\s*chdv/.test(
      normalized,
    );

  const hasHomestay =
    /\bhomestay\b/.test(
      normalized,
    ) ||
    /cho\s*homestay/.test(
      normalized,
    );

  const hasHotel =
    /\bkhach\s*san\b/.test(
      normalized,
    ) ||
    /luu\s*tru/.test(
      normalized,
    ) ||
    /nha\s*nghi/.test(
      normalized,
    );

  const hasOffice =
    /\bvan\s*phong\b/.test(
      normalized,
    ) ||
    /\boffice\b/.test(
      normalized,
    ) ||
    /cong\s*ty/.test(
      normalized,
    );

  const hasShowroom =
    /\bshowroom\b/.test(
      normalized,
    );

  const hasShop =
    /\bshop\b/.test(
      normalized,
    ) ||
    /cua\s*hang/.test(
      normalized,
    ) ||
    /ban\s*le/.test(
      normalized,
    );

  const hasSpa =
    /\bspa\b/.test(
      normalized,
    ) ||
    /tham\s*my/.test(
      normalized,
    ) ||
    /\bnail\b/.test(
      normalized,
    ) ||
    /\bsalon\b/.test(
      normalized,
    );

  const hasClinic =
    /\bclinic\b/.test(
      normalized,
    ) ||
    /phong\s*kham/.test(
      normalized,
    ) ||
    /nha\s*khoa/.test(
      normalized,
    );

  const hasRestaurant =
    /nha\s*hang/.test(
      normalized,
    ) ||
    /quan\s*an/.test(
      normalized,
    ) ||
    /\bcafe\b/.test(
      normalized,
    ) ||
    /ca\s*phe/.test(
      normalized,
    );

  const hasWarehouse =
    /\bkho\b/.test(
      normalized,
    ) ||
    /\bxuong\b/.test(
      normalized,
    );

  /*
   * Thứ tự cố định
   */
  if (hasCHDV) {
    result.push(
      "Căn hộ dịch vụ",
    );
  }

  if (hasHomestay) {
    result.push(
      "Homestay",
    );
  }

  if (hasHotel) {
    result.push(
      "Khách sạn",
      "Lưu trú",
      "Nhà nghỉ",
    );
  }

  if (hasOffice) {
    result.push(
      "Văn phòng công ty",
    );
  }

  if (hasShowroom) {
    result.push(
      "Showroom",
      "Trưng bày sản phẩm",
    );
  }

  if (hasShop) {
    result.push(
      "Cửa hàng",
      "Bán lẻ",
    );
  }

  if (hasSpa) {
    result.push(
      "Spa",
      "Nail",
      "Salon",
      "Thẩm mỹ",
    );
  }

  if (hasClinic) {
    result.push(
      "Phòng khám",
      "Clinic",
      "Nha khoa",
    );
  }

  if (hasRestaurant) {
    result.push(
      "Nhà hàng",
      "Café",
      "Ăn uống",
    );
  }

  if (hasWarehouse) {
    result.push(
      "Kho",
      "Xưởng",
    );
  }

  if (
    /gia\s*dinh/.test(
      normalized,
    ) ||
    /\bo\b/.test(
      normalized,
    ) ||
    /nha\s*nguyen\s*can/.test(
      normalized,
    )
  ) {
    result.push(
      "Gia đình",
      "Ở lâu dài",
    );
  }

  /*
   * Nếu text không ghi rõ loại hình,
   * tự suy luận theo mặt tiền + diện tích.
   */
  const attributeSuggestions =
    suggestIndustriesByAttributes(
      attrs.prefix,
      attrs.areaM2,
      attrs.floorCount,
    );

  /*
   * Đưa suggestion lên trước,
   * sau đó mới tới loại hình ghi trực tiếp.
   *
   * Set giữ thứ tự và loại trùng.
   */
  return [
    ...new Set([
      ...attributeSuggestions,
      ...result,
    ]),
  ];
}

/* =========================================================
   BUILD SOCIAL LISTING CONTENT
========================================================= */


export function buildSocialListingContent(
  listing: SocialListingInput,
  options: SocialListingContentOptions = {},
): SocialListingContentResult {
  /*
   * =======================================================
   * RAW SOURCE
   *
   * Ưu tiên rawText / description nhưng luôn bổ sung
   * các field cấu trúc trực tiếp từ listing để tránh
   * mất Phòng / WC / Lầu khi text không chứa chúng.
   * =======================================================
   */

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
   * =======================================================
   * PUBLIC STREET
   *
   * Không công khai:
   * - số nhà
   * - số hẻm
   * - phường
   *
   * Ưu tiên:
   * 1. listing.street
   * 2. listing.address
   * 3. parsed/raw
   *
   * Nếu address chỉ là tên đường thì vẫn giữ nguyên.
   * =======================================================
   */

  const listingStreet =
    clean(listing.street)
      ? extractPublicStreet(
          clean(listing.street),
        )
      : null;

  const addressStreet =
    extractPublicStreet(
      clean(listing.address) ||
        raw,
    );

  const parsedStreet =
    extractPublicStreet(
      parsed.address ||
        raw,
    );

  const publicStreet =
    [
      listingStreet,
      addressStreet,
      parsedStreet,
    ]
      .map((value) =>
        clean(value),
      )
      .find((value) =>
        isValidPublicStreet(value),
      ) || null;

  /*
   * =======================================================
   * PUBLIC DISTRICT
   * =======================================================
   */

  const district =
    getPublicDistrict(
      listing,
      parsed,
      raw,
    );

  /*
   * Ward vẫn lấy cho API nếu cần,
   * nhưng KHÔNG render Facebook.
   */

  const ward =
    getPublicWard(
      listing,
      parsed,
      raw,
    );

  /*
   * =======================================================
   * DIMENSIONS
   * =======================================================
   */

  const dimensions =
    getDimensions(
      listing,
      parsed,
      raw,
    );

  /*
   * =======================================================
   * STRUCTURE
   *
   * getStructure() trước đây chỉ đọc raw.
   *
   * Bây giờ bổ sung trực tiếp field listing:
   * - floors
   * - bedrooms
   * - bathrooms
   *
   * để không mất thông tin KC.
   * =======================================================
   */

  const structureRaw = [
    raw,

    /*
     * floors = 2
     * => Trệt 2 Lầu
     *
     * Chỉ bổ sung khi field có giá trị.
     */
    listing.floors
      ? `Trệt ${listing.floors} Lầu`
      : "",

    /*
     * bedrooms = 4
     * => 4 Phòng
     */
    listing.bedrooms
      ? `${listing.bedrooms} Phòng`
      : "",

    /*
     * bathrooms = 4
     * => 4WC
     */
    listing.bathrooms
      ? `${listing.bathrooms}WC`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const structure =
    getStructure(
      structureRaw,
    );

  /*
   * =======================================================
   * EXTRAS
   *
   * Vẫn tính nếu flow/API cần,
   * nhưng KHÔNG render vào Facebook.
   * =======================================================
   */

  const extras =
    getExtras(raw);

  /*
   * =======================================================
   * SUITABLE FOR
   *
   * Tất cả nằm trên MỘT DÒNG.
   * Không bullet.
   * Không dùng dấu "/".
   * =======================================================
   */

  const suitableFor =
    buildSuitableFor(
      raw,
      {
        prefix,

        areaM2:
          getAreaNumber(
            listing,
            parsed,
            raw,
          ),

        floorCount:
          getFloorCount(
            structureRaw,
          ),
      },
    );

  /*
   * =======================================================
   * TITLE
   *
   * Format:
   *
   * 🔥 Hẻm Ba Gác - Hồ Văn Huê - Quận Phú Nhuận
   *
   * hoặc:
   *
   * 🔥 Hai Mặt Tiền - Hồ Văn Huê - Quận Phú Nhuận
   *
   * Tuyệt đối không để:
   *
   * 🔥 Hẻm Ba Gác - - Quận Phú Nhuận
   * =======================================================
   */

  const titleParts = [
    prefix,
    publicStreet,
    district,
  ]
    .map((value) =>
      clean(value),
    )
    .filter(Boolean);

  const title =
    titleParts.length > 0
      ? `🔥 ${titleParts.join(" - ")}`
      : "🔥 Mặt Bằng Cho Thuê";

  /*
   * =======================================================
   * NEARBY
   *
   * Vẫn nhận dữ liệu nhưng không render Facebook.
   * =======================================================
   */

  const nearbyPlaces =
    cleanNearbyPlaces(
      options.nearbyPlaces ?? [],
    );

  /*
   * =======================================================
   * FACEBOOK CONTENT
   *
   * Chỉ render:
   * 1. Tiêu đề
   * 2. DT
   * 3. KC
   * 4. Phù hợp
   * 5. Liên hệ được xử lý ở flow finalize
   *
   * Không render:
   * - Giá
   * - Xung quanh
   * - Phường
   * - Số nhà
   * - Extras
   * =======================================================
   */

  const lines: string[] = [];

  /*
   * TITLE
   */
  lines.push(title);

  /*
   * Khoảng cách
   */
  lines.push("");

  /*
   * =======================================================
   * DIỆN TÍCH
   * =======================================================
   */

  if (dimensions) {
    lines.push(
      `📐 DT: ${dimensions}`,
    );
  }

  /*
   * =======================================================
   * KẾT CẤU
   * =======================================================
   */

    if (structure) {
    lines.push(
      `🏢 KC: ${structure}`,
    );
  }

  /*
   * =======================================================
   * GIÁ THUÊ
   * =======================================================
   */

  const rawPrice =
    listing.price ??
    parsed.price;

  if (
    rawPrice !== null &&
    rawPrice !== undefined &&
    String(rawPrice).trim() !== ""
  ) {
    let numericPrice: number;

    if (typeof rawPrice === "number") {
      numericPrice = rawPrice;
    } else {
      const priceText =
        String(rawPrice)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

      /*
       * 13tr
       * 13 triệu
       * 13tr/tháng
       */
      const millionMatch =
        priceText.match(
          /(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|t)\b/i,
        );

      if (millionMatch) {
        numericPrice =
          Number(
            millionMatch[1].replace(",", "."),
          ) * 1_000_000;
      } else {
        numericPrice =
          Number(
            priceText
              .replace(/[^\d.,]/g, "")
              .replace(/\./g, "")
              .replace(",", "."),
          );
      }
    }

    if (
      Number.isFinite(numericPrice) &&
      numericPrice > 0
    ) {
      const millionValue =
        numericPrice / 1_000_000;

      const priceDisplay =
        Number(
          millionValue.toFixed(2),
        ).toLocaleString("vi-VN");

      lines.push("");

      lines.push(
        `💰 Giá thuê: ${priceDisplay} triệu/tháng`,
      );
    }
  }

  /*
   * =======================================================
   * PHÙ HỢP
   *
   * Một dòng ngang:
   *
   * ✅ Phù hợp: Gia đình ở - Văn phòng công ty - Spa
   *
   * Không:
   *
   * • Gia đình ở
   * • Văn phòng công ty
   * • Spa
   *
   * Không dùng "/".
   * =======================================================
   */

  if (
    suitableFor.length
  ) {
    lines.push("");

    const cleanSuitableFor =
      suitableFor
        .map((item) =>
          String(item ?? "")
            .replace(
              /^[^\p{L}\p{N}]+/u,
              "",
            )
            .trim(),
        )
        .filter(Boolean);

    /*
     * Loại duplicate nhưng vẫn giữ thứ tự.
     */
    const uniqueSuitableFor =
      [
        ...new Set(
          cleanSuitableFor,
        ),
      ];

    if (
      uniqueSuitableFor.length
    ) {
      lines.push(
        `✅ Phù hợp: ${uniqueSuitableFor.join(
          " - ",
        )}`,
      );
    }
  }

  /*
   * =======================================================
   * FINAL CONTENT
   * =======================================================
   */

  const content =
    lines
      .filter(
        (line, index) =>
          line !== "" ||
          (
            index > 0 &&
            lines[index - 1] !== ""
          ),
      )
      .join("\n")
      .trim();

  /*
   * =======================================================
   * FACEBOOK ADDRESS SAFETY CHECK
   *
   * Không cho số nhà / địa chỉ private lọt ra.
   *
   * QUAN TRỌNG:
   * Nếu listing.address chính là publicStreet,
   * sanitizeFacebookAddress() sẽ không xóa tên đường.
   * =======================================================
   */

  const safeContent =
    sanitizeFacebookAddress(
      content,
      listing,
      publicStreet,
    );

  /*
   * =======================================================
   * HASHTAGS
   * =======================================================
   */

  const hashtags =
    buildDistrictHashtags(
      listing,
    );

  /*
     /*
   * =======================================================
   * RETURN
   * =======================================================
   */

  return {
  title,
  content: [
    safeContent,
    hashtags.join(" "),
  ]
    .filter(Boolean)
    .join("\n\n"),
  publicStreet,
  district,
  ward,
  suitableFor,
  extras,
  nearbyPlaces,
};
}



/* =========================================================
   NEARBY PLACES
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
  const seen =
    new Set<string>();

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
        (ai === -1
          ? 999
          : ai) -
        (bi === -1
          ? 999
          : bi)
      );
    })
    .filter((place) => {
      const key =
        normalizeText(
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

/* =========================================================
   FINAL FACEBOOK CONTENT
   DÙNG CHUNG:
   - sync-today
   - next-job
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
   * Không dùng baseContent cũ làm template.
   *
   * Luôn build lại bằng template chuẩn.
   */
  const generated =
    buildSocialListingContent(
      input.listing,
      {
        /*
         * Vẫn truyền contactPhone
         * để không phá cấu trúc API hiện tại.
         *
         * Facebook template sử dụng
         * số cố định 0924711550.
         */
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

        /*
         * Vẫn nhận nearbyPlaces
         * nhưng không render Facebook.
         */
        nearbyPlaces:
          input.nearbyPlaces ??
          [],
      },
    );

  /*
   * Safety check lần cuối:
   * Không để số nhà lọt vào Facebook.
   */
    const safeContent =
    sanitizeFacebookAddress(
      generated.content,
      input.listing,
      generated.publicStreet,
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
  publicStreet: string | null,
): string {
  let result = String(
    content ?? "",
  );

  /*
   * Xóa nguyên địa chỉ private.
   *
   * QUAN TRỌNG:
   * Nhiều listing hiện tại lưu `address`
   * CHỈ LÀ TÊN ĐƯỜNG TRẦN (không số nhà),
   * trùng khớp với publicStreet đã hiển thị
   * hợp lệ trong content.
   *
   * Nếu address == publicStreet (sau khi
   * normalize), TUYỆT ĐỐI không được xóa,
   * nếu không sẽ xóa nhầm tên đường công khai
   * hợp lệ ra khỏi bài đăng.
   */
  const privateAddress =
    clean(listing.address);

  const isSameAsPublicStreet =
    !!publicStreet &&
    normalizeText(privateAddress) ===
      normalizeText(publicStreet);

  if (
    privateAddress &&
    !isSameAsPublicStreet
  ) {
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
   * Không cho các dạng:
   *
   * 215 Thành Công
   * 24 Hoàng Văn Thụ
   * 123A Nguyễn Trãi
   *
   * lọt vào content.
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

  /*
   * Xóa dòng XUNG QUANH nếu flow cũ somehow lọt vào.
   */
  result = result.replace(
    /^.*XUNG QUANH.*$/gimu,
    "",
  );

  /*
   * Xóa dòng Giá nếu flow cũ somehow lọt vào.
   */
  result = result.replace(
    /^.*💰\s*Giá:.*$/gimu,
    "",
  );

  /*
   * Xóa dòng Liên hệ cũ để đảm bảo
   * chỉ còn contact chuẩn.
   */
  result = result.replace(
    CONTACT_LINE_REGEX,
    "",
  );

  /*
   * Dọn whitespace.
   */
  return result
    .replace(
      /[ \t]{2,}/g,
      " ",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}

/* =========================================================
   ESCAPE REGEX
========================================================= */

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}