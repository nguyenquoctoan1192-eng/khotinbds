export const PUBLIC_CONTACT_PHONE = "0946497253";

export type PublicListing = {
  publicTitle: string;
  area: string;
  structure: string;
  price: string;

  /**
   * Bề ngang mặt tiền (m)
   */
  frontageWidth: number | null;

  /**
   * Số tầng.
   */
  floors: number | null;

  /**
   * SĐT công khai của hệ thống.
   */
  contactPhone: string;
};

type ListingLike = Record<string, unknown>;

/* =========================================================
   CONFIG
========================================================= */

const USD_TO_VND = 26310;

/* =========================================================
   PREFIX / LOẠI VỊ TRÍ
========================================================= */

const PREFIX_PATTERNS: Array<[RegExp, string]> = [
  [
    /\bGÓC\s+2\s*(?:MT|MẶT\s+TIỀN)\b/iu,
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
    /\bGÓC\b/iu,
    "Góc",
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
 * Prefix chỉ được xóa khi nó nằm ở ĐẦU dòng.
 */
const PREFIXES_AT_START =
  /^(?:(?:HXH|HXM|HXT|H3G|2MT|2MB|MT|MB|GÓC|Hẻm\s+Xe\s+Hơi|Hẻm\s+Xe\s+Máy|Hẻm\s+Xe\s+Tải|Hẻm\s+Ba\s+Gác|Hai\s+Mặt\s+Tiền|Hai\s+Mặt\s+Bằng|Mặt\s+Bằng|Mặt\s+Tiền|Hẻm)\s*[-:–—]?\s*)+/iu;

/* =========================================================
   PRIVATE LABEL
========================================================= */

const PRIVATE_LABEL_AT_START =
  /^(?:(?:lô\s+[\p{L}\d-]+|căn\s+[\p{L}\d-]+|mã(?:\s+nội\s+bộ)?\s+[\p{L}\d-]+|cc|số|đc)\s*[-:–—]?\s*)/iu;

/* =========================================================
   SỐ NHÀ
========================================================= */

/**
 * Một token số nhà.
 *
 * Hỗ trợ:
 *
 * 541
 * 541A
 * 541/
 * 541/3
 * 243/1/4
 * 26A-B
 * 26A-Bis
 * 282bis
 */
const HOUSE_NUMBER_TOKEN =
  String.raw`\d+[A-Za-z]*(?:[-/][A-Za-z0-9]+)*\/?`;

/**
 * Toàn bộ cụm số nhà ở đầu dòng.
 *
 * Hỗ trợ:
 *
 * 34 36 38 Nguyễn Trãi
 * 157 159 161 Hoàng Văn Thụ
 * 541/3 Nguyễn Tri Phương
 * 243/1/4 Tô Hiến Thành
 * 26A-B Tân Hòa Đông
 * 282bis Cống Quỳnh
 * 541/ Nguyễn Tri Phương
 */
const HOUSE_NUMBER_PREFIX_PATTERN =
  new RegExp(
    String.raw`^((?:${HOUSE_NUMBER_TOKEN})(?:\s+(?:${HOUSE_NUMBER_TOKEN}))*)\s+`,
    "iu",
  );

/**
 * Một dòng bắt đầu bằng số nhà.
 */
const HOUSE_NUMBER_LINE_PATTERN =
  new RegExp(
    String.raw`^${HOUSE_NUMBER_TOKEN}(?=\s|,|$)`,
    "iu",
  );

/**
 * Capture cụm số nhà.
 *
 * Ví dụ:
 *
 * 34 36 38 Nguyễn Trãi
 * capture = "34 36 38"
 *
 * 541/3 Nguyễn Tri Phương
 * capture = "541/3"
 */
const HOUSE_NUMBER_CAPTURE_AT_START =
  new RegExp(
    String.raw`^((?:${HOUSE_NUMBER_TOKEN})(?:\s+(?:${HOUSE_NUMBER_TOKEN}))*)(?=\s|,|$)`,
    "iu",
  );

/**
 * Regex xóa số nhà ở đầu địa chỉ.
 */
const HOUSE_NUMBER_AT_START =
  new RegExp(
    String.raw`^((?:${HOUSE_NUMBER_TOKEN})(?:\s+(?:${HOUSE_NUMBER_TOKEN}))*)\s*[-:,.]?\s*`,
    "iu",
  );

/**
 * Chuẩn hóa:
 *
 * 541/ 3 Nguyễn Tri Phương
 * → 541/3 Nguyễn Tri Phương
 *
 * 541/ Nguyễn Tri Phương
 * → 541/ Nguyễn Tri Phương
 */
const normalizeHouseNumberSpacing = (
  value: string,
): string => {
  return value
    .replace(
      /^(\d+[A-Za-z]*)\s*\/\s*(?=\d)/u,
      "$1/",
    )
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Bỏ toàn bộ số nhà đứng đầu địa chỉ.
 *
 * Đây là lớp bảo vệ chính cho publicTitle.
 */
const stripLeadingHouseNumbers = (
  rawAddress: string,
): string => {
  let value = normalizeHouseNumberSpacing(
    rawAddress.trim(),
  );

  for (let index = 0; index < 5; index += 1) {
    const match = value.match(
      HOUSE_NUMBER_PREFIX_PATTERN,
    );

    if (!match?.[0]) {
      break;
    }

    const nextValue = value
      .slice(match[0].length)
      .trim();

    if (!nextValue || nextValue === value) {
      break;
    }

    value = nextValue;
  }

  return value;
};

/**
 * Tìm dòng có số nhà trong toàn bộ dữ liệu.
 */
const findLeadingHouseNumberLine = (
  rawText: string,
): string | null => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const stripped = line
      .replace(
        PREFIXES_AT_START,
        "",
      )
      .replace(
        PRIVATE_LABEL_AT_START,
        "",
      )
      .trim();

    const normalized =
      normalizeHouseNumberSpacing(
        stripped,
      );

    if (
      HOUSE_NUMBER_LINE_PATTERN.test(
        normalized,
      )
    ) {
      return normalized;
    }
  }

  return null;
};

/**
 * Có "/" trong số nhà hay không.
 *
 * Có "/" → Hẻm.
 *
 * 541/3 Nguyễn Tri Phương
 * 243/1/4 Tô Hiến Thành
 *
 * Không "/" → Mặt Tiền nếu không có prefix explicit.
 *
 * 34 36 38 Nguyễn Trãi
 * 26A-B Tân Hòa Đông
 */
const hasAddressSlash = (
  rawText: string,
): boolean => {
  const houseNumberLine =
    findLeadingHouseNumberLine(
      rawText,
    );

  if (!houseNumberLine) {
    return false;
  }

  const stripped =
    houseNumberLine
      .replace(
        PREFIXES_AT_START,
        "",
      )
      .replace(
        PRIVATE_LABEL_AT_START,
        "",
      )
      .trim();

  const match = stripped.match(
    new RegExp(
      String.raw`^${HOUSE_NUMBER_TOKEN}`,
      "iu",
    ),
  );

  if (!match?.[0]) {
    return false;
  }

  return match[0].includes("/");
};

/* =========================================================
   DIỆN TÍCH
========================================================= */

const SIZE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\b/iu;

const TOTAL_AREA_PATTERN =
  /\b(\d+(?:[.,]\d+)?)\s*m\s*2\b|\b(\d+(?:[.,]\d+)?)\s*m²\b/iu;

const FLOOR_COUNT_PATTERN =
  /(\d+)\s*(?:lầu|tầng)\b/iu;

const HAS_TRET_PATTERN =
  /\btrệt\b/iu;

/* =========================================================
   GIÁ VNĐ
========================================================= */

const PRICE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|triệu|tỷ|ty|k|nghìn|ngàn)(?!\p{L})(?:\s*\/\s*tháng)?/iu;

/* =========================================================
   GIÁ USD
========================================================= */

const USD_PRICE_PATTERN =
  /(?:\$\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:\$|USD|US\$|đô(?:\s*la)?|dollars?))/iu;

/* =========================================================
   PHONE
========================================================= */

const PHONE_PATTERN =
  /(?:\+?84|0)(?:[\s.()-]*\d){8,10}\b/gu;

/* =========================================================
   NỘI DUNG NỘI BỘ
========================================================= */

const INTERNAL_HH_PATTERN =
  /\bhh(?:\s*(?:tt|báo\s*sau))?(?:\s*\d+(?:\s*(?:n\s*\d*t|tr))?)?(?:\s*\/\s*\d+)?\b/iu;

const INTERNAL_CONTACT_PATTERN =
  /\b(?:lh|sđt|sdt|nđ|nd)\b/iu;

/* =========================================================
   CHO THUÊ / BÁN
========================================================= */

const REMOVE_RENTAL_PREFIX_PATTERN =
  /^\s*(?:cho\s+thuê|cần\s+cho\s+thuê|bán|cần\s+bán)\s*[-:,.]?\s*/iu;

/* =========================================================
   TÍN HIỆU QUẬN / PHƯỜNG
========================================================= */

const DISTRICT_SIGNAL_PATTERN =
  /\bq(?:uận)?\.?\s*(?:\d+|Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu;

const WARD_SIGNAL_PATTERN =
  /\b(?:p(?:hường)?\.?\s*\d+|phường\s+\d+)\b/iu;

/* =========================================================
   UTILITY
========================================================= */

const asText = (
  value: unknown,
): string => {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value).trim();
  }

  return "";
};

const asNumber = (
  value: unknown,
): number | null => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const firstContentLine = (
  value: string,
): string => {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
};

/* =========================================================
   CHUẨN HÓA TITLE TEXT
========================================================= */

const normalizePublicTitleText = (
  value: string,
): string => {
  return value
    .replace(
      REMOVE_RENTAL_PREFIX_PATTERN,
      "",
    )
    .replace(/[,\s]+(?=P\.)/giu, " - ")
    .replace(/[,\s]+(?=Quận\b)/iu, " - ")
    .replace(/[,\s]+(?=Q\.)/giu, " - ")
    .replace(/\s*[-–—]+\s*/g, " - ")
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*$/g, "")
    .trim();
};

/**
 * Viết hoa chữ cái đầu mỗi từ.
 */
const toTitleCaseWords = (
  value: string,
): string => {
  return value
    .split(/\s+/)
    .map((word) => {
      if (!word) {
        return word;
      }

      const lower =
        word.toLocaleLowerCase(
          "vi-VN",
        );

      return (
        lower.charAt(0).toLocaleUpperCase(
          "vi-VN",
        ) +
        lower.slice(1)
      );
    })
    .join(" ");
};

/* =========================================================
   CHUẨN HÓA QUẬN
========================================================= */

const DISTRICT_MAP: Record<
  string,
  string
> = {
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
  q1: "Quận 1",

  "quận 2": "Quận 2",
  q2: "Quận 2",

  "quận 3": "Quận 3",
  q3: "Quận 3",

  "quận 4": "Quận 4",
  q4: "Quận 4",

  "quận 5": "Quận 5",
  q5: "Quận 5",

  "quận 6": "Quận 6",
  q6: "Quận 6",

  "quận 7": "Quận 7",
  q7: "Quận 7",

  "quận 8": "Quận 8",
  q8: "Quận 8",

  "quận 9": "Quận 9",
  q9: "Quận 9",

  "quận 10": "Quận 10",
  q10: "Quận 10",

  "quận 11": "Quận 11",
  q11: "Quận 11",

  "quận 12": "Quận 12",
  q12: "Quận 12",
};

const normalizeDistrictName = (
  value: string,
): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");

  return (
    DISTRICT_MAP[normalized] ||
    value.trim()
  );
};

/* =========================================================
   CHUẨN HÓA Q / P
========================================================= */

const normalizeAdministrativeAreas = (
  rawAddress: string,
): string => {
  let value = rawAddress;

  /* Q.Tân Bình / Q Tân Bình */
  value = value.replace(
    /\bQ\.?\s*(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(
        district,
      ),
  );

  /* Q.1 → Quận 1 */
  value = value.replace(
    /\bQ\.?\s*(1|2|3|4|5|6|7|8|9|10|11|12)\b/iu,
    (_match, district: string) =>
      `Quận ${district}`,
  );

  /* Quận Tân Bình → chuẩn hóa */
  value = value.replace(
    /\bQuận\s+(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(
        district,
      ),
  );

  /* Phường 8 → P.8 */
  value = value.replace(
    /\bPhường\s+(\d+)\b/iu,
    "P.$1",
  );

  /* P 8 / P.8 → P.8 */
  value = value.replace(
    /\bP\.?\s*(\d+)\b/iu,
    "P.$1",
  );

  return value
    .replace(/\s*,\s*/g, " - ")
    .replace(/\s*[-–—]+\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    .trim();
};

/* =========================================================
   DETECT PREFIX
========================================================= */

const detectExplicitPrefix = (
  rawText: string,
): string => {
  const text = asText(rawText);

  for (const [
    pattern,
    label,
  ] of PREFIX_PATTERNS) {
    pattern.lastIndex = 0;

    if (pattern.test(text)) {
      return label;
    }
  }

  return "";
};

/* =========================================================
   XÁC ĐỊNH HẺM / MẶT TIỀN
========================================================= */

export const detectListingPrefix = (
  rawText: string,
): string => {
  const text = asText(rawText);

  /*
   * Explicit prefix luôn được ưu tiên.
   *
   * HXH → Hẻm Xe Hơi
   * HXT → Hẻm Xe Tải
   * HXM → Hẻm Xe Máy
   * H3G → Hẻm Ba Gác
   * MT  → Mặt Tiền
   * MB  → Mặt Bằng
   */

  const explicitPrefix =
    detectExplicitPrefix(text);

  if (explicitPrefix) {
    return explicitPrefix;
  }

  /*
   * Không có prefix:
   *
   * 541/3 Nguyễn Tri Phương
   * → Hẻm
   *
   * 243/1/4 Tô Hiến Thành
   * → Hẻm
   *
   * 34 36 38 Nguyễn Trãi
   * → Mặt Tiền
   *
   * 26A-B Tân Hòa Đông
   * → Mặt Tiền
   */

  return hasAddressSlash(text)
    ? "Hẻm"
    : "Mặt Tiền";
};

/* =========================================================
   BỎ PRIVATE + SỐ NHÀ
========================================================= */

const stripLeadingPrivateParts = (
  rawAddress: string,
): string => {
  let value = rawAddress.trim();

  for (
    let index = 0;
    index < 15;
    index += 1
  ) {
    const previous = value;

    value = normalizeHouseNumberSpacing(
      value
        .replace(
          PREFIXES_AT_START,
          "",
        )
        .replace(
          PRIVATE_LABEL_AT_START,
          "",
        )
        .replace(
          HOUSE_NUMBER_AT_START,
          "",
        )
        .trim(),
    );

    if (value === previous) {
      break;
    }
  }

  return value;
};

/* =========================================================
   TÁCH QUẬN
========================================================= */

const extractDistrictFromAddress = (
  address: string,
): {
  street: string;
  district: string;
} => {
  const value =
    normalizeAdministrativeAreas(
      address,
    ).trim();

  /*
   * Quận dạng:
   *
   * Quận 1
   * Quận Tân Bình
   * Quận Gò Vấp
   */
  const explicitDistrictRegex =
    /(?:^|[\s,-]+)(Quận\s+(?:\d+|Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh))\s*$/iu;

  const explicitMatch =
    value.match(
      explicitDistrictRegex,
    );

  if (explicitMatch?.[1]) {
    const district =
      normalizeDistrictName(
        explicitMatch[1],
      );

    const street = value
      .slice(
        0,
        explicitMatch.index ??
          value.length,
      )
      .replace(/[\s,-]+$/u, "")
      .trim();

    return {
      street,
      district,
    };
  }

  /*
   * Q.1 / Q1 đã được normalize thành
   * Quận 1 ở phía trên.
   *
   * Với các quận chữ:
   *
   * Quận Tân Bình
   * Quận Gò Vấp
   */
  const districtKeys = Object.keys(
    DISTRICT_MAP,
  ).filter(
    (key) =>
      !/^q\d+$/i.test(key) &&
      !/^quận\s+\d+$/iu.test(key),
  );

  districtKeys.sort(
    (a, b) => b.length - a.length,
  );

  for (const alias of districtKeys) {
    const escaped =
      alias.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

    const regex = new RegExp(
      `(?:^|[\\s,-]+)(${escaped})\\s*$`,
      "iu",
    );

    const match =
      value.match(regex);

    if (!match?.[1]) {
      continue;
    }

    const district =
      normalizeDistrictName(
        match[1],
      );

    const street = value
      .slice(
        0,
        match.index ??
          value.length,
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

/* =========================================================
   TÁCH PHƯỜNG
========================================================= */

const extractWardFromAddress = (
  address: string,
): {
  street: string;
  ward: string;
} => {
  let value =
    normalizeAdministrativeAreas(
      address,
    ).trim();

  const wardRegex =
    /(?:^|[\s,-]+)(P\.\d+)\s*$/iu;

  const match =
    value.match(wardRegex);

  if (!match?.[1]) {
    return {
      street: value,
      ward: "",
    };
  }

  const ward =
    match[1]
      .replace(/\s+/g, "")
      .toUpperCase();

  const street = value
    .slice(
      0,
      match.index ??
        value.length,
    )
    .replace(/[\s,-]+$/u, "")
    .trim();

  return {
    street,
    ward,
  };
};

/* =========================================================
   CHUẨN HÓA TÊN ĐƯỜNG
========================================================= */

const cleanStreetName = (
  rawStreet: string,
): string => {
  let street = rawStreet
    .replace(
      PREFIXES_AT_START,
      "",
    )
    .replace(
      PRIVATE_LABEL_AT_START,
      "",
    )
    .trim();

  /*
   * BẢO VỆ CUỐI CÙNG:
   *
   * Không bao giờ cho số nhà lọt vào street.
   */
  street =
    stripLeadingHouseNumbers(
      street,
    );

  /*
   * Xóa dấu phân cách dư.
   */
  street = street
    .replace(/^[\s,./-]+/u, "")
    .replace(/[\s,./-]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCaseWords(
    street,
  );
};

/* =========================================================
   CHỌN DÒNG ĐỊA CHỈ TỐT NHẤT
========================================================= */

const selectBestAddressLine = (
  rawText: string,
): string => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  type Candidate = {
    line: string;
    score: number;
  };

  const candidates: Candidate[] =
    [];

  for (const line of lines) {
    /*
     * Bỏ dòng kích thước.
     */
    if (
      /^\s*\d+(?:[.,]\d+)?\s*[xX×]/u.test(
        line,
      )
    ) {
      continue;
    }

    /*
     * Bỏ dòng giá.
     */
    if (
      PRICE_PATTERN.test(line) &&
      !DISTRICT_SIGNAL_PATTERN.test(
        line,
      ) &&
      !WARD_SIGNAL_PATTERN.test(
        line,
      )
    ) {
      continue;
    }

    const hasDistrictSignal =
      DISTRICT_SIGNAL_PATTERN.test(
        line,
      );

    const hasWardSignal =
      WARD_SIGNAL_PATTERN.test(
        line,
      );

    let score = 0;

    if (hasDistrictSignal) {
      score += 5;
    }

    if (hasWardSignal) {
      score += 3;
    }

    if (
      PREFIXES_AT_START.test(line)
    ) {
      score += 1;
    }

    const strippedForNumber =
      line
        .replace(
          PREFIXES_AT_START,
          "",
        )
        .replace(
          PRIVATE_LABEL_AT_START,
          "",
        )
        .trim();

    const numberMatch =
      strippedForNumber.match(
        HOUSE_NUMBER_CAPTURE_AT_START,
      );

    let houseNumberCount = 0;

    if (numberMatch?.[1]) {
      houseNumberCount =
        numberMatch[1]
          .split(/\s+/u)
          .filter(Boolean)
          .length;
    }

    if (houseNumberCount > 0) {
      score += 4;
    }

    if (houseNumberCount > 1) {
      score += 2;
    }

    /*
     * Có địa chỉ dạng:
     *
     * Nguyễn Tri Phương P.8 Q.10
     *
     * vẫn được chấp nhận.
     */
    if (
      !hasDistrictSignal &&
      !hasWardSignal &&
      houseNumberCount === 0
    ) {
      continue;
    }

    /*
     * Dòng có cả số nhà + quận/phường
     * luôn được ưu tiên.
     */
    if (
      houseNumberCount > 0 &&
      hasDistrictSignal
    ) {
      score += 5;
    }

    candidates.push({
      line,
      score,
    });
  }

  if (candidates.length === 0) {
    return "";
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score,
  );

  return candidates[0].line;
};

/* =========================================================
   ĐỊA CHỈ THÔ CHO ADMIN / AGENT
========================================================= */

export function extractBestRawAddress(
  listing: ListingLike,
): string {
  const address =
    asText(listing.address);

  const description =
    asText(listing.description);

  const rawInput =
    asText(listing.raw_input);

  const title =
    asText(listing.title);

  const rawText = [
    address,
    description,
    rawInput,
    title,
  ]
    .filter(Boolean)
    .join("\n");

  const bestLine =
    selectBestAddressLine(rawText);

  if (!bestLine) {
    return (
      address ||
      description ||
      rawInput ||
      ""
    );
  }

  const cleaned =
    stripLeadingPrivateParts(
      bestLine,
    );

  return normalizeAdministrativeAreas(
    cleaned,
  )
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   DETECT SỐ NHÀ
========================================================= */

const hasLeadingHouseNumber = (
  rawAddress: string,
): boolean => {
  let value =
    firstContentLine(
      rawAddress,
    )
      .replace(
        PREFIXES_AT_START,
        "",
      )
      .trim();

  for (
    let index = 0;
    index < 15;
    index += 1
  ) {
    const nextValue = value
      .replace(
        PRIVATE_LABEL_AT_START,
        "",
      )
      .trim();

    if (nextValue === value) {
      break;
    }

    value = nextValue;
  }

  return HOUSE_NUMBER_LINE_PATTERN.test(
    value,
  );
};

/* =========================================================
   DỰNG PUBLIC TITLE
========================================================= */

/**
 * Đây là hàm QUAN TRỌNG NHẤT cho title public.
 *
 * FORMAT BẮT BUỘC:
 *
 * [VỊ TRÍ] - [TÊN ĐƯỜNG] - [P.X] - [QUẬN]
 *
 * Ví dụ:
 *
 * Hẻm - Nguyễn Tri Phương - P.8 - Quận 10
 *
 * Hẻm Xe Hơi - Âu Cơ - P.10 - Quận Tân Bình
 *
 * Mặt Tiền - Tân Hòa Đông - P.14 - Quận 6
 *
 * Mặt Tiền - Nguyễn Trãi - Quận 1
 */
export function buildPublicTitle(
  listing: ListingLike,
): string {
  const address =
    asText(listing.address);

  const description =
    asText(listing.description);

  const rawInput =
    asText(listing.raw_input);

  const title =
    asText(listing.title);

  /*
   * Ghép toàn bộ context để tìm đúng
   * dòng địa chỉ.
   */
  const rawText = [
    address,
    description,
    rawInput,
    title,
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * Xác định vị trí trước.
   *
   * Explicit:
   * HXH → Hẻm Xe Hơi
   *
   * Không explicit:
   * 541/3 → Hẻm
   * 34 36 38 → Mặt Tiền
   */
  const prefix =
    detectListingPrefix(
      rawText,
    );

  /*
   * Lấy đúng dòng địa chỉ.
   */
  let addressLine =
    selectBestAddressLine(
      rawText,
    );

  /*
   * Nếu không tìm được thì thử
   * address trực tiếp.
   */
  if (!addressLine) {
    addressLine =
      address ||
      rawInput ||
      title ||
      "";
  }

  /*
   * Xóa prefix nội bộ khỏi đầu.
   */
  addressLine =
    addressLine
      .replace(
        PREFIXES_AT_START,
        "",
      )
      .replace(
        PRIVATE_LABEL_AT_START,
        "",
      )
      .trim();

  /*
   * XÓA SỐ NHÀ TRƯỚC KHI TÁCH
   * PHƯỜNG / QUẬN.
   *
   * Đây là điểm chặn để không còn:
   *
   * Mặt Tiền - 681 - Quang Trung...
   *
   * hoặc:
   *
   * Mặt Tiền - 282bis - Cống Quỳnh...
   */
  addressLine =
    stripLeadingHouseNumbers(
      addressLine,
    );

  /*
   * Chuẩn hóa:
   *
   * Q.10 → Quận 10
   * P.8 → P.8
   * Quận Tân Bình → Quận Tân Bình
   */
  addressLine =
    normalizeAdministrativeAreas(
      addressLine,
    );

  /*
   * Tách QUẬN trước.
   */
  const districtResult =
    extractDistrictFromAddress(
      addressLine,
    );

  /*
   * Tách PHƯỜNG.
   */
  const wardResult =
    extractWardFromAddress(
      districtResult.street,
    );

  /*
   * Tên đường.
   */
  const street =
    cleanStreetName(
      wardResult.street,
    );

  const parts: string[] = [];

  /*
   * Vị trí LUÔN PHẢI CÓ.
   */
  if (prefix) {
    parts.push(prefix);
  }

  /*
   * Tên đường LUÔN PHẢI CÓ nếu
   * xác định được.
   */
  if (street) {
    parts.push(street);
  }

  /*
   * Phường chỉ thêm khi có.
   */
  if (wardResult.ward) {
    parts.push(
      wardResult.ward,
    );
  }

  /*
   * Quận chỉ thêm khi có.
   */
  if (districtResult.district) {
    parts.push(
      districtResult.district,
    );
  }

  /*
   * FORMAT CUỐI:
   *
   * A - B - C - D
   *
   * Không bao giờ:
   *
   * A - B - - C
   * A - B - C -
   * A B C
   */
  const finalTitle =
    parts
      .filter(Boolean)
      .join(" - ")
      .replace(
        /\s*-\s*-\s*/g,
        " - ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return normalizePublicTitleText(
    finalTitle,
  );
}

/* =========================================================
   ALIAS CHO CODE CŨ
========================================================= */

/**
 * Nếu code cũ đang gọi tên hàm này
 * thì vẫn dùng được.
 */
export const buildPublicListingTitle =
  buildPublicTitle;

/* =========================================================
   PUBLIC PREFIX
========================================================= */

/**
 * Giữ API cũ nếu các file khác
 * đang import hàm này.
 */
export function getPublicListingTitle(
  listing: ListingLike,
): string {
  return buildPublicTitle(
    listing,
  );
}

/* =========================================================
   FRONTAGE WIDTH
========================================================= */

const extractFrontageWidth = (
  listing: ListingLike,
): number | null => {
  const dbValue = asNumber(
    listing.frontage_width,
  );

  if (
    dbValue !== null &&
    dbValue > 0
  ) {
    return dbValue;
  }

  const rawText = [
    asText(listing.address),
    asText(listing.description),
    asText(listing.raw_input),
    asText(listing.title),
  ]
    .filter(Boolean)
    .join(" ");

  const match =
    rawText.match(
      /\b(\d+(?:[.,]\d+)?)\s*[xX×]\s*\d+(?:[.,]\d+)?/u,
    );

  if (!match?.[1]) {
    return null;
  }

  const width =
    Number(
      match[1].replace(
        ",",
        ".",
      ),
    );

  return Number.isFinite(width)
    ? width
    : null;
};

/* =========================================================
   FLOORS
========================================================= */

const extractFloors = (
  listing: ListingLike,
): number | null => {
  const dbValue = asNumber(
    listing.floors,
  );

  if (
    dbValue !== null &&
    dbValue >= 0
  ) {
    return dbValue;
  }

  const rawText = [
    asText(listing.structure),
    asText(listing.description),
    asText(listing.raw_input),
    asText(listing.title),
  ]
    .filter(Boolean)
    .join(" ");

  const floorMatch =
    rawText.match(
      FLOOR_COUNT_PATTERN,
    );

  const hasTret =
    HAS_TRET_PATTERN.test(
      rawText,
    );

  let floors: number | null =
    null;

  if (floorMatch?.[1]) {
    floors = Number(
      floorMatch[1],
    );
  }

  if (
    floors !== null &&
    hasTret
  ) {
    /*
     * "trệt 3 lầu"
     * → 4 tầng tổng cộng
     */
    floors += 1;
  }

  if (
    floors === null &&
    hasTret
  ) {
    floors = 1;
  }

  return floors;
};

/* =========================================================
   TEST NHANH TITLE
========================================================= */

/*
 * Các input dưới đây phải cho:
 *
 * 541/3 Nguyễn Tri Phương, P.8, Q.10
 * → Hẻm - Nguyễn Tri Phương - P.8 - Quận 10
 *
 * 243/1/4 Tô Hiến Thành P.13 Q.10
 * → Hẻm - Tô Hiến Thành - P.13 - Quận 10
 *
 * 26A-B Tân Hòa Đông P.14 Q.6
 * → Mặt Tiền - Tân Hòa Đông - P.14 - Quận 6
 *
 * 34 36 38 Nguyễn Trãi Q.1
 * → Mặt Tiền - Nguyễn Trãi - Quận 1
 *
 * 681/ Quang Trung P.10 Q.Gò Vấp
 * → Hẻm - Quang Trung - P.10 - Quận Gò Vấp
 *
 * HXH Âu Cơ P.10 Q.Tân Bình
 * → Hẻm Xe Hơi - Âu Cơ - P.10 - Quận Tân Bình
 */

/* =========================================================
   TẠO TITLE PUBLIC
========================================================= */

const sanitizeAddressWithContext = (
  rawAddressOrTitle: string,
  context: string,
): string => {
  const addressLine =
    firstContentLine(
      rawAddressOrTitle,
    );

  if (!addressLine) {
    return "";
  }

  /**
   * PREFIX:
   *
   * 1. Explicit prefix.
   * 2. Nếu không có:
   *    - số nhà có "/" => Hẻm
   *    - không "/" => Mặt Tiền
   *
   * context bắt buộc là dữ liệu THÔ.
   */
  const prefix =
    detectExplicitPrefix(context) ||
    (hasAddressSlash(context)
      ? "Hẻm"
      : "Mặt Tiền");

  /**
   * Xóa:
   * - SĐT
   * - hh
   * - lh
   * - sđt
   * - nd
   */
  const cleanedAddress =
    addressLine
      .replace(
        PHONE_PATTERN,
        "",
      )
      .replace(
        INTERNAL_HH_PATTERN,
        "",
      )
      .replace(
        INTERNAL_CONTACT_PATTERN,
        "",
      )
      .trim();

  /**
   * Bỏ:
   * - prefix
   * - private label
   * - toàn bộ số nhà đầu địa chỉ
   *
   * QUAN TRỌNG:
   * Prefix đã được xác định TRƯỚC khi
   * số nhà bị xóa.
   */
  let strippedAddress =
    stripLeadingPrivateParts(
      cleanedAddress,
    );

  strippedAddress =
    normalizeAdministrativeAreas(
      strippedAddress,
    );

  const districtResult =
    extractDistrictFromAddress(
      strippedAddress,
    );

  let street =
    districtResult.street;

  let district =
    districtResult.district;

  /**
   * Fallback tìm Quận.
   */
  if (!district) {
    const match =
      street.match(
        /(?:^|[\s,-]+)(Quận\s+(?:\d+|Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh))\s*$/iu,
      );

    if (match?.[1]) {
      district =
        normalizeDistrictName(
          match[1],
        );

      street = street
        .slice(
          0,
          match.index ??
            street.length,
        )
        .replace(
          /[\s,-]+$/u,
          "",
        )
        .trim();
    }
  }

  /**
   * Chặn tuyệt đối việc số nhà quay trở lại.
   */
  street = street
  .replace(HOUSE_NUMBER_AT_START, "")
  .replace(/^\s*[/]\s*/u, "")
  .trim();

  /**
   * Chuẩn hóa title.
   */
  street =
    normalizePublicTitleText(
      street,
    );

  street = street
    .replace(
      /\s*-\s*-\s*/g,
      " - ",
    )
    .replace(
      /^\s*-\s*|\s*-\s*$/g,
      "",
    )
    .trim();

  /**
   * Chuẩn hóa viết hoa.
   */
  street =
    toTitleCaseWords(street);

  /**
   * Kết quả:
   *
   * Prefix - Đường - P.x - Quận
   */
  const result = [
    prefix,
    street,
    district,
  ]
    .filter(Boolean)
    .join(" - ")
    .replace(
      /\s*-\s*-\s*/g,
      " - ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return result;
};

/* =========================================================
   PUBLIC ADDRESS API
========================================================= */

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

/* =========================================================
   USD -> VNĐ
========================================================= */

const convertUsdToVnd = (
  usd: number,
): string => {
  const vnd = Math.round(
    usd * USD_TO_VND,
  );

  return `${vnd.toLocaleString(
    "vi-VN",
  )} VNĐ`;
};

/* =========================================================
   PARSE USD
========================================================= */

const parseUsdNumber = (
  value: string,
): number => {
  const normalized =
    value
      .trim()
      .replace(/\s/g, "");

  if (!normalized) {
    return 0;
  }

  if (
    normalized.includes(".") &&
    normalized.includes(",")
  ) {
    const lastDot =
      normalized.lastIndexOf(".");

    const lastComma =
      normalized.lastIndexOf(",");

    if (lastComma > lastDot) {
      return (
        Number(
          normalized
            .replace(/\./g, "")
            .replace(",", "."),
        ) || 0
      );
    }

    return (
      Number(
        normalized.replace(/,/g, ""),
      ) || 0
    );
  }

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

  return (
    Number(normalized) || 0
  );
};

/* =========================================================
   CONVERT USD TRONG TEXT
========================================================= */

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
        parseUsdNumber(
          numberPart,
        );

      if (!usd) {
        return fullMatch;
      }

      return convertUsdToVnd(usd);
    },
  );
};

/* =========================================================
   EXTRACT PUBLIC PRICE
========================================================= */

export function extractPublicPrice(
  rawText: string,
): string {
  const text =
    asText(rawText);

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
      parseUsdNumber(
        numberPart,
      );

    if (usd > 0) {
      return convertUsdToVnd(
        usd,
      );
    }
  }

  const match =
    text.match(
      PRICE_PATTERN,
    );

  if (!match?.[0]) {
    return "";
  }

  return match[0]
    .replace(/\s+/g, "")
    .replace(
      /\/tháng/iu,
      "/tháng",
    );
}

/* =========================================================
   EXTRACT SIZE
========================================================= */

export function extractPublicSize(
  rawText: string,
): string {
  const match =
    asText(rawText).match(
      SIZE_PATTERN,
    );

  if (!match?.[0]) {
    return "";
  }

  const cleaned =
    match[0]
      .replace(
        /\s*[xX×]\s*/u,
        "x",
      )
      .replace(/\s+/g, "")
      .replace(/m$/iu, "");

  const [
    widthRaw,
    depthRaw,
  ] = cleaned.split(/x/iu);

  const width =
    Number(
      (widthRaw || "").replace(
        ",",
        ".",
      ),
    );

  const depth =
    Number(
      (depthRaw || "").replace(
        ",",
        ".",
      ),
    );

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(depth) ||
    width <= 0 ||
    depth <= 0
  ) {
    return "";
  }

  return cleaned;
};

/* =========================================================
   EXTRACT PUBLIC AREA
========================================================= */

export function extractPublicArea(
  rawText: string,
): string {
  const text =
    asText(rawText);

  const sizeMatch =
    extractPublicSize(text);

  if (sizeMatch) {
    return sizeMatch;
  }

  const totalMatch =
    text.match(
      TOTAL_AREA_PATTERN,
    );

  if (totalMatch) {
    const raw =
      totalMatch[1] ||
      totalMatch[2];

    const num =
      Number(
        raw.replace(",", "."),
      );

    if (
      Number.isFinite(num) &&
      num > 0
    ) {
      return `${num}m²`;
    }
  }

  return "";
}

/* =========================================================
   BỀ NGANG MẶT TIỀN
========================================================= */

export function extractPublicFrontageWidth(
  rawText: string,
): number | null {
  const sizeMatch =
    extractPublicSize(
      rawText,
    );

  if (!sizeMatch) {
    return null;
  }

  const [widthRaw] =
    sizeMatch.split(/x/iu);

  const width =
    Number(
      (widthRaw || "").replace(
        ",",
        ".",
      ),
    );

  return Number.isFinite(width) &&
    width > 0
    ? width
    : null;
}

/* =========================================================
   SỐ TẦNG
========================================================= */

export function extractPublicFloors(
  rawText: string,
): number | null {
  const text =
    asText(rawText);

  const floorMatch =
    text.match(
      FLOOR_COUNT_PATTERN,
    );

  const hasTret =
    HAS_TRET_PATTERN.test(text);

  if (floorMatch) {
    const n =
      Number(
        floorMatch[1],
      );

    if (!Number.isFinite(n)) {
      return null;
    }

    return hasTret
      ? n + 1
      : n;
  }

  if (hasTret) {
    return 1;
  }

  return null;
}

/* =========================================================
   SANITIZE STRUCTURE PUBLIC
========================================================= */

const sanitizePublicStructure = (
  rawStructure: string,
): string => {
  let structure =
    asText(rawStructure);

  if (!structure) {
    return "";
  }

  structure =
    structure.replace(
      PHONE_PATTERN,
      " ",
    );

  structure =
    structure.replace(
      PRICE_PATTERN,
      " ",
    );

  structure =
    structure.replace(
      USD_PRICE_PATTERN,
      " ",
    );

  structure =
    structure.replace(
      INTERNAL_HH_PATTERN,
      " ",
    );

  structure =
    structure.replace(
      INTERNAL_CONTACT_PATTERN,
      " ",
    );

  structure =
    structure.replace(
      /^\s*(?:kết\s*cấu|kc)\s*:\s*/iu,
      "",
    );

  structure =
    structure.replace(
      /^\s*\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\s*/u,
      "",
    );

  structure =
    structure
      .replace(/\s+/g, " ")
      .replace(
        /^[\s,;:.-]+/u,
        "",
      )
      .replace(
        /[\s,;:.-]+$/u,
        "",
      )
      .trim();

  return structure;
};

/* =========================================================
   EXTRACT STRUCTURE
========================================================= */

export function extractPublicStructure(
  rawText: string,
): string {
  const text =
    asText(rawText);

  const sizeMatch =
    SIZE_PATTERN.exec(text);

  if (
    !sizeMatch ||
    sizeMatch.index === undefined
  ) {
    return "";
  }

  let structure =
    text.slice(
      sizeMatch.index +
        sizeMatch[0].length,
    );

  const hiddenInfoPatterns: RegExp[] =
    [
      PRICE_PATTERN,
      USD_PRICE_PATTERN,
      PHONE_PATTERN,
      INTERNAL_HH_PATTERN,
      /\blh\b/iu,
      /\bsđt\b/iu,
      /\bsdt\b/iu,
      /\bnđ\b/iu,
      /\bnd\b/iu,
      /\bhoa\s+hồng\b/iu,
    ];

  let endIndex =
    structure.length;

  for (const pattern of hiddenInfoPatterns) {
    pattern.lastIndex = 0;

    const match =
      pattern.exec(structure);

    if (
      match?.index !== undefined &&
      match.index < endIndex
    ) {
      endIndex =
        match.index;
    }
  }

  structure =
    structure.slice(
      0,
      endIndex,
    );

  structure =
    structure
      .replace(
        /^\s*(?:kết\s*cấu|kc)\s*:\s*/iu,
        "",
      )
      .replace(
        /^[\s,;:.-]+|[\s,;:.-]+$/gu,
        "",
      )
      .replace(
        /[ \t]+/g,
        " ",
      )
      .replace(
        /\s*\n\s*/g,
        " ",
      )
      .trim();

  return structure;
}

/* =========================================================
   MỞ RỘNG VIẾT TẮT TRONG KẾT CẤU
========================================================= */

const STRUCTURE_PHRASE_REPLACEMENTS:
  Array<[RegExp, string]> = [
    [
      /\bfull\s*nt\b/giu,
      "Full Nội Thất",
    ],

    [
      /\bntcb\b/giu,
      "Nội Thất Cơ Bản",
    ],

    [
      /\bcó\s*nt\b/giu,
      "Có Nội Thất",
    ],

    [
      /\bpccc\b/giu,
      "Có PCCC",
    ],

    [
      /\btm\b/giu,
      "Có Thang Máy",
    ],
  ];

const formatPublicStructureDisplay = (
  rawStructure: string,
): string => {
  let text =
    asText(rawStructure);

  if (!text) {
    return "";
  }

  /**
   * Cụm dài xử lý trước.
   */
  for (const [
    pattern,
    replacement,
  ] of STRUCTURE_PHRASE_REPLACEMENTS) {
    text = text.replace(
      pattern,
      replacement,
    );
  }

  /**
   * 6pn -> 6 Phòng Ngủ
   */
  text = text.replace(
    /\b(\d+)\s*pn\b/giu,
    "$1 Phòng Ngủ",
  );

  /**
   * 4wc -> 4 WC
   */
  text = text.replace(
    /\b(\d+)\s*wc\b/giu,
    "$1 WC",
  );

  /**
   * 22p -> 22 Phòng
   */
  text = text.replace(
    /\b(\d+)\s*p\b/giu,
    "$1 Phòng",
  );

  /**
   * Trệt không có số:
   * trệt 5 lầu
   * => 1 Trệt 5 lầu
   */
  text = text.replace(
    /^\s*(\d+)\s*trệt\b/iu,
    "$1 Trệt",
  );

  text = text.replace(
    /^\s*trệt\b/iu,
    "1 Trệt",
  );

  text =
    text
      .replace(/\s+/g, " ")
      .trim();

  /**
   * Viết hoa chữ đầu từ.
   */
  text = text
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }

      if (
        /^[A-ZÀ-Ỹ0-9]/u.test(
          word,
        )
      ) {
        return word;
      }

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    })
    .join(" ");

  return text;
};

/* =========================================================
   FORMAT GIÁ TỪ DB
========================================================= */

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

  if (
    number >=
    1_000_000_000
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

  if (
    number >=
    1_000_000
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

/* =========================================================
   FORMAT PUBLIC LISTING
========================================================= */

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
   * Gộp dữ liệu để trích area / structure / price.
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
   * Context dùng cho Hẻm / Mặt Tiền.
   *
   * KHÔNG dùng title.
   */
  const rawAddressContext = [
    address,
    description,
    rawInput,
  ]
    .filter(Boolean)
    .join("\n");

  /**
   * Chọn dòng địa chỉ giàu thông tin nhất.
   */
  const bestRawAddressLine =
    selectBestAddressLine(
      rawAddressContext,
    );

  /**
   * KHÔNG dùng title làm nguồn chính.
   *
   * title có thể là title cũ/sai.
   */
  const addressSource =
    bestRawAddressLine ||
    address ||
    description ||
    rawInput ||
    title;

  /**
   * Context quyết định Hẻm / Mặt Tiền.
   *
   * Ưu tiên address + description + raw_input.
   */
  const prefixContext =
    rawAddressContext ||
    addressSource;

  /* =======================================================
     DIỆN TÍCH
  ======================================================= */

  const extractedArea =
    extractPublicArea(
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

  /* =======================================================
     BỀ NGANG / SỐ TẦNG
  ======================================================= */

  const dbFrontageWidth =
    asNumber(
      listing.frontage_width,
    );

  const dbFloors =
    asNumber(
      listing.floors,
    );

  const frontageWidth =
    dbFrontageWidth !== null &&
    dbFrontageWidth > 0
      ? dbFrontageWidth
      : extractPublicFrontageWidth(
          rawText,
        );

  const floors =
    dbFloors !== null &&
    dbFloors > 0
      ? dbFloors
      : extractPublicFloors(
          rawText,
        );

  /* =======================================================
     CẤU TRÚC
  ======================================================= */

  const extractedStructure =
    extractPublicStructure(
      rawText,
    );

  const structuredStructure =
    asText(
      listing.structure,
    );

  const publicStructuredStructure =
    sanitizePublicStructure(
      structuredStructure,
    );

  /* =======================================================
     GIÁ
  ======================================================= */

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

  /* =======================================================
     STRUCTURE PUBLIC
  ======================================================= */

  const publicStructure =
    formatPublicStructureDisplay(
      convertUsdPricesInText(
        sanitizePublicStructure(
          extractedStructure ||
            publicStructuredStructure,
        ),
      ),
    );

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    /**
     * Ví dụ:
     *
     * 83/3 Nguyễn Hữu Tiến Q.Tân Phú
     * =>
     * Hẻm - Nguyễn Hữu Tiến - Quận Tân Phú
     *
     * 180 Hồng Bàng P.12 Q.5
     * =>
     * Mặt Tiền - Hồng Bàng - P.12 - Quận 5
     *
     * 338 340 Trần Văn Giàu Q.Bình Tân
     * =>
     * Mặt Tiền - Trần Văn Giàu - Quận Bình Tân
     *
     * 157 159 161 Hoàng Văn Thụ Q.Phú Nhuận
     * =>
     * Mặt Tiền - Hoàng Văn Thụ - Quận Phú Nhuận
     *
     * 2/45/3 Nguyễn Văn Trỗi Q.Phú Nhuận
     * =>
     * Hẻm - Nguyễn Văn Trỗi - Quận Phú Nhuận
     *
     * 234 235 nguyễn trãi Q.1
     * =>
     * Mặt Tiền - Nguyễn Trãi - Quận 1
     *
     * 2MT 345 347 349 lê thị riêng Q.1
     * =>
     * Hai Mặt Tiền - Lê Thị Riêng - Quận 1
     *
     * 12/23/4 tân cảng Q.7
     * =>
     * Hẻm - Tân Cảng - Quận 7
     */
    publicTitle:
      sanitizeAddressWithContext(
        addressSource,
        prefixContext,
      ),

    area:
      extractedArea ||
      dimensions ||
      structuredArea,

    structure:
      publicStructure,

    price:
      publicPrice,

    frontageWidth,

    floors,

    /**
     * SĐT CÔNG KHAI của hệ thống.
     *
     * Không lấy listing.phone.
     * Không lấy listing.contact_phone.
     * Không lấy SĐT trong raw_input.
     */
    contactPhone:
      PUBLIC_CONTACT_PHONE,
  };
}