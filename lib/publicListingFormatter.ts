export const PUBLIC_CONTACT_PHONE = "0946497253";
 
export type PublicListing = {
  publicTitle: string;
  area: string;
  structure: string;
  price: string;
 
  /**
   * Bề ngang mặt tiền (m), lấy từ field frontage_width trong DB nếu có,
   * nếu không thì tự trích từ dữ liệu thô dạng "NxN" (vd "9x18" -> 9).
   */
  frontageWidth: number | null;
 
  /**
   * Số tầng (kể cả trệt), lấy từ field floors trong DB nếu có, nếu không
   * thì tự trích từ dữ liệu thô dạng "1 Trệt 2 Lầu" / "3 tầng".
   */
  floors: number | null;
 
  /**
   * Số Zalo/liên hệ CÔNG KHAI của hệ thống (không phải SĐT thật
   * của môi giới/chủ tin). An toàn để hiển thị cho khách.
   */
  contactPhone: string;
};
 
type ListingLike = Record<string, unknown>;
 
/* =========================================================
   CONFIG
========================================================= */
 
const USD_TO_VND = 26310;
 
/* =========================================================
   PREFIX / LOẠI MẶT BẰNG
========================================================= */
 
const PREFIX_PATTERNS: Array<[RegExp, string]> = [
  // Các cụm GHÉP phải đứng TRƯỚC "Góc" đứng riêng và MT/MB đứng
  // riêng, để tránh bị match nhầm vào pattern ngắn hơn trước.
  [/\bGÓC\s+2\s*(?:MT|MẶT\s*TIỀN)\b/iu, "Góc 2 Mặt Tiền"],
  [/\b(?:2\s*MT|HAI\s+MẶT\s+TIỀN)\b/iu, "Hai Mặt Tiền"],
  [/\bGÓC\s+2\s*(?:MB|MẶT\s+BẰNG)\b/iu, "Góc 2 Mặt Bằng"],
  [
    /\b(?:2\s*MB\s+TRƯỚC\s+SAU|HAI\s+MẶT\s+BẰNG\s+TRƯỚC\s+SAU)\b/iu,
    "Hai Mặt Bằng Trước Sau",
  ],
  [/\b(?:HXH|HẺM\s+XE\s+HƠI)\b/iu, "Hẻm Xe Hơi"],
  [/\b(?:HXT|HẺM\s+XE\s+TẢI)\b/iu, "Hẻm Xe Tải"],
  [/\b(?:HXM|HẺM\s+XE\s+MÁY)\b/iu, "Hẻm Xe Máy"],
  [/\b(?:H3G|HẺM\s+BA\s+GÁC)\b/iu, "Hẻm Ba Gác"],
 
  // "Góc" đứng riêng — phải đứng SAU các cụm "Góc 2MT"/"Góc 2MB"
  // ở trên, nếu không nó sẽ "cướp" match trước.
  [/\bGÓC\b/iu, "Góc"],
 
  [/\b(?:MT|MẶT\s+TIỀN)\b/iu, "Mặt Tiền"],
  [/\b(?:MB|MẶT\s+BẰNG)\b/iu, "Mặt Bằng"],
];
 
const PREFIXES_AT_START =
  /^(?:(?:HXH|HXM|HXT|H3G|2MT|2MB|MT|MB|GÓC|Hẻm\s+Xe\s+Hơi|Hẻm\s+Xe\s+Máy|Hẻm\s+Xe\s+Tải|Hẻm\s+Ba\s+Gác|Hai\s+Mặt\s+Tiền|Hai\s+Mặt\s+Bằng|Mặt\s+Bằng|Mặt\s+Tiền|Hẻm)\s*[-:–—]?\s*)+/iu;
 
/**
 * Các nhãn nội bộ không đưa lên public.
 */
const PRIVATE_LABEL_AT_START =
  /^(?:(?:lô\s+[\p{L}\d-]+|căn\s+[\p{L}\d-]+|mã(?:\s+nội\s+bộ)?\s+[\p{L}\d-]+|cc|số|đc)\s*[-:–—]?\s*)/iu;
 
/* =========================================================
   SỐ NHÀ
========================================================= */
 
/**
 * Số nhà đầu địa chỉ.
 *
 * Hỗ trợ:
 * 180 Hồng Bàng
 * 132-134 Bàu Cát 3
 * 12A Nguyễn Văn A
 * 12/5 Nguyễn Văn A
 * 83/3 Nguyễn Hữu Tiến
 * 338 340 Trần Văn Giàu
 * 157 159 161 Hoàng Văn Thụ
 *
 * Chỉ dùng để BỎ SỐ NHÀ (và, ở bản có capture, để LẤY DANH SÁCH
 * số nhà phục vụ việc gộp hiển thị cho admin).
 */
/**
 * Token 1 số nhà: hỗ trợ hậu tố chữ (12A) và nhiều đoạn hẻm-trong-hẻm
 * nối bằng "/" (31/25/7, 192/2/5...).
 */
const HOUSE_NUMBER_TOKEN =
  String.raw`\d+[A-Za-z]?(?:\/[A-Za-z0-9]+)*`;
 
/**
 * Nhiều số nhà liên tiếp, nối bằng "-", dấu phẩy, hoặc khoảng trắng:
 * "324 - 326-328 Lê Lai", "13 15 Lê Thị Hồng Gấm",
 * "31/25/7, Lê Lai" (số nhà có dấu phẩy ngay sau).
 * Chỉ dùng để BỎ SỐ NHÀ.
 */
const HOUSE_NUMBER_AT_START = new RegExp(
  String.raw`^(?:${HOUSE_NUMBER_TOKEN}(?:\s*[-–]\s*|\s*,\s*|\s+))*${HOUSE_NUMBER_TOKEN}(?:\s*,\s*|\s+)`,
  "u",
);
 
/**
 * Giống HOUSE_NUMBER_AT_START nhưng CÓ capture group để lấy lại danh
 * sách số nhà (dùng cho hiển thị "338-340 ..." ở trang admin — không
 * dùng để tạo tiêu đề public, vì tiêu đề public luôn bỏ số nhà).
 */
const HOUSE_NUMBER_CAPTURE_AT_START = new RegExp(
  String.raw`^((?:${HOUSE_NUMBER_TOKEN}(?:\s*[-–]\s*|\s*,\s*|\s+))*${HOUSE_NUMBER_TOKEN})(?:\s*,\s*|\s+)`,
  "u",
);
 
/**
 * Một dòng "bắt đầu bằng số nhà thật sự": số (có thể kèm 1 chữ cái,
 * có thể nối nhiều đoạn bằng "/") rồi theo sau NGAY là khoảng trắng.
 *
 * Dùng để phân biệt với:
 * - Số điện thoại thuần số (không có khoảng trắng ngay sau dãy số)
 * - Các slash khác không phải số nhà, ví dụ "hh1/2" (không đứng
 *   đầu dòng, hoặc không theo sau bởi khoảng trắng ngay lập tức)
 */
const HOUSE_NUMBER_LINE_PATTERN = new RegExp(
  String.raw`^${HOUSE_NUMBER_TOKEN}\s+`,
  "u",
);
 
/* =========================================================
   DIỆN TÍCH
========================================================= */
 
const SIZE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\b/iu;
 
/**
 * Diện tích tổng dạng "50m2", "600 m²" — dùng làm fallback khi tin
 * KHÔNG có kích thước dạng NxN (vd chỉ ghi "diện tích 600m2").
 */
const TOTAL_AREA_PATTERN =
  /\b(\d+(?:[.,]\d+)?)\s*m\s*2\b|\b(\d+(?:[.,]\d+)?)\s*m²\b/iu;
 
/**
 * Số tầng dạng "1 Trệt 2 Lầu", "3 tầng"...
 */
const FLOOR_COUNT_PATTERN = /(\d+)\s*(?:lầu|tầng)\b/iu;
const HAS_TRET_PATTERN = /\btrệt\b/iu;
 
/* =========================================================
   GIÁ VNĐ
========================================================= */
 
const PRICE_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|triệu|tỷ|ty|k|nghìn|ngàn)(?!\p{L})(?:\s*\/\s*tháng)?/iu;
 
/* =========================================================
   GIÁ USD
========================================================= */
 
const USD_PRICE_PATTERN =
  /(?:\$\s*\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)*\s*(?:\$|USD|US\$|đô(?:\s*la)?|dollars?))/iu;
 
/* =========================================================
   PHONE
========================================================= */
 
const PHONE_PATTERN =
  /(?:\+?84|0)(?:[\s.()-]*\d){8,10}\b/gu;
 
/* =========================================================
   NỘI DUNG NỘI BỘ
========================================================= */
 
/**
 * Bắt được các biến thể: hh, hhtt, hh1/2, hh1t, hh4n1, hh5n1t,
 * hh báo sau...
 */
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
   ĐỊA CHỈ CÓ TÍN HIỆU QUẬN/PHƯỜNG (dùng để chấm điểm dòng)
========================================================= */
 
const DISTRICT_SIGNAL_PATTERN =
  /\bq(?:uận)?\.?\s*(?:\d+|[A-ZÀ-Ỹ][a-zà-ỹ]+)\b/iu;
 
const WARD_SIGNAL_PATTERN = /\bp(?:hường)?\.?\s*\d+\b/iu;
 
/* =========================================================
   UTILITY
========================================================= */
 
const asText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
 
  return "";
};
 
const asNumber = (value: unknown): number | null => {
  const number = Number(value);
 
  return Number.isFinite(number) ? number : null;
};
 
const firstContentLine = (value: string): string => {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
};
 
/* =========================================================
   CHUẨN HÓA TITLE
========================================================= */
 
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
 
/* =========================================================
   CHUẨN HÓA QUẬN
========================================================= */
 
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
 
const normalizeDistrictName = (value: string): string => {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
 
  return DISTRICT_MAP[normalized] || value.trim();
};
 
/* =========================================================
   CHUẨN HÓA Q / P
========================================================= */
 
const normalizeAdministrativeAreas = (
  rawAddress: string,
): string => {
  let value = rawAddress;
 
  value = value.replace(
    /\bQ\s*\.?\s*(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(district),
  );
 
  value = value.replace(
    /\bQ\s*\.?\s*(1|2|3|4|5|6|7|8|9|10|11|12)\b/iu,
    (_match, district: string) => `Quận ${district}`,
  );
 
  value = value.replace(
    /\bQuận\s+(Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh)\b/iu,
    (_match, district: string) =>
      normalizeDistrictName(district),
  );
 
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
 
/* =========================================================
   DETECT PREFIX
========================================================= */
 
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
 
/* =========================================================
   XÁC ĐỊNH HẺM
========================================================= */
 
/**
 * Tìm dòng bắt đầu bằng số nhà thật sự trong TOÀN BỘ context
 * (nhiều dòng: address / description / raw_input), KHÔNG chỉ
 * dòng đầu tiên.
 *
 * LÝ DO SỬA:
 * Field `address` trong DB thường đã được rút gọn/làm sạch,
 * không còn số nhà (VD chỉ còn "Nguyễn Hữu Tiến, P.Tân Thành,
 * Q.Tân Phú"), trong khi số nhà thật (VD "83/3") chỉ còn nằm
 * trong `raw_input`. Nếu chỉ kiểm tra dòng đầu tiên của chuỗi
 * gộp [address, description, raw_input], ta sẽ luôn thấy dòng
 * `address` (không có "/") và bỏ lỡ dòng `raw_input` phía sau
 * có chứa số nhà dạng "83/3" => sai thành "Mặt Tiền".
 */
const findLeadingHouseNumberLine = (
  rawAddress: string,
): string | null => {
  const lines = rawAddress
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
 
  for (const line of lines) {
    const stripped = line
      .replace(PREFIXES_AT_START, "")
      .replace(PRIVATE_LABEL_AT_START, "")
      .trim();
 
    if (HOUSE_NUMBER_LINE_PATTERN.test(stripped)) {
      return stripped;
    }
  }
 
  return null;
};
 
/**
 * RULE QUAN TRỌNG:
 *
 * Nếu DÒNG SỐ NHÀ (tìm được ở trên) có "/" => Hẻm.
 *
 * Ví dụ:
 *
 * 83/3 Nguyễn Hữu Tiến  => Hẻm
 * 192/2 Nguyễn Oanh     => Hẻm
 * 12/5 Nguyễn Văn A     => Hẻm
 * 2/45/3 Nguyễn Văn Trỗi => Hẻm
 *
 * Không có "/" (kể cả nhiều số nhà cách nhau bằng khoảng trắng,
 * vd "338 340 Trần Văn Giàu" hay "157 159 161 Hoàng Văn Thụ")
 * => Mặt Tiền.
 *
 * Không được bỏ số nhà trước khi kiểm tra "/".
 * Không được chỉ xét dòng đầu tiên của context gộp — phải quét
 * hết các dòng để tìm đúng dòng chứa số nhà thật.
 */
const hasAddressSlash = (
  rawAddress: string,
): boolean => {
  const houseNumberLine =
    findLeadingHouseNumberLine(rawAddress);
 
  if (!houseNumberLine) {
    return false;
  }
 
  const match = houseNumberLine.match(
    new RegExp(
      String.raw`^\d+[A-Za-z]?((?:\/[A-Za-z0-9]+)+)`,
      "u",
    ),
  );
 
  return Boolean(match);
};
 
/* =========================================================
   CHỌN DÒNG ĐỊA CHỈ TỐT NHẤT TRONG NHIỀU DÒNG DỮ LIỆU THÔ
========================================================= */
 
/**
 * Tin đăng thô thường có NHIỀU dòng, ví dụ:
 *
 *   Mặt Tiền - 340 Trần Văn Giàu - Quận Bình Tân
 *   9x18·1 Trệt 2 Lầu Suốt
 *   338 340 Trần Văn Giàu Q.Bình Tân
 *
 * Dòng 1 chỉ là nhãn rút gọn (thiếu 1 trong 2 số nhà).
 * Dòng 2 là kích thước/kết cấu, không phải địa chỉ.
 * Dòng 3 mới là địa chỉ ĐẦY ĐỦ nhất (có cả 2 số nhà + quận).
 *
 * Hàm này chấm điểm từng dòng và chọn dòng "giàu thông tin địa chỉ
 * nhất" để đưa vào bộ tách tiêu đề, thay vì luôn lấy dòng đầu tiên.
 *
 * Ưu tiên: có quận/phường (+2) > có số nhà (+2) > có NHIỀU số nhà
 * liền kề (+2 thêm) > trừ điểm nếu dòng chỉ là nhãn rút gọn (-1,
 * vì nhãn dạng "Mặt Tiền - ..." thường không đầy đủ bằng dòng gốc).
 */
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
 
  const candidates: Candidate[] = [];
 
  for (const line of lines) {
    // Bỏ dòng chỉ chứa kích thước/kết cấu, vd "9x18·1 Trệt 2 Lầu Suốt"
    if (/^\s*\d+(?:[.,]\d+)?\s*[xX×]/u.test(line)) {
      continue;
    }
 
    const hasDistrictSignal =
      DISTRICT_SIGNAL_PATTERN.test(line) ||
      WARD_SIGNAL_PATTERN.test(line);
 
    let score = hasDistrictSignal ? 2 : 0;
 
    if (PREFIXES_AT_START.test(line)) {
      // Dòng nhãn rút gọn ("Mặt Tiền - ...") ưu tiên thấp hơn dòng
      // số-nhà-thuần, vì nhãn có thể chỉ giữ lại 1 trong nhiều số nhà.
      score -= 1;
    }
 
    const strippedForNumber = line
      .replace(PREFIXES_AT_START, "")
      .replace(PRIVATE_LABEL_AT_START, "");
 
    const numberMatch = strippedForNumber.match(
      HOUSE_NUMBER_CAPTURE_AT_START,
    );
 
    const houseNumberCount = numberMatch
      ? numberMatch[1].split(/[\s,-]+/u).filter(Boolean).length
      : 0;
 
    if (houseNumberCount > 0) score += 2;
    if (houseNumberCount > 1) score += 2;
 
    if (!hasDistrictSignal && houseNumberCount === 0) {
      continue;
    }
 
    candidates.push({ line, score });
  }
 
  if (candidates.length === 0) {
    return "";
  }
 
  candidates.sort((a, b) => b.score - a.score);
 
  return candidates[0].line;
};
 
/* =========================================================
   ĐỊA CHỈ THÔ CHO ADMIN/AGENT (gộp nhiều số nhà cho dễ đọc)
========================================================= */
 
/**
 * Dành cho ADMIN/AGENT xem thông tin thô. Chọn dòng địa chỉ tốt
 * nhất (bằng selectBestAddressLine) rồi gộp các số nhà liền kề
 * lại cho gọn, vd "338 340 Trần Văn Giàu Q.Bình Tân"
 * => "338-340 Trần Văn Giàu Quận Bình Tân".
 *
 * Không dùng hàm này để tạo publicTitle — publicTitle luôn bỏ hẳn
 * số nhà (xem sanitizeAddressWithContext).
 */
export function extractBestRawAddress(
  listing: ListingLike,
): string {
  const address = asText(listing.address);
  const description = asText(listing.description);
  const rawInput = asText(listing.raw_input);
  const title = asText(listing.title);
 
  const rawText = [address, description, rawInput, title]
    .filter(Boolean)
    .join("\n");
 
  const bestLine = selectBestAddressLine(rawText);
 
  if (!bestLine) {
    return address || description || rawInput || "";
  }
 
  const strippedForNumber = bestLine
    .replace(PREFIXES_AT_START, "")
    .replace(PRIVATE_LABEL_AT_START, "");
 
  const numberMatch = strippedForNumber.match(
    HOUSE_NUMBER_CAPTURE_AT_START,
  );
 
  let resultLine = bestLine;
 
  if (numberMatch) {
    const numbers = numberMatch[1]
      .split(/[\s,-]+/u)
      .filter(Boolean);
 
    if (numbers.length > 1) {
      const rest = strippedForNumber.slice(numberMatch[0].length);
 
      resultLine = `${numbers.join("-")} ${rest}`.trim();
    }
  }
 
  return normalizeAdministrativeAreas(resultLine)
    .replace(/\s+/g, " ")
    .trim();
}
 
/* =========================================================
   DETECT SỐ NHÀ
========================================================= */
 
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
 
/* =========================================================
   PUBLIC PREFIX
========================================================= */
 
export function detectListingPrefix(
  rawText: string,
): string {
  const text = asText(rawText);
 
  /**
   * Prefix explicit vẫn được ưu tiên:
   * Góc, Góc 2MT, Góc 2MB, MT, MB, HXH, HXT, HXM, H3G, ...
   */
  const explicitPrefix =
    detectExplicitPrefix(text);
 
  if (explicitPrefix) {
    return explicitPrefix;
  }
 
  /**
   * RULE:
   * Có "/" trong dòng số nhà => Hẻm.
   * Không có "/" (kể cả nhiều số nhà cách nhau bằng khoảng trắng)
   * => Mặt Tiền.
   */
  return hasAddressSlash(text)
    ? "Hẻm"
    : "Mặt Tiền";
}
 
/* =========================================================
   BỎ THÔNG TIN PRIVATE KHỎI ĐỊA CHỈ
========================================================= */
 
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
 
/* =========================================================
   TÁCH QUẬN Ở CUỐI ĐỊA CHỈ
========================================================= */
 
const extractDistrictFromAddress = (
  address: string,
): {
  street: string;
  district: string;
} => {
  const value =
    normalizeAdministrativeAreas(address).trim();
 
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
 
/* =========================================================
   TẠO TITLE PUBLIC
========================================================= */
 
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
   * =======================================================
   * XÁC ĐỊNH PREFIX
   * =======================================================
   *
   * 1. Explicit prefix: Góc, Góc 2MT, HXH, HXT, HXM, ...
   * 2. Nếu không có explicit prefix:
   *    Dòng số nhà có "/" => Hẻm
   *    Không "/" => Mặt Tiền
   *
   * QUAN TRỌNG: `context` ở đây PHẢI là dữ liệu THÔ
   * (address / description / raw_input) — KHÔNG được lẫn
   * `title` đã qua xử lý, vì title có thể đã lưu sai/cũ.
   */
  const prefix =
    detectExplicitPrefix(context) ||
    (hasAddressSlash(context)
      ? "Hẻm"
      : "Mặt Tiền");
 
  /**
   * Xóa thông tin nội bộ.
   */
  const cleanedAddress = addressLine
    .replace(PHONE_PATTERN, "")
    .replace(INTERNAL_HH_PATTERN, "")
    .replace(INTERNAL_CONTACT_PATTERN, "")
    .trim();
 
  /**
   * =======================================================
   * QUAN TRỌNG:
   *
   * stripLeadingPrivateParts() sẽ bỏ số nhà — kể cả khi có
   * NHIỀU số nhà liền kề (vd "338 340 ..." hay "157 159 161 ...")
   * vì HOUSE_NUMBER_AT_START đã hỗ trợ lặp lại token số nhà.
   *
   * Ví dụ:
   *
   * 192/2 Nguyễn Oanh, P.17, Q.Gò Vấp
   * => Nguyễn Oanh, P.17, Q.Gò Vấp
   *
   * 338 340 Trần Văn Giàu Q.Bình Tân
   * => Trần Văn Giàu Q.Bình Tân
   *
   * Nhưng PREFIX đã được xác định TRƯỚC đó là Hẻm/Mặt Tiền (dựa
   * trên `context`, không phải trên chuỗi đã bị cắt số nhà này).
   * =======================================================
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
   * Fallback tìm Quận nếu cần.
   */
  if (!district) {
    const match = street.match(
      /(?:^|[\s,-]+)(Quận\s+(?:\d+|Tân\s+Bình|Tan\s+Binh|Thủ\s+Đức|Thu\s+Duc|Gò\s+Vấp|Go\s+Vap|Bình\s+Thạnh|Binh\s+Thanh|Phú\s+Nhuận|Phu\s+Nhuan|Tân\s+Phú|Tan\s+Phu|Bình\s+Tân|Binh\s+Tan|Bình\s+Chánh|Binh\s+Chanh))\s*$/iu,
    );
 
    if (match?.[1]) {
      district =
        normalizeDistrictName(match[1]);
 
      street = street
        .slice(
          0,
          match.index ?? street.length,
        )
        .replace(/[\s,-]+$/u, "")
        .trim();
    }
  }
 
  /**
   * Không bao giờ để số nhà quay lại.
   */
  street = street
    .replace(
      HOUSE_NUMBER_AT_START,
      "",
    )
    .trim();
 
  /**
   * Chuẩn hóa tên đường.
   */
  street =
    normalizePublicTitleText(street);
 
  street = street
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    .trim();
 
  /**
   * Kết quả cuối: Prefix - Đường - Phường (nếu có, đã nằm
   * sẵn trong `street`) - Quận.
   */
  const result = [
    prefix,
    street,
    district,
  ]
    .filter(Boolean)
    .join(" - ")
    .replace(/\s*-\s*-\s*/g, " - ")
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
  const vnd =
    Math.round(
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
  const normalized = value
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
 
  return Number(normalized) || 0;
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
        parseUsdNumber(numberPart);
 
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
      parseUsdNumber(numberPart);
 
    if (usd > 0) {
      return convertUsdToVnd(usd);
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
    .replace(/\/tháng/iu, "/tháng");
}
 
/* =========================================================
   EXTRACT SIZE (NxN)
========================================================= */
 
/**
 * Trích kích thước dạng "NxN" (vd "4x16" -> "4x16").
 *
 * FIX: trước đây hàm này trả về nguyên văn match được kể cả khi
 * đó là dữ liệu rác/placeholder kiểu "0x0" hoặc "0x5" -> khiến
 * giao diện public hiển thị "0x0" thay vì để trống/fallback diện
 * tích tổng. Giờ validate width/depth phải > 0 mới trả kết quả.
 */
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
 
  const cleaned = match[0]
    .replace(/\s*[xX×]\s*/u, "x")
    .replace(/\s+/g, "")
    .replace(/m$/iu, "");
 
  const [widthRaw, depthRaw] = cleaned.split(/x/iu);
  const width = Number((widthRaw || "").replace(",", "."));
  const depth = Number((depthRaw || "").replace(",", "."));
 
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(depth) ||
    width <= 0 ||
    depth <= 0
  ) {
    return "";
  }
 
  return cleaned;
}
 
/**
 * Diện tích hiển thị public — ưu tiên kích thước "NxN" (vd "4x16").
 * Nếu tin KHÔNG có kích thước NxN hợp lệ mà chỉ có diện tích tổng
 * (vd "diện tích 600m2" hoặc chỉ ghi "600m2"), trả về "600m²" thay
 * vì để trống / hiện "0x0".
 */
export function extractPublicArea(
  rawText: string,
): string {
  const text = asText(rawText);
 
  const sizeMatch = extractPublicSize(text);
 
  if (sizeMatch) {
    return sizeMatch;
  }
 
  const totalMatch = text.match(TOTAL_AREA_PATTERN);
 
  if (totalMatch) {
    const raw = totalMatch[1] || totalMatch[2];
    const num = Number(raw.replace(",", "."));
 
    if (Number.isFinite(num) && num > 0) {
      return `${num}m²`;
    }
  }
 
  return "";
}
 
/* =========================================================
   BỀ NGANG MẶT TIỀN / SỐ TẦNG
========================================================= */
 
/**
 * Bề ngang mặt tiền (m) — lấy số ĐẦU trong kích thước dạng NxN
 * (vd "9x18" -> 9). Chỉ dùng làm fallback khi listing không có
 * field frontage_width riêng trong DB.
 */
export function extractPublicFrontageWidth(
  rawText: string,
): number | null {
  const sizeMatch = extractPublicSize(rawText);
 
  if (!sizeMatch) {
    return null;
  }
 
  const [widthRaw] = sizeMatch.split(/x/iu);
  const width = Number((widthRaw || "").replace(",", "."));
 
  return Number.isFinite(width) && width > 0 ? width : null;
}
 
/**
 * Số tầng (kể cả trệt) — đọc từ dạng "1 Trệt 2 Lầu", "3 tầng", hoặc
 * chỉ "Trệt" (mặc định 1 nếu không có số phía trước, cùng quy tắc
 * với formatPublicStructureDisplay bên dưới). Chỉ dùng làm fallback
 * khi listing không có field floors riêng trong DB.
 */
export function extractPublicFloors(
  rawText: string,
): number | null {
  const text = asText(rawText);
 
  const floorMatch = text.match(FLOOR_COUNT_PATTERN);
  const hasTret = HAS_TRET_PATTERN.test(text);
 
  if (floorMatch) {
    const n = Number(floorMatch[1]);
 
    if (!Number.isFinite(n)) {
      return null;
    }
 
    return hasTret ? n + 1 : n;
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
      /^\s*\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*m?\s*/,
      "",
    );
 
  structure =
    structure
      .replace(/\s+/g, " ")
      .replace(/^[\s,;:.-]+/u, "")
      .replace(/[\s,;:.-]+$/u, "")
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
 
  let structure = text.slice(
    sizeMatch.index +
      sizeMatch[0].length,
  );
 
  const hiddenInfoPatterns: RegExp[] = [
    PRICE_PATTERN,
    USD_PRICE_PATTERN,
    PHONE_PATTERN,
 
    // Dùng INTERNAL_HH_PATTERN (mạnh hơn /\bhh\b/) để bắt được
    // cả các biến thể dính liền như hhtt, hh1/2, hh5n1t...
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
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, " ")
      .trim();
 
  return structure;
}
 
/* =========================================================
   MỞ RỘNG VIẾT TẮT TRONG KẾT CẤU (KC)
========================================================= *
 *
 * Nhận diện & giải nghĩa các viết tắt hay gặp:
 *
 * TM       -> Có Thang Máy
 * Full NT  -> Full Nội Thất
 * NTCB     -> Nội Thất Cơ Bản
 * Có NT    -> Có Nội Thất
 * PCCC     -> Có PCCC
 * Npn      -> N Phòng Ngủ
 * Nwc      -> N WC
 * Np       -> N Phòng (chỉ khi không phải "pn")
 *
 * Ngoài ra: nếu bắt đầu bằng "trệt" mà không có số phía
 * trước, tự thêm "1" (VD: "trệt 5 lầu" -> "1 Trệt 5 lầu").
 * =========================================================
 */
 
const STRUCTURE_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bfull\s*nt\b/giu, "Full Nội Thất"],
  [/\bntcb\b/giu, "Nội Thất Cơ Bản"],
  [/\bcó\s*nt\b/giu, "Có Nội Thất"],
  [/\bpccc\b/giu, "Có PCCC"],
  [/\btm\b/giu, "Có Thang Máy"],
];
 
const formatPublicStructureDisplay = (
  rawStructure: string,
): string => {
  let text = asText(rawStructure);
 
  if (!text) {
    return "";
  }
 
  // Cụm nhiều chữ / dễ đụng độ xử lý trước.
  for (const [pattern, replacement] of STRUCTURE_PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
 
  // Số phòng ngủ: 6pn -> 6 Phòng Ngủ
  text = text.replace(/\b(\d+)\s*pn\b/giu, "$1 Phòng Ngủ");
 
  // WC: 4wc -> 4 WC
  text = text.replace(/\b(\d+)\s*wc\b/giu, "$1 WC");
 
  // Số phòng chung chung: 22p -> 22 Phòng
  // (an toàn, không đụng "pn" vì \b không khớp giữa p và n)
  text = text.replace(/\b(\d+)\s*p\b/giu, "$1 Phòng");
 
  // Mặc định "1 Trệt" nếu chỉ ghi "trệt" (không có số phía trước).
  text = text.replace(/^\s*(\d+)\s*trệt\b/iu, "$1 Trệt");
  text = text.replace(/^\s*trệt\b/iu, "1 Trệt");
 
  text = text.replace(/\s+/g, " ").trim();
 
  // Viết hoa chữ cái đầu mỗi từ cho chuyên nghiệp, không đụng
  // vào các từ/số đã đúng hoa sẵn từ bước thay thế ở trên.
  text = text
    .split(" ")
    .map((word) => {
      if (!word) return word;
 
      if (/^[A-ZÀ-Ỹ0-9]/u.test(word)) {
        return word;
      }
 
      return word.charAt(0).toUpperCase() + word.slice(1);
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
   * Dùng để trích tên đường / quận. Ưu tiên:
   *
   * 1. `title` nếu đã có sẵn (thường được rút gọn đẹp cho public).
   * 2. Nếu không có title -> CHỌN DÒNG ĐỊA CHỈ TỐT NHẤT trong toàn
   *    bộ dữ liệu thô (address/description/raw_input), thay vì chỉ
   *    lấy dòng đầu tiên của `address` như trước — vì dòng đầu tiên
   *    có thể là nhãn rút gọn thiếu số nhà, hoặc dòng kích thước.
   * 3. Cuối cùng mới fallback về `address` thô nếu không tìm được
   *    dòng nào đủ tín hiệu địa chỉ.
   */
  const bestRawAddressLine =
    selectBestAddressLine(rawText);
 
  const addressSource =
    title || bestRawAddressLine || address;
 
  /**
   * QUAN TRỌNG — PHẢI khai báo trước đoạn `return` bên dưới:
   *
   * Dùng riêng để xác định Hẻm / Mặt Tiền — CHỈ dựa vào dữ liệu
   * THÔ (address / description / raw_input), KHÔNG dùng `title`
   * vì title có thể đã lưu sai/cũ từ trước, gây vòng lặp tự sai.
   */
  const prefixContext =
    [address, description, rawInput]
      .filter(Boolean)
      .join("\n") || addressSource;
 
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
     BỀ NGANG MẶT TIỀN / SỐ TẦNG
  ======================================================= */
 
  const dbFrontageWidth =
    asNumber(listing.frontage_width);
 
  const dbFloors =
    asNumber(listing.floors);
 
  const frontageWidth =
    dbFrontageWidth !== null && dbFrontageWidth > 0
      ? dbFrontageWidth
      : extractPublicFrontageWidth(rawText);
 
  const floors =
    dbFloors !== null && dbFloors > 0
      ? dbFloors
      : extractPublicFloors(rawText);
 
  /* =======================================================
     CẤU TRÚC
  ======================================================= */
 
  const extractedStructure =
    extractPublicStructure(
      rawText,
    );
 
  const structuredStructure =
    asText(listing.structure);
 
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
     STRUCTURE PUBLIC (đã giải nghĩa viết tắt: TM, NT, PCCC...)
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
     * 192/2 Nguyễn Oanh, P.17, Q.Gò Vấp
     * => Hẻm - Nguyễn Oanh - P.17 - Quận Gò Vấp
     *
     * 180 Hồng Bàng, P.12, Q.5
     * => Mặt Tiền - Hồng Bàng - P.12 - Quận 5
     *
     * 2MT 276 Quốc lộ 1K Thủ Đức
     * => Hai Mặt Tiền - Quốc lộ 1K - Quận Thủ Đức
     *
     * "Mặt Tiền - 340 Trần Văn Giàu - Quận Bình Tân" +
     * "9x18·1 Trệt 2 Lầu Suốt" +
     * "338 340 Trần Văn Giàu Q.Bình Tân"
     * => Mặt Tiền - Trần Văn Giàu - Quận Bình Tân
     *
     * 157 159 161 Hoàng Văn Thụ Q.Phú Nhuận
     * => Mặt Tiền - Hoàng Văn Thụ - Quận Phú Nhuận
     *
     * 2/45/3 Nguyễn Văn Trỗi Q.Phú Nhuận
     * => Hẻm - Nguyễn Văn Trỗi - Quận Phú Nhuận
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
     * Số Zalo/liên hệ công khai của hệ thống — an toàn hiển thị
     * cho khách, KHÔNG phải SĐT thật của môi giới/chủ tin.
     */
    contactPhone: PUBLIC_CONTACT_PHONE,
  };
}
 