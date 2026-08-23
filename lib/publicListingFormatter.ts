export const PUBLIC_CONTACT_PHONE = "0946497253";

export type PublicListing = {
  publicTitle: string;
  area: string;
  structure: string;
  price: string;

  /**
   * Giữ field để không làm vỡ các component đang sử dụng.
   *
   * QUAN TRỌNG:
   * Giao diện khách tuyệt đối không được nhận SĐT thật.
   * Formatter public luôn trả chuỗi rỗng.
   */
  contactPhone: string;
};

type ListingLike = Record<string, unknown>;

/**
 * =========================================================
 * CẤU HÌNH
 * =========================================================
 */

const USD_TO_VND = 26310;

/**
 * =========================================================
 * PREFIX / LOẠI MẶT BẰNG
 * =========================================================
 *
 * Ưu tiên:
 *
 * 1. Góc 2 Mặt Tiền
 * 2. Hai Mặt Tiền
 * 3. Góc 2 Mặt Bằng
 * 4. Hai Mặt Bằng Trước Sau
 * 5. Hẻm Xe Hơi
 * 6. Hẻm Xe Tải
 * 7. Hẻm Xe Máy
 * 8. Hẻm Ba Gác
 * 9. Mặt Tiền
 * 10. Mặt Bằng
 *
 * Nếu không có prefix:
 *
 * Có "/" trong địa chỉ => Hẻm
 * Không có "/" => Mặt Tiền
 * =========================================================
 */

const PREFIX_PATTERNS: Array<[RegExp, string]> = [
  [
    /\bGÓC\s+2\s*(?:MT|MẶT\s*TIỀN)\b/iu,
    "Góc 2 Mặt Tiền",
  ],
  [
    /\b(?:2\s*MT|HAI\s+MẶT\s+TIỀN)\b/iu,
    "Hai Mặt Tiền",
  ],
  [
    /\bGÓC\s+2\s*(?:MB|MẶT\s+BẰNG)\b/iu,
    "Góc 2 Mặt Bằng",
  ],
  [
    /\b(?:2\s*MB\s+TRƯỚC\s+SAU|HAI\s+MẶT\s+BẰNG\s+TRƯỚC\s+SAU)\b/iu,
    "Hai Mặt Bằng Trước Sau",
  ],
  [
    /\b(?:HXH|HẺM\s+XE\s+HƠI)\b/iu,
    "Hẻm Xe Hơi",
  ],
  [
    /\b(?:HXT|HẺM\s+XE\s+TẢI)\b/iu,
    "Hẻm Xe Tải",
  ],
  [
    /\b(?:HXM|HẺM\s+XE\s+MÁY)\b/iu,
    "Hẻm Xe Máy",
  ],
  [
    /\b(?:H3G|HẺM\s+BA\s+GÁC)\b/iu,
    "Hẻm Ba Gác",
  ],
  [
    /\b(?:MT|MẶT\s+TIỀN)\b/iu,
    "Mặt Tiền",
  ],
  [
    /\b(?:MB|MẶT\s+BẰNG)\b/iu,
    "Mặt Bằng",
  ],
];

/**
 * Prefix nằm đầu địa chỉ.
 */
const PREFIXES_AT_START =
  /^(?:(?:HXH|HXM|HXT|H3G|2MT|2MB|MT|MB|GÓC|Hẻm\s+Xe\s+Hơi|Hẻm\s+Xe\s+Máy|Hẻm\s+Xe\s+Tải|Hẻm\s+Ba\s+Gác|Hai\s+Mặt\s+Tiền|Hai\s+Mặt\s+Bằng|Mặt\s+Bằng|Mặt\s+Tiền|Hẻm)\s*[-:–—]?\s*)+/iu;

/**
 * Các nhãn nội bộ không đưa lên public.
 */
const PRIVATE_LABEL_AT_START =
  /^(?:(?:lô\s+[\p{L}\d-]+|căn\s+[\p{L}\d-]+|mã(?:\s+nội\s+bộ)?\s+[\p{L}\d-]+|cc|số|đc)\s*[-:–—]?\s*)/iu;

/**
 * Số nhà đầu địa chỉ.
 *
 * Ví dụ:
 * 180 Hồng Bàng
 * 132-134 Bàu Cát 3
 * 12A Nguyễn Văn A
 * 12/5 Nguyễn Văn A
 */
const HOUSE_NUMBER_AT_START =
  /^\d+[A-Za-z]?(?:(?:\s*[-–]\s*\d+[A-Za-z]?)|(?:\/[A-Za-z0-9]+))?\s+/u;

/**
 * =========================================================
 * DIỆN TÍCH
 * =========================================================
 */

const SIZE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\b/iu;

/**
 * =========================================================
 * GIÁ VNĐ
 * =========================================================
 */

const PRICE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|triệu|tỷ|ty|k|nghìn|ngàn)(?!\p{L})(?:\s*\/\s*tháng)?/iu;

/**
 * =========================================================
 * GIÁ USD
 * =========================================================
 */

const USD_PRICE_PATTERN =
  /(?:\$\s*\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)*\s*(?:\$|USD|US\$|đô(?:\s*la)?|dollars?))/iu;

/**
 * =========================================================
 * PHONE
 * =========================================================
 *
 * Hỗ trợ:
 * 0902400583
 * 0902 400 583
 * 0902-400-583
 * +84902400583
 * =========================================================
 */

const PHONE_PATTERN =
  /(?:\+?84|0)(?:[\s.()-]*\d){8,10}\b/gu;

/**
 * =========================================================
 * NỘI DUNG NỘI BỘ
 * =========================================================
 *
 * Ví dụ:
 * hh1/2
 * hh1
 * hh2
 * hh5n1t
 * hh tt
 * hh báo sau
 * lh
 * sđt
 * sdt
 * nđ
 * nd
 *
 * QUAN TRỌNG:
 * Các pattern này dùng để loại khỏi dữ liệu PUBLIC.
 * =========================================================
 */

const INTERNAL_HH_PATTERN =
  /\bhh(?:\s*(?:tt|báo\s*sau))?(?:\s*\d+(?:\s*(?:n\s*\d*t|tr))?)?(?:\s*\/\s*\d+)?\b/iu;

const INTERNAL_CONTACT_PATTERN =
  /\b(?:lh|sđt|sdt|nđ|nd)\b/iu;

/**
 * =========================================================
 * CHO THUÊ / BÁN
 * =========================================================
 */

const REMOVE_RENTAL_PREFIX_PATTERN =
  /^\s*(?:cho\s+thuê|cần\s+cho\s+thuê|bán|cần\s+bán)\s*[-:,.]?\s*/iu;

/**
 * =========================================================
 * UTILITY
 * =========================================================
 */

const asText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
};

const firstContentLine = (value: string): string => {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
};

/**
 * =========================================================
 * CHUẨN HÓA TITLE
 * =========================================================
 */

const normalizePublicTitleText = (value: string): string => {
  return value
    .replace(REMOVE_RENTAL_PREFIX_PATTERN, "")
    .replace(/\s*,\s*/g, " - ")
    .replace(/\s*[-–—]+\s*/g, " - ")
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*$/g, "")
    .trim();
};

/**
 * =========================================================
 * CHUẨN HÓA QUẬN
 * =========================================================
 */

const DISTRICT_MAP: Record<string, string> = {
  "tân bình": "Quận Tân Bình",
  "tan binh": "Quận Tân Bình",

  "thủ đức": "Quận Thủ Đức",
  "thu duc": "Quận Thủ Đức",

  "gò vấp": "Quận Gò Vấp",
  "go vap": "Quận Gò Vấp",

  "bình thạnh": "Quận Bình Thạnh",
  "binh thanh": "Quận Bình Thạnh",

  "phú nhuận": "Quận Phú Nhuận",
  "phu nhuan": "Quận Phú Nhuận",

  "tân phú": "Quận Tân Phú",
  "tan phu": "Quận Tân Phú",

  "bình tân": "Quận Bình Tân",
  "binh tan": "Quận Bình Tân",

  "bình chánh": "Quận Bình Chánh",
  "binh chanh": "Quận Bình Chánh",

  "quận 1": "Quận 1",
  "q1": "Quận 1",

  "quận 2": "Quận 2",
  "q2": "Quận 2",

  "quận 3": "Quận 3",
  "q3": "Quận 3",

  "quận 4": "Quận 4",
  "q4": "Quận 4",

  "quận 5": "Quận 5",
  "q5": "Quận 5",

  "quận 6": "Quận 6",
  "q6": "Quận 6",

  "quận 7": "Quận 7",
  "q7": "Quận 7",

  "quận 8": "Quận 8",
  "q8": "Quận 8",

  "quận 9": "Quận 9",
  "q9": "Quận 9",

  "quận 10": "Quận 10",
  "q10": "Quận 10",

  "quận 11": "Quận 11",
  "q11": "Quận 11",

  "quận 12": "Quận 12",
  "q12": "Quận 12",
};

const normalizeDistrictName = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return DISTRICT_MAP[normalized] || value.trim();
};

/**
 * =========================================================
 * CHUẨN HÓA Q / P
 * =========================================================
 */

const normalizeAdministrativeAreas = (
  rawAddress: string,
): string => {
  let value = rawAddress;

  /**
   * Q.Tân Bình
   * Q. Tân Bình
   * Q5
   * Q.5
   */
  value = value.replace(
    /\bQ\s*\.?\s*(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(district),
  );

  value = value.replace(
    /\bQ\s*\.?\s*(1|2|3|4|5|6|7|8|9|10|11|12)\b/iu,
    (_match, district: string) =>
      `Quận ${district}`,
  );

  value = value.replace(
    /\bQuận\s+(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(district),
  );

  /**
   * Phường 14 -> P.14
   * P.14 -> P.14
   */
  value = value.replace(
    /\bPhường\s+(\d+)\b/iu,
    "P.$1",
  );

  value = value.replace(
    /\bP\s*\.?\s*(\d+)\b/iu,
    "P.$1",
  );

  return value
    .replace(/\s*,\s*/g, " - ")
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    .trim();
};

/**
 * =========================================================
 * DETECT PREFIX
 * =========================================================
 */

const detectExplicitPrefix = (
  rawText: string,
): string => {
  const text = asText(rawText);

  for (const [pattern, label] of PREFIX_PATTERNS) {
    pattern.lastIndex = 0;

    if (pattern.test(text)) {
      return label;
    }
  }

  return "";
};

/**
 * =========================================================
 * ĐỊA CHỈ CÓ PHẢI HẺM?
 * =========================================================
 */

const hasAddressSlash = (
  rawAddress: string,
): boolean => {
  const addressLine = firstContentLine(rawAddress);

  return /\//u.test(addressLine);
};

/**
 * =========================================================
 * DETECT SỐ NHÀ
 * =========================================================
 */

const hasLeadingHouseNumber = (
  rawAddress: string,
): boolean => {
  let value = firstContentLine(rawAddress)
    .replace(PREFIXES_AT_START, "")
    .trim();

  for (let index = 0; index < 8; index += 1) {
    const nextValue = value
      .replace(PRIVATE_LABEL_AT_START, "")
      .trim();

    if (nextValue === value) {
      break;
    }

    value = nextValue;
  }

  return /^\d+\b/u.test(value);
};

/**
 * =========================================================
 * PUBLIC PREFIX
 * =========================================================
 */

export function detectListingPrefix(
  rawText: string,
): string {
  const text = asText(rawText);

  const explicitPrefix =
    detectExplicitPrefix(text);

  if (explicitPrefix) {
    return explicitPrefix;
  }

  return hasAddressSlash(text)
    ? "Hẻm"
    : "Mặt Tiền";
}

/**
 * =========================================================
 * BỎ THÔNG TIN PRIVATE KHỎI ĐỊA CHỈ
 * =========================================================
 */

const stripLeadingPrivateParts = (
  rawAddress: string,
): string => {
  let value = rawAddress.trim();

  for (let index = 0; index < 10; index += 1) {
    const previous = value;

    value = value
      .replace(PREFIXES_AT_START, "")
      .replace(PRIVATE_LABEL_AT_START, "")
      .replace(HOUSE_NUMBER_AT_START, "")
      .trim();

    if (value === previous) {
      break;
    }
  }

  return value;
};

/**
 * =========================================================
 * TÁCH QUẬN Ở CUỐI ĐỊA CHỈ
 * =========================================================
 */

const extractDistrictFromAddress = (
  address: string,
): {
  street: string;
  district: string;
} => {
  const value = normalizeAdministrativeAreas(address)
    .trim();

  /**
   * Có chữ Quận:
   *
   * Lê Văn Sỹ - Quận Tân Bình
   */
  const explicitDistrictRegex =
    /(?:^|[\s,-]+)(Quận\s+(?:\d+|Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh))\s*$/iu;

  const explicitMatch =
    value.match(explicitDistrictRegex);

  if (explicitMatch?.[1]) {
    const district =
      normalizeDistrictName(
        explicitMatch[1],
      );

    const street = value
      .slice(
        0,
        explicitMatch.index ?? value.length,
      )
      .replace(/[\s,-]+$/u, "")
      .trim();

    return {
      street,
      district,
    };
  }

  /**
   * Tên quận không có chữ "Quận":
   *
   * Lê Văn Việt Thủ Đức
   * Lê Văn Sỹ Tân Bình
   */
  const aliases = Object.keys(DISTRICT_MAP)
    .filter(
      (key) =>
        !key.startsWith("quận ") &&
        !key.startsWith("q"),
    )
    .sort(
      (a, b) =>
        b.length - a.length,
    );

  for (const alias of aliases) {
    const escaped = alias.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const regex = new RegExp(
      `(?:^|[\\s,-]+)(${escaped})\\s*$`,
      "iu",
    );

    const match = value.match(regex);

    if (!match?.[1]) {
      continue;
    }

    const district =
      normalizeDistrictName(match[1]);

    const street = value
      .slice(
        0,
        match.index ?? value.length,
      )
      .replace(/[\s,-]+$/u, "")
      .trim();

    if (street) {
      return {
        street,
        district,
      };
    }
  }

  return {
    street: value,
    district: "",
  };
};

/**
 * =========================================================
 * TẠO TITLE PUBLIC
 * =========================================================
 */

const sanitizeAddressWithContext = (
  rawAddressOrTitle: string,
  context: string,
): string => {
  const addressLine =
    firstContentLine(rawAddressOrTitle);

  if (!addressLine) {
    return "";
  }

  /**
   * Prefix:
   *
   * explicit prefix -> ưu tiên
   * "/" -> Hẻm
   * không "/" -> Mặt Tiền
   */
  const prefix =
    detectExplicitPrefix(context) ||
    (hasAddressSlash(addressLine)
      ? "Hẻm"
      : "Mặt Tiền");

  /**
   * Xóa phone khỏi address.
   */
  const cleanedAddress = addressLine
    .replace(PHONE_PATTERN, "")
    .replace(INTERNAL_HH_PATTERN, "")
    .replace(INTERNAL_CONTACT_PATTERN, "")
    .trim();

  /**
   * Bỏ prefix / số nhà / mã nội bộ.
   */
  let strippedAddress =
    stripLeadingPrivateParts(
      cleanedAddress,
    );

  /**
   * Chuẩn hóa Q/P.
   */
  strippedAddress =
    normalizeAdministrativeAreas(
      strippedAddress,
    );

  /**
   * Tách quận.
   */
  const districtResult =
    extractDistrictFromAddress(
      strippedAddress,
    );

  let street =
    districtResult.street;

  let district =
    districtResult.district;

  /**
   * Fallback tìm Quận lần cuối.
   */
  if (!district) {
    const match = street.match(
      /(?:^|[\s,-]+)(Quận\s+.+)$/iu,
    );

    if (match?.[1]) {
      district =
        normalizeDistrictName(
          match[1],
        );

      street = street
        .slice(
          0,
          match.index ?? street.length,
        )
        .replace(/[\s,-]+$/u, "")
        .trim();
    }
  }

  street =
    normalizePublicTitleText(street);

  street = street
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    .trim();

  return [
    prefix,
    street,
    district,
  ]
    .filter(Boolean)
    .join(" - ")
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * =========================================================
 * PUBLIC ADDRESS API
 * =========================================================
 */

export function sanitizePublicAddress(
  rawAddressOrTitle: string,
): string {
  const text =
    asText(rawAddressOrTitle);

  return sanitizeAddressWithContext(
    text,
    text,
  );
}

/**
 * =========================================================
 * USD -> VNĐ
 * =========================================================
 */

const convertUsdToVnd = (
  usd: number,
): string => {
  const vnd =
    Math.round(
      usd * USD_TO_VND,
    );

  return `${vnd.toLocaleString(
    "vi-VN",
  )} VNĐ`;
};

/**
 * =========================================================
 * PARSE USD
 * =========================================================
 */

const parseUsdNumber = (
  value: string,
): number => {
  const normalized = value
    .trim()
    .replace(/\s/g, "");

  if (!normalized) {
    return 0;
  }

  /**
   * Có cả "." và ","
   */
  if (
    normalized.includes(".") &&
    normalized.includes(",")
  ) {
    const lastDot =
      normalized.lastIndexOf(".");

    const lastComma =
      normalized.lastIndexOf(",");

    /**
     * 5.000,50
     */
    if (lastComma > lastDot) {
      return (
        Number(
          normalized
            .replace(/\./g, "")
            .replace(",", "."),
        ) || 0
      );
    }

    /**
     * 5,000.50
     */
    return (
      Number(
        normalized.replace(/,/g, ""),
      ) || 0
    );
  }

  /**
   * 5.000 -> 5000
   */
  if (
    /^\d{1,3}(?:\.\d{3})+$/u.test(
      normalized,
    )
  ) {
    return (
      Number(
        normalized.replace(/\./g, ""),
      ) || 0
    );
  }

  /**
   * 5,000 -> 5000
   */
  if (
    /^\d{1,3}(?:,\d{3})+$/u.test(
      normalized,
    )
  ) {
    return (
      Number(
        normalized.replace(/,/g, ""),
      ) || 0
    );
  }

  return Number(normalized) || 0;
};

/**
 * =========================================================
 * CONVERT USD TRONG TEXT
 * =========================================================
 */

const convertUsdPricesInText = (
  text: string,
): string => {
  return text.replace(
    USD_PRICE_PATTERN,
    (fullMatch) => {
      const numberPart =
        fullMatch.replace(
          /[^\d.,]/g,
          "",
        );

      const usd =
        parseUsdNumber(numberPart);

      if (!usd) {
        return fullMatch;
      }

      return convertUsdToVnd(usd);
    },
  );
};

/**
 * =========================================================
 * EXTRACT PUBLIC PRICE
 * =========================================================
 */

export function extractPublicPrice(
  rawText: string,
): string {
  const text =
    asText(rawText);

  /**
   * USD ưu tiên.
   */
  const usdMatch =
    text.match(
      USD_PRICE_PATTERN,
    );

  if (usdMatch?.[0]) {
    const numberPart =
      usdMatch[0].replace(
        /[^\d.,]/g,
        "",
      );

    const usd =
      parseUsdNumber(numberPart);

    if (usd > 0) {
      return convertUsdToVnd(usd);
    }
  }

  /**
   * Giá VNĐ.
   */
  const match =
    text.match(
      PRICE_PATTERN,
    );

  if (!match?.[0]) {
    return "";
  }

  return match[0]
    .replace(/\s+/g, "")
    .replace(/\/tháng/iu, "/tháng");
}

/**
 * =========================================================
 * EXTRACT SIZE
 * =========================================================
 */

export function extractPublicSize(
  rawText: string,
): string {
  const match =
    asText(rawText).match(
      SIZE_PATTERN,
    );

  return (
    match?.[0]
      .replace(
        /\s*[xX×]\s*/u,
        "x",
      )
      .replace(/\s+/g, "")
      .replace(/m$/iu, "") || ""
  );
};

/**
 * =========================================================
 * SANITIZE STRUCTURE PUBLIC
 * =========================================================
 *
 * Đây là phần QUAN TRỌNG NHẤT.
 *
 * Input:
 *
 * 4x12 trệt 2 lầu 4pn 3wc 15tr hh1/2 0902400583
 *
 * Output:
 *
 * trệt 2 lầu 4pn 3wc
 *
 * Tuyệt đối không để:
 * - giá
 * - USD
 * - hh
 * - phone
 * - lh
 * - sđt
 * - sdt
 * - nđ
 * - nd
 * =========================================================
 */

const sanitizePublicStructure = (
  rawStructure: string,
): string => {
  let structure =
    asText(rawStructure);

  if (!structure) {
    return "";
  }

  /**
   * Xóa toàn bộ phone.
   */
  structure =
    structure.replace(
      PHONE_PATTERN,
      " ",
    );

  /**
   * Xóa giá VNĐ.
   */
  structure =
    structure.replace(
      PRICE_PATTERN,
      " ",
    );

  /**
   * Xóa giá USD.
   */
  structure =
    structure.replace(
      USD_PRICE_PATTERN,
      " ",
    );

  /**
   * Xóa hoa hồng.
   */
  structure =
    structure.replace(
      INTERNAL_HH_PATTERN,
      " ",
    );

  /**
   * Xóa từ khóa liên hệ.
   */
  structure =
    structure.replace(
      INTERNAL_CONTACT_PATTERN,
      " ",
    );

  /**
   * Nếu nội dung có:
   *
   * hh1/2 090...
   *
   * các phần đã được xóa phía trên.
   */

  /**
   * Xóa "kết cấu:" / "kc:"
   */
  structure =
    structure.replace(
      /^\s*(?:kết\s*cấu|kc)\s*:\s*/iu,
      "",
    );

  /**
   * Xóa size ở đầu structure nếu có.
   *
   * Ví dụ:
   * 4x12 trệt 2 lầu
   *
   * -> trệt 2 lầu
   */
  structure =
    structure.replace(
      /^\s*\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\s*/iu,
      "",
    );

  /**
   * Dọn khoảng trắng / dấu câu.
   */
  structure =
    structure
      .replace(/\s+/g, " ")
      .replace(/^[\s,;:.-]+/u, "")
      .replace(/[\s,;:.-]+$/u, "")
      .trim();

  return structure;
};

/**
 * =========================================================
 * EXTRACT STRUCTURE
 * =========================================================
 */

export function extractPublicStructure(
  rawText: string,
): string {
  const text = asText(rawText);

  const sizeMatch = SIZE_PATTERN.exec(text);

  if (
    !sizeMatch ||
    sizeMatch.index === undefined
  ) {
    return "";
  }

  let structure = text.slice(
    sizeMatch.index + sizeMatch[0].length,
  );

  /**
   * =========================================================
   * XÓA THÔNG TIN NỘI BỘ KHÔNG ĐƯỢC HIỂN THỊ CHO KHÁCH
   * =========================================================
   *
   * Ví dụ:
   *
   * 4x12 trệt 2 lầu 4pn 3wc 15tr hh1/2 0902400583
   *
   * Khách chỉ được thấy:
   *
   * trệt 2 lầu 4pn 3wc
   *
   * Không được lộ:
   * - giá
   * - hoa hồng
   * - số điện thoại
   * - thông tin liên hệ nội bộ
   *
   * Quy tắc hoa hồng:
   *
   * Chỉ cần có "hh" là coi là thông tin hoa hồng.
   *
   * Ví dụ:
   * hh1T
   * hh1/2
   * hh5
   * hh10%
   * hh báo sau
   * hh
   *
   * => cắt từ "hh" trở đi.
   * =========================================================
   */

  const hiddenInfoPatterns: RegExp[] = [
    // Giá VNĐ
    PRICE_PATTERN,

    // Giá USD
    USD_PRICE_PATTERN,

    // Số điện thoại
    PHONE_PATTERN,

    // HOA HỒNG
    // Chỉ cần gặp "hh" là cắt phần còn lại.
    /\bhh\b/iu,

    // Thông tin liên hệ nội bộ
    /\blh\b/iu,
    /\bsđt\b/iu,
    /\bsdt\b/iu,
    /\bnđ\b/iu,
    /\bnd\b/iu,

    // Chữ "hoa hồng"
    /\bhoa\s+hồng\b/iu,
  ];

  let endIndex = structure.length;

  for (const pattern of hiddenInfoPatterns) {
    pattern.lastIndex = 0;

    const match = pattern.exec(structure);

    if (
      match?.index !== undefined &&
      match.index < endIndex
    ) {
      endIndex = match.index;
    }
  }

  structure = structure.slice(0, endIndex);

  /**
   * =========================================================
   * CHUẨN HÓA STRUCTURE
   * =========================================================
   */

  structure = structure
    .replace(
      /^\s*(?:kết\s*cấu|kc)\s*:\s*/iu,
      "",
    )
    .replace(
      /^[\s,;:.-]+|[\s,;:.-]+$/gu,
      "",
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();

  return structure;
}

/**
 * =========================================================
 * FORMAT GIÁ TỪ DB
 * =========================================================
 */

const formatNumericPrice = (
  value: unknown,
): string => {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "Liên hệ";
  }

  /**
   * >= 1 tỷ
   */
  if (
    number >= 1_000_000_000
  ) {
    const ty =
      number /
      1_000_000_000;

    return `${Number(
      ty.toFixed(2),
    ).toLocaleString(
      "vi-VN",
    )} Tỷ`;
  }

  /**
   * >= 1 triệu
   */
  if (
    number >= 1_000_000
  ) {
    const trieu =
      number /
      1_000_000;

    return `${Number(
      trieu.toFixed(2),
    ).toLocaleString(
      "vi-VN",
    )} Triệu`;
  }

  return `${number.toLocaleString(
    "vi-VN",
  )} VNĐ`;
};

/**
 * =========================================================
 * FORMAT PUBLIC LISTING
 * =========================================================
 *
 * NGUYÊN TẮC:
 *
 * raw -> extract -> sanitize -> public
 *
 * Không trả raw ra frontend.
 * =========================================================
 */

export function formatPublicListing(
  listing: ListingLike,
): PublicListing {
  const title =
    asText(listing.title);

  const address =
    asText(listing.address);

  const description =
    asText(listing.description);

  const rawInput =
    asText(listing.raw_input);

  /**
   * Gom nguồn dữ liệu.
   */
  const distinctParts = [
    title,
    address,
    description,
    rawInput,
  ].filter(
    (part, index, parts) =>
      part &&
      parts.indexOf(part) === index,
  );

  const rawText =
    distinctParts.join("\n");

  /**
   * Title ưu tiên title -> address.
   */
  const addressSource =
    title || address;

  /**
   * =======================================================
   * DIỆN TÍCH
   * =======================================================
   */

  const extractedArea =
    extractPublicSize(
      rawText,
    );

  const structuredArea =
    asText(listing.area);

  const dimensions =
    asText(listing.width) &&
    asText(listing.length)
      ? `${asText(
          listing.width,
        )}x${asText(
          listing.length,
        )}`
      : "";

  /**
   * =======================================================
   * CẤU TRÚC
   * =======================================================
   */

  const extractedStructure =
    extractPublicStructure(
      rawText,
    );

  const structuredStructure =
    asText(listing.structure);

  /**
   * Nếu structure lấy trực tiếp từ DB,
   * vẫn phải sanitize trước khi trả frontend.
   */
  const publicStructuredStructure =
    sanitizePublicStructure(
      structuredStructure,
    );

  /**
   * =======================================================
   * GIÁ
   * =======================================================
   */

  const extractedPrice =
    extractPublicPrice(
      rawText,
    );

  const numericListingPrice =
    Number(listing.price);

  const hasNumericListingPrice =
    Number.isFinite(
      numericListingPrice,
    ) &&
    numericListingPrice > 0;

  const publicPrice =
    hasNumericListingPrice
      ? formatNumericPrice(
          numericListingPrice,
        )
      : extractedPrice ||
        formatNumericPrice(
          listing.price,
        );

  /**
   * =======================================================
   * STRUCTURE PUBLIC
   * =======================================================
   *
   * Tuyệt đối không để:
   *
   * 15tr
   * hh1/2
   * 0902400583
   *
   * kể cả khi structure đến trực tiếp từ DB.
   */

  const publicStructure =
    convertUsdPricesInText(
      sanitizePublicStructure(
        extractedStructure ||
          publicStructuredStructure,
      ),
    );

  /**
   * =======================================================
   * RETURN
   * =======================================================
   *
   * contactPhone cố tình để "".
   *
   * Không đưa PUBLIC_CONTACT_PHONE vào object public.
   */
  return {
    publicTitle:
      sanitizeAddressWithContext(
        addressSource,
        rawText,
      ),

    area:
      extractedArea ||
      dimensions ||
      structuredArea,

    structure:
      publicStructure,

    price:
      publicPrice,

    /**
     * KHÔNG LỘ SĐT KHÁCH.
     */
    contactPhone: "",
  };
}