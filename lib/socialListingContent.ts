import { parseZaloListingText } from "@/lib/zaloListingParser";

export type SocialListing = {
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

  latitude?: number | string | null;
  longitude?: number | string | null;
  geocode_status?: string | null;
};

export type NearbyPlace = {
  name: string;
  category: string;
  distanceMeters?: number;
};

export type SocialListingContentOptions = {
  /**
   * SĐT liên hệ cuối bài.
   * Được truyền từ social/next-job thông qua getDefaultPhone().
   */
  contactPhone?: string;

  /**
   * Nhãn liên hệ, ví dụ:
   * "Môi giới", "Anh Minh", ...
   */
  contactLabel?: string;

  /**
   * Nội dung gốc của tin Zalo / listing.
   */
  rawText?: string | null;

  /**
   * Danh sách POI thật sự đã được tìm thấy.
   */
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
   BASIC HELPERS
========================================================= */

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

function titleCaseVietnamese(value: string) {
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
   ADDRESS
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
    regex: /\bhxh\b|\bhem\s*xe\s*hoi\b/i,
    label: "Hẻm Xe Hơi",
  },
  {
    regex: /\bhxt\b|\bhem\s*xe\s*tai\b/i,
    label: "Hẻm Xe Tải",
  },
  {
    regex: /\bhxm\b|\bhem\s*xe\s*may\b/i,
    label: "Hẻm Xe Máy",
  },
  {
    regex: /\bh3g\b|\bhem\s*ba\s*gac\b/i,
    label: "Hẻm Ba Gác",
  },
  {
    regex: /\bmb\b|\bmat\s*bang\b/i,
    label: "Mặt Bằng",
  },
  {
    regex: /\bmt\b|\bmat\s*tien\b/i,
    label: "Mặt Tiền",
  },
];

function detectAddressPrefix(raw: string) {
  const normalized = normalizeText(raw);

  for (const item of ADDRESS_PREFIXES) {
    if (item.regex.test(normalized)) {
      return item.label;
    }
  }

  const firstLine = raw.split("\n")[0] ?? "";

  /*
   * Quy tắc:
   *
   * Có "/" trong địa chỉ => Hẻm
   * Không có "/" => Mặt Tiền
   */
  return firstLine.includes("/") ? "Hẻm" : "Mặt Tiền";
}

/**
 * Chuyển địa chỉ thành địa chỉ PUBLIC.
 *
 * Ví dụ:
 *
 * "215 Thành Công, P.14, Q.Tân Bình"
 * =>
 * "Thành Công"
 *
 * "24 Hoàng Văn Thụ, P.4, Q.Tân Bình"
 * =>
 * "Hoàng Văn Thụ"
 *
 * Tuyệt đối không public số nhà.
 */
function extractPublicStreet(raw: string) {
  const firstLine = raw.split("\n")[0] ?? "";

  let value = firstLine;

  // Bỏ các mã loại mặt bằng ở đầu.
  value = value.replace(
    /^\s*(?:góc\s*2\s*mt|góc\s*2\s*mb|2\s*mt|2\s*mb|góc|hxh|hxt|hxm|h3g|mb|mt)\s*/i,
    "",
  );

  // Bỏ số nhà / số hẻm ở đầu.
  value = value.replace(
    /^\s*\d+[\w./-]*\s+/i,
    "",
  );

  // Bỏ P./Phường/Q./Quận phía sau tên đường.
  value = value.replace(
    /,?\s*(?:P\.?\s*[\w\d]+|Phường\s+[^,]+|Q\.?\s*[\w\d]+|Quận\s+[^,]+)\s*$/i,
    "",
  );

  // Chỉ lấy phần trước dấu phẩy đầu tiên.
  value = value.split(",")[0].trim();

  return value ? titleCaseVietnamese(value) : null;
}

function getPublicDistrict(
  listing: SocialListing,
  parsed: ReturnType<typeof parseZaloListingText>,
) {
  return (
    clean(listing.district) ||
    clean(parsed.district) ||
    null
  );
}

function getPublicWard(
  listing: SocialListing,
  parsed: ReturnType<typeof parseZaloListingText>,
  rawText: string,
) {
  const listingWard = clean(listing.ward);

  if (listingWard) {
    return listingWard;
  }

  const source = `${parsed.address || ""}\n${rawText || ""}`;

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

function getStructure(raw: string) {
  const normalized = normalizeText(raw);

  const parts: string[] = [];

  const basement =
    /\bham\b/.test(normalized);

  const mezzanine =
    /\blung\b|\bmezzanine\b/.test(normalized);

  const tret = normalized.match(
    /(\d+)?\s*tret\b/,
  );

  const floor = normalized.match(
    /(\d+)\s*lau\b/,
  );

  const floorShort = normalized.match(
    /(\d+)\s*l\b(?!\w)/,
  );

  const st =
    /\bst\b|\bsan\s*thuong\b/.test(normalized);

  const rooms = normalized.match(
    /(\d+)\s*(?:pn\b|phong\s*ngu\b)/,
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
    parts.push(`${floor[1]} Lầu`);
  } else if (floorShort?.[1]) {
    parts.push(`${floorShort[1]} Lầu`);
  }

  if (st) {
    parts.push("Sân Thượng");
  }

  if (rooms?.[1]) {
    parts.push(`${rooms[1]} Phòng`);
  }

  return parts.join(" ");
}

/* =========================================================
   EXTRAS
========================================================= */

function getExtras(raw: string) {
  const normalized = normalizeText(raw);

  const extras: string[] = [];

  if (
    /\bfull\s*nt\b/.test(normalized) ||
    /\bfull\s*noi\s*that\b/.test(normalized)
  ) {
    extras.push("Full Nội Thất");
  }

  if (
    /\bntcb\b/.test(normalized) ||
    /\bnoi\s*that\s*co\s*ban\b/.test(normalized)
  ) {
    extras.push("Nội Thất Cơ Bản");
  }

  if (
    /\bco\s*nt\b/.test(normalized) ||
    /\bco\s*noi\s*that\b/.test(normalized)
  ) {
    extras.push("Có Nội Thất");
  }

  if (/\bpccc\b/.test(normalized)) {
    extras.push("PCCC");
  }

  if (
    /\bktm\b/.test(normalized) ||
    /\bkhong\s*thang\s*may\b/.test(normalized)
  ) {
    extras.push("Không Thang Máy");
  } else if (
    /\btm\b/.test(normalized) ||
    /\bthang\s*may\b/.test(normalized)
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
  listing: SocialListing,
  parsed: ReturnType<typeof parseZaloListingText>,
) {
  const match = normalizeText(raw).match(
    /(\d+)\s*(?:pn\b|phong\s*ngu\b)/,
  );

  return match?.[1]
    ? Number(match[1])
    : Number(
        listing.bedrooms ??
          parsed.bedrooms ??
          0,
      ) || null;
}

function getBathrooms(
  raw: string,
  listing: SocialListing,
  parsed: ReturnType<typeof parseZaloListingText>,
) {
  const match = normalizeText(raw).match(
    /(\d+)\s*(?:wc\b|toilet\b|nha\s*ve\s*sinh\b)/,
  );

  return match?.[1]
    ? Number(match[1])
    : Number(
        listing.bathrooms ??
          parsed.bathrooms ??
          0,
      ) || null;
}

/* =========================================================
   PRICE
========================================================= */

function formatPrice(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  if (number >= 1_000_000_000) {
    const billions =
      number / 1_000_000_000;

    return `${Number.isInteger(billions) ? billions : billions.toFixed(1)} tỷ`;
  }

  if (number >= 1_000_000) {
    const millions =
      number / 1_000_000;

    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}tr`;
  }

  return number.toLocaleString("vi-VN");
}

/* =========================================================
   DIMENSIONS
========================================================= */

function getDimensions(
  listing: SocialListing,
  parsed: ReturnType<typeof parseZaloListingText>,
  raw: string,
) {
  const size = raw.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i,
  );

  if (size) {
    return `${size[1].replace(",", ".")}x${size[2].replace(",", ".")}`;
  }

  if (parsed.width && parsed.length) {
    return `${parsed.width}x${parsed.length}`;
  }

  if (listing.width && listing.length) {
    return `${listing.width}x${listing.length}`;
  }

  if (listing.area || parsed.area) {
    return `${listing.area ?? parsed.area}m²`;
  }

  return "";
}

/* =========================================================
   PHÙ HỢP
 *
 * QUAN TRỌNG:
 *
 * Không tự suy CHDV chỉ vì nhà có nhiều phòng.
 * Chỉ thêm CHDV khi raw thực sự có CHDV / căn hộ dịch vụ.
========================================================= */

function buildSuitableFor(raw: string) {
  const normalized = normalizeText(raw);

  const result: string[] = [];

  const hasCHDV =
    /\bchdv\b/.test(normalized) ||
    /can\s*ho\s*dich\s*vu/.test(normalized) ||
    /cho\s*thue\s*can\s*ho\s*dich\s*vu/.test(normalized) ||
    /cho\s*chdv/.test(normalized) ||
    /lam\s*chdv/.test(normalized);

  const hasHomestay =
    /\bhomestay\b/.test(normalized) ||
    /cho\s*homestay/.test(normalized);

  const hasHotel =
    /\bkhach\s*san\b/.test(normalized) ||
    /luu\s*tru/.test(normalized) ||
    /nha\s*nghi/.test(normalized);

  const hasOffice =
    /\bvan\s*phong\b/.test(normalized) ||
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
    /phong\s*kham/.test(normalized) ||
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
    result.push("🛏️ Căn hộ dịch vụ");
  }

  if (hasHomestay) {
    result.push("🏠 Homestay");
  }

  if (hasHotel) {
    result.push("🏨 Khách sạn / lưu trú / nhà nghỉ");
  }

  if (hasOffice) {
    result.push("🏢 Văn phòng công ty");
  }

  if (hasShowroom) {
    result.push("🏬 Showroom");
  }

  if (hasShop) {
    result.push("🛍️ Cửa hàng / bán lẻ");
  }

  if (hasSpa) {
    result.push("💆 Spa / nail / salon / thẩm mỹ");
  }

  if (hasClinic) {
    result.push("🏥 Phòng khám / clinic / nha khoa");
  }

  if (hasRestaurant) {
    result.push("🍜 Nhà hàng / café / ăn uống");
  }

  if (hasWarehouse) {
    result.push("📦 Kho / xưởng");
  }

  /*
   * Chỉ thêm nhóm ở nếu tin thực sự có dấu hiệu cho thuê ở.
   */
  if (
    /gia\s*dinh/.test(normalized) ||
    /\bo\b/.test(normalized) ||
    /nh[aà]\s*nguyen\s*can/.test(normalized) ||
    /nha\s*nguyen\s*can/.test(normalized)
  ) {
    result.push("🏠 Gia đình / ở lâu dài");
  }

  return [...new Set(result)];
}

/* =========================================================
   XUNG QUANH
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
) {
  const seen = new Set<string>();

  return places
    .filter((place) => place?.name)
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
      const key = normalizeText(place.name);

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
) {
  const nearby = cleanNearbyPlaces(places);

  /*
   * KHÔNG BỊA ĐỊA ĐIỂM.
   *
   * Nếu chưa có POI thật thì chỉ mô tả vị trí bằng
   * tên đường + quận, tuyệt đối không tự nghĩ ra
   * trường học, công viên, chợ, cầu vượt...
   */
  if (!nearby.length) {
    const locationParts = [
      street ? `trên đường ${street}` : "",
      district ? `${district}` : "",
    ].filter(Boolean);

    if (!locationParts.length) {
      return "Vị trí thuận tiện kết nối các tuyến đường chính trong khu vực.";
    }

    return `Vị trí ${locationParts.join(", ")}, thuận tiện kết nối các tuyến đường chính và tiện ích xung quanh.`;
  }

  /*
   * Có POI thật → phải đưa TÊN THẬT vào bài.
   */
  const parts = nearby.slice(0, 5).map((place) => {
    if (
      typeof place.distanceMeters === "number" &&
      Number.isFinite(place.distanceMeters)
    ) {
      const distance = place.distanceMeters;

      if (distance < 1000) {
        return `${place.name} (~${Math.round(distance)}m)`;
      }

      return `${place.name} (~${(distance / 1000).toFixed(1)}km)`;
    }

    return place.name;
  });

  return `Vị trí ${street ? `trên đường ${street}, ` : ""}${
    district ? `${district}, ` : ""
  }gần ${parts.join(", ")}. Thuận tiện di chuyển, nhận diện vị trí và tiếp cận các tiện ích, khu dân cư và khu vực kinh doanh xung quanh.`;
}

/* =========================================================
   BUILD
========================================================= */

export function buildSocialListingContent(
  listing: SocialListing,
  options: SocialListingContentOptions = {},
): SocialListingContentResult {
  /*
   * Ưu tiên rawText.
   * Nếu không có thì dùng description.
   * Cuối cùng mới ghép dữ liệu listing.
   */
  const raw =
    clean(options.rawText) ||
    clean(listing.description) ||
    [
      listing.address,
      listing.area,
      listing.width && listing.length
        ? `${listing.width}x${listing.length}`
        : "",
      listing.floors,
      listing.bedrooms
        ? `${listing.bedrooms}pn`
        : "",
      listing.bathrooms
        ? `${listing.bathrooms}wc`
        : "",
      listing.title,
    ]
      .filter(Boolean)
      .join("\n");

  const parsed =
    parseZaloListingText(raw);

  /* =========================
     ADDRESS
  ========================= */

  const prefix =
    detectAddressPrefix(raw);

  const publicStreet =
    clean(listing.street) ||
    extractPublicStreet(raw);

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

  /* =========================
     PROPERTY INFO
  ========================= */

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

  /* =========================
     TITLE
  ========================= */

  const titleParts = [
    prefix,
    publicStreet,
    ward,
    district,
  ].filter(Boolean);

  const title =
    titleParts.join(" ");

  /* =========================
     NEARBY
  ========================= */

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

  /* =========================
     CONTENT
  ========================= */

  const lines: string[] = [];

  lines.push(
    title || "Mặt Bằng Cho Thuê",
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

  if (bedrooms || bathrooms) {
    const roomParts: string[] = [];

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

  /*
   * PHÙ HỢP:
   * Chỉ xuất hiện khi có dữ liệu thật.
   */
  if (suitableFor.length) {
    lines.push("");

    lines.push(
      "🔥 PHÙ HỢP:",
    );

    for (const item of suitableFor) {
      lines.push(item);
    }
  }

  /*
   * XUNG QUANH:
   * Luôn có section nhưng tuyệt đối
   * không bịa tên địa điểm.
   */
  lines.push("");

  lines.push(
    `📍 XUNG QUANH: ${nearbyText}`,
  );

  /* =========================
     CONTACT
  ========================= */

  const contactPhone =
    clean(options.contactPhone);

  if (contactPhone) {
    lines.push("");

    lines.push(
      `📞 Liên hệ: ${contactPhone}${
        options.contactLabel
          ? ` (${clean(options.contactLabel)})`
          : ""
      }`,
    );
  }

  /* =========================
     RESULT
  ========================= */

  return {
    title,

    content:
      lines.join("\n").trim(),

    publicStreet,

    district,

    ward,

    suitableFor,

    extras,

    nearbyPlaces,
  };
}