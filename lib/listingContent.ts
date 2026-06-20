export type ListingContentInput = {
  title?: string | null;
  address?: string | null;
  district?: string | null;
  price?: string | number | null;
  description?: string | null;
  dimensions?: string | null;
  structure?: string | null;
  bedrooms?: string | number | null;
  wc?: string | number | null;
  contact_phone?: string | null;
};

export type ListingContentResult = {
  primary_content: string;
  cho_tot_title: string;
  facebook_title: string;
  short_description: string;
  seo_description: string;
};

type ParsedListingFacts = {
  location: string;
  street: string;
  ward: string;
  district: string;
  districtShort: string;
  dimensions: string;
  area: number | null;
  structureParts: string[];
  priceLong: string;
  priceShort: string;
  access: string;
  businesses: string[];
  rawText: string;
};

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (/^q\.?\d+$/i.test(word)) return word.toUpperCase().replace(".", "");
      if (/^p\.?$/i.test(word)) return "P.";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

const namedDistricts = [
  ["phu nhuan", "Phú Nhuận"],
  ["binh thanh", "Bình Thạnh"],
  ["go vap", "Gò Vấp"],
  ["tan binh", "Tân Bình"],
  ["tan phu", "Tân Phú"],
  ["thu duc", "Thủ Đức"],
  ["binh tan", "Bình Tân"],
] as const;

const getCanonicalDistrict = (value: unknown) => {
  const raw = compactText(value);
  const normalized = normalizeText(raw)
    .replace(/^q\.?\s*/, "")
    .replace(/^quan\s+/, "")
    .trim();
  const numericMatch = normalized.match(/^(\d{1,2})$/);

  if (numericMatch) return `Quận ${Number(numericMatch[1])}`;

  const named = namedDistricts.find(([key]) => normalized === key);
  if (named) return named[1];

  if (/^quan\s+/i.test(raw)) return titleCase(raw);
  if (/^q\.?\s*/i.test(raw)) return titleCase(raw.replace(/^q\.?\s*/i, "Quận "));

  return raw ? titleCase(raw) : "";
};

const trimWords = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) return normalized;

  const sliced = normalized.slice(0, maxLength + 1);
  const lastSpace = sliced.lastIndexOf(" ");

  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced.slice(0, maxLength)).trim();
};

const fitSeoLength = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  const extended =
    normalized.length >= 140
      ? normalized
      : `${normalized} Liên hệ xem nhà thực tế, hỗ trợ kiểm tra hiện trạng và thương lượng thuê.`;

  return trimWords(extended, 160).replace(/[,\s]+$/, ".");
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const parsePriceValue = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = normalizeText(raw);
  const millionMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tr\b|trieu\b)/);

  if (millionMatch) {
    const amount = Number(millionMatch[1].replace(",", "."));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return numeric >= 1000000 ? numeric / 1000000 : numeric;
};

export const formatListingPriceLabel = (price: ListingContentInput["price"]) => {
  const amount = parsePriceValue(price);
  return amount ? `${formatNumber(amount)} triệu/tháng` : compactText(price);
};

const formatShortPrice = (price: string) => {
  const amount = parsePriceValue(price);
  return amount ? `${formatNumber(amount)}tr/tháng` : price;
};

const extractDistrict = (input: ListingContentInput, rawText: string) => {
  const explicitDistrict = compactText(input.district);
  if (explicitDistrict) return getCanonicalDistrict(explicitDistrict);

  const districtMatch =
    rawText.match(/\bQ\.?\s*(\d{1,2})\b/i) ||
    rawText.match(/\bQuận\s*(\d{1,2})\b/i);

  if (districtMatch) return `Quận ${Number(districtMatch[1])}`;

  const normalized = normalizeText(rawText);
  const qNamedMatch = normalized.match(/\bq\.?\s*([a-z]+(?:\s+[a-z]+){0,2})\b/);
  if (qNamedMatch) {
    const district = getCanonicalDistrict(qNamedMatch[1]);
    if (district) return district;
  }

  return namedDistricts.find(([key]) => normalized.includes(key))?.[1] || "";
};

const getDistrictShort = (district: string) => {
  const match = district.match(/(\d{1,2})/);
  return match ? `Q${Number(match[1])}` : district;
};

const getDisplayDistrict = (district: string) =>
  district && !/^quận\s+/i.test(district) ? `Quận ${district}` : district;

const extractWard = (rawText: string) => {
  const wardMatch =
    rawText.match(/\bP\.\s*([^,\n]+?)(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i) ||
    rawText.match(/\bPhường\s+([^,\n]+?)(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i);

  return wardMatch ? `P.${titleCase(wardMatch[1])}` : "";
};

const extractDimensions = (input: ListingContentInput, rawText: string) => {
  const explicit = compactText(input.dimensions);
  const match =
    explicit.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i) ||
    rawText.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);

  if (!match) return { dimensions: explicit, area: null as number | null };

  const width = Number(match[1].replace(",", "."));
  const length = Number(match[2].replace(",", "."));
  const area =
    Number.isFinite(width) && Number.isFinite(length)
      ? Math.round(width * length * 10) / 10
      : null;

  return {
    dimensions: `${formatNumber(width)}x${formatNumber(length)}m`,
    area,
  };
};

const extractStructureParts = (input: ListingContentInput, rawText: string) => {
  const normalized = normalizeText(`${input.structure || ""} ${rawText}`);
  const parts: string[] = [];

  if (/\btret\b/.test(normalized)) parts.push("Trệt");
  if (/\blung\b/.test(normalized)) parts.push("lửng");

  const floorMatch = normalized.match(/\b([1-9]\d*)\s*lau\b/);
  if (floorMatch) {
    const suffix = /\bsuot\b/.test(normalized) ? " suốt" : "";
    parts.push(`${Number(floorMatch[1])} lầu${suffix}`);
  } else if (compactText(input.structure)) {
    parts.push(compactText(input.structure));
  }

  return Array.from(new Set(parts));
};

const extractAccess = (rawText: string, street: string) => {
  const normalized = normalizeText(rawText);

  if (/\b(?:mat tien|mt)\b/.test(normalized)) return "Mặt tiền";
  if (/\b(?:hxt|hem xe tai)\b/.test(normalized)) return "Hẻm xe tải";
  if (/\b(?:hxh|hem xe hoi)\b/.test(normalized)) return "Hẻm xe hơi";

  return street ? "Mặt tiền" : "";
};

const extractStreet = (
  input: ListingContentInput,
  rawText: string
) => {
  const source =
    compactText(input.address) ||
    compactText(input.title) ||
    rawText.split(/\n+/).map((line) => line.trim()).find(Boolean) ||
    "";
  const cleaned = source
    .replace(/\bP\.\s*[^,\n]+?(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i, " ")
    .replace(/\bPhường\s+[^,\n]+?(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i, " ")
    .replace(/\bQ\.?\s*\d{1,2}\b/gi, " ")
    .replace(/\bQ\.?\s*(?:Phú\s+Nhuận|Bình\s+Thạnh|Gò\s+Vấp|Tân\s+Bình|Tân\s+Phú|Thủ\s+Đức|Bình\s+Tân)\b/gi, " ")
    .replace(/\bQuận\s+(?:Phú\s+Nhuận|Bình\s+Thạnh|Gò\s+Vấp|Tân\s+Bình|Tân\s+Phú|Thủ\s+Đức|Bình\s+Tân)\b/gi, " ")
    .replace(/\bQuận\s*\d{1,2}\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:tr|triệu)\b/gi, " ")
    .replace(/\b(?:trệt|lửng|lầu|suốt|hhtt|tm|hxt|hxh|mt|mặt tiền)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return titleCase(cleaned).replace(/^\d+[A-Za-z]?\s*/, "").trim();
};

const parseListingFacts = (input: ListingContentInput): ParsedListingFacts => {
  const rawText = [
    input.title,
    input.address,
    input.district,
    input.price,
    input.dimensions,
    input.structure,
    input.description,
  ]
    .filter(Boolean)
    .join("\n");
  const district = extractDistrict(input, rawText);
  const districtShort = getDistrictShort(district);
  const ward = extractWard(rawText);
  const street = extractStreet(input, rawText);
  const { dimensions, area } = extractDimensions(input, rawText);
  const structureParts = extractStructureParts(input, rawText);
  const normalized = normalizeText(rawText);
  const rawPrice = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tr\b|trieu\b)/)?.[0] || "";
  const priceLong = formatListingPriceLabel(input.price) || formatListingPriceLabel(rawPrice);
  const priceShort = formatShortPrice(priceLong);
  const access = extractAccess(rawText, street);
  const hasCommercialSignal =
    /\b(?:tm|thuong mai|kinh doanh|mat bang|shop|spa|cafe|showroom)\b/.test(
      normalized
    );
  const businesses = [
    hasCommercialSignal || access === "Mặt tiền" ? "shop" : "",
    "spa",
    "showroom",
    "văn phòng đại diện",
    structureParts.some((part) => /\d+\s*lầu/.test(part)) ? "studio" : "",
  ].filter(Boolean);
  const location = [street, ward, district].filter(Boolean).join(", ");

  return {
    location: location || "Nhà cho thuê",
    street: street || "Nhà cho thuê",
    ward,
    district,
    districtShort,
    dimensions,
    area,
    structureParts,
    priceLong,
    priceShort,
    access,
    businesses: Array.from(new Set(businesses)),
    rawText,
  };
};

const getStructureText = (facts: ParsedListingFacts) =>
  facts.structureParts.join(", ");

const getChoTotStructure = (facts: ParsedListingFacts) =>
  getStructureText(facts)
    .replace(/\s+suốt\b/i, "")
    .replace(/,/g, "");

const getFacebookStructure = (facts: ParsedListingFacts) => {
  const floorPart = facts.structureParts.find((part) => /\d+\s*lầu/.test(part));
  return floorPart || getStructureText(facts);
};

const getBenefitLines = (facts: ParsedListingFacts) => {
  const lines = [
    facts.access ? `${facts.access} dễ nhận diện` : "",
    facts.district ? `Khu trung tâm ${facts.district}` : "",
    facts.structureParts.length ? "Mặt bằng dễ bố trí công năng" : "",
  ];

  return lines.filter(Boolean);
};

const getAreaText = (facts: ParsedListingFacts) => {
  if (!facts.dimensions) return "";
  return `${facts.dimensions}${facts.area ? `, khoảng ${facts.area}m2/sàn` : ""}`;
};

const buildFixedPrimaryContent = (
  facts: ParsedListingFacts,
  input: ListingContentInput
) => {
  const headlineAccess = facts.access === "Mặt tiền" ? "MẶT TIỀN" : facts.access.toUpperCase();
  const headline = [
    ["CHO THUÊ", headlineAccess, facts.street].filter(Boolean).join(" "),
    getDisplayDistrict(facts.district),
  ]
    .filter(Boolean)
    .join(" - ");
  const contactPhone = compactText(input.contact_phone);
  const lines = [
    `🔥 ${headline.toUpperCase()} 🔥`,
    "",
    facts.dimensions ? `📐 ${getAreaText(facts)}` : "",
    facts.structureParts.length ? `🏢 ${getStructureText(facts)}` : "",
    facts.priceLong ? `💰 ${facts.priceLong}` : "",
    "",
    ...getBenefitLines(facts).slice(0, 3).map((line) => `✅ ${line}`),
    facts.businesses.length ? `✅ Phù hợp: ${facts.businesses.join(", ")}` : "",
    "",
    contactPhone
      ? `☎ Liên hệ: ${contactPhone} để xem nhà thực tế.`
      : "☎ Liên hệ để xem nhà thực tế.",
  ];

  return lines
    .filter((line, index, allLines) => line || allLines[index - 1])
    .join("\n")
    .trim();
};

export const generateListingContentFallback = (
  input: ListingContentInput
): ListingContentResult => {
  const facts = parseListingFacts(input);
  const primaryContent = buildFixedPrimaryContent(facts, input);

  const choTotTitle = [
    `Cho thuê ${facts.access === "Mặt tiền" ? "MT" : facts.access || "nhà"} ${facts.street} ${facts.districtShort}`.trim(),
    facts.dimensions,
    getChoTotStructure(facts).toLowerCase(),
    facts.priceShort,
  ]
    .filter(Boolean)
    .join(", ");
  const facebookTitle = [
    `🔥 ${facts.access === "Mặt tiền" ? "MT" : facts.access || "Nhà thuê"} ${facts.street} ${facts.districtShort}`.trim(),
    facts.dimensions,
    getFacebookStructure(facts),
    facts.priceShort,
  ]
    .filter(Boolean)
    .join(" - ");
  const shortDescription = [
    `Cho thuê ${facts.access.toLowerCase() || "nhà"} ${facts.location}.`,
    [
      facts.dimensions ? `Diện tích ${getAreaText(facts)}` : "",
      facts.structureParts.length ? `kết cấu ${getStructureText(facts)}` : "",
      facts.priceLong ? `giá ${facts.priceLong}` : "",
    ]
      .filter(Boolean)
      .join(", ") + ".",
    facts.businesses.length ? `Phù hợp ${facts.businesses.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const seoDescription = fitSeoLength(
    `Cho thuê ${facts.access.toLowerCase() || "nhà"} ${facts.location}, ${
      facts.dimensions ? `diện tích ${facts.dimensions}` : "vị trí dễ nhận diện"
    }${facts.structureParts.length ? `, kết cấu ${getStructureText(facts)}` : ""}${
      facts.priceLong ? `, giá ${facts.priceLong}` : ""
    }. Phù hợp ${facts.businesses.join(", ")}.`
  );

  return {
    primary_content: primaryContent,
    cho_tot_title: trimWords(choTotTitle, 90),
    facebook_title: trimWords(facebookTitle, 100),
    short_description: shortDescription,
    seo_description: seoDescription,
  };
};

export const buildListingContentPrompt = (input: ListingContentInput) => {
  const facts = parseListingFacts(input);

  return `
Bạn là trợ lý viết bài đăng Facebook/Zalo cho môi giới cho thuê bất động sản.

Trả về JSON thuần gồm:
primary_content, cho_tot_title, facebook_title, short_description, seo_description.

Phong cách bắt buộc:
- primary_content phải dùng template cố định, không viết đoạn văn tự do:
🔥 CHO THUÊ MẶT TIỀN {STREET} - {DISTRICT} 🔥

📐 {SIZE_LABEL} ({AREA}m²)
🏢 {STRUCTURE}
💰 {PRICE}

✅ {ADVANTAGE_1}
✅ {ADVANTAGE_2}
✅ {ADVANTAGE_3}
✅ Phù hợp: {BUSINESS_TYPES}

☎ Liên hệ: {PHONE} để xem nhà thực tế.
- Không hiển thị dòng "Địa chỉ" trong primary_content.
- Nếu thiếu dữ liệu thì bỏ dòng đó.
- Không lặp lại cùng thông tin 2 lần trong một mục.
- Tiêu đề Chợ Tốt ngắn theo mẫu: Cho thuê MT Phó Đức Chính Q1, 4x16m, trệt lửng 4 lầu, 72tr/tháng
- Tiêu đề Facebook có hook theo mẫu: 🔥 MT Phó Đức Chính Q1 - 4x16m - 4 lầu suốt - 72tr/tháng
- Mô tả ngắn 2-3 câu.
- SEO description 140-160 ký tự, không cắt ngang chữ.
- Nếu có MT/mặt tiền hoặc không thấy hẻm, ưu tiên gọi là mặt tiền.

Dữ liệu đã parse:
- Vị trí: ${facts.location}
- Đường: ${facts.street}
- Phường: ${facts.ward || "chưa có"}
- Quận: ${facts.district || "chưa có"}
- Quận ngắn: ${facts.districtShort || "chưa có"}
- Diện tích: ${facts.dimensions || "chưa có"}
- Diện tích/sàn: ${facts.area ? `${facts.area}m2` : "chưa có"}
- Kết cấu: ${getStructureText(facts) || "chưa có"}
- Giá thuê: ${facts.priceLong || "chưa có"}
- Giá ngắn: ${facts.priceShort || "chưa có"}
- Loại vị trí: ${facts.access || "chưa có"}
- Ngành phù hợp: ${facts.businesses.join(", ") || "chưa có"}

Dữ liệu gốc:
${facts.rawText || "chưa có"}
`;
};

export const sanitizeListingContent = (
  value: Partial<ListingContentResult>,
  input: ListingContentInput
): ListingContentResult => {
  const fallback = generateListingContentFallback(input);

  return {
    primary_content: fallback.primary_content,
    cho_tot_title: compactText(value.cho_tot_title) || fallback.cho_tot_title,
    facebook_title:
      compactText(value.facebook_title) || fallback.facebook_title,
    short_description:
      compactText(value.short_description) || fallback.short_description,
    seo_description:
      compactText(value.seo_description) || fallback.seo_description,
  };
};
