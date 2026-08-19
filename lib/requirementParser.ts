import {
  getDistrictLabel,
  normalizeDistrictQuery,
  normalizeSearchText,
} from "@/lib/searchNormalization";

export type PriceMode = "target" | "max" | "range" | null;

export type ParsedRequirement = {
  rawText: string;
  businessTypes: string[];
  concepts: string[];
  preferredDistricts: string[];
  allowNearbyDistricts: boolean;
  preferredWards: string[];
  preferredStreets: string[];
  minArea?: number;
  maxArea?: number;
  targetArea?: number;
  targetWidth?: number;
  targetLength?: number;
  minPrice?: number;
  maxPrice?: number;
  targetPrice?: number;
  priceMode?: PriceMode;
  targetFloors?: number;
  minFloors?: number;
  hasRooftop?: boolean;
  hasMezzanine?: boolean;
  bedrooms: number | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  propertyTypes: string[];
  features: string[];
  targetCustomers: string[];
  purpose?: string;
};

export type ParsedRequirementFilters = ParsedRequirement & {
  preferred_districts: string[];
  preferred_streets: string[];
  max_price: number | null;
  min_price: number | null;
  target_price: number | null;
  min_area: number | null;
  max_area: number | null;
  target_area: number | null;
  target_width: number | null;
  target_length: number | null;
  target_floors: number | null;
  min_floors: number | null;
  has_rooftop: boolean;
  has_mezzanine: boolean;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  property_types: string[];
  keywordSearch: string | null;
  note: string;
};

type PatternItem = {
  label: string;
  patterns: RegExp[];
  district?: string;
};

const districtPatterns: PatternItem[] = [
  ...Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;

    return {
      label: `Quan ${number}`,
      patterns: [
        new RegExp(`\\bquan\\s*${number}\\b`, "i"),
        new RegExp(`\\bq\\s*\\.?\\s*${number}\\b`, "i"),
        new RegExp(`\\bq${number}\\b`, "i"),
      ],
    };
  }),
  { label: "Binh Thanh", patterns: [/\b(?:quan\s+)?binh\s+thanh\b/i] },
  { label: "Phu Nhuan", patterns: [/\b(?:quan\s+)?phu\s+nhuan\b/i] },
  { label: "Tan Binh", patterns: [/\b(?:quan\s+)?tan\s+binh\b/i] },
  { label: "Tan Phu", patterns: [/\b(?:quan\s+)?tan\s+phu\b/i] },
  { label: "Go Vap", patterns: [/\b(?:quan\s+)?go\s+vap\b/i] },
  { label: "Thu Duc", patterns: [/\b(?:quan\s+)?thu\s+duc\b/i] },
  { label: "Binh Tan", patterns: [/\b(?:quan\s+)?binh\s+tan\b/i] },
];

const wardPatterns: PatternItem[] = [
  { label: "Thao Dien", district: "Quan 2", patterns: [/\bthao\s+dien\b/i] },
  { label: "An Phu", district: "Quan 2", patterns: [/\ban\s+phu\b/i] },
];

const streetPatterns: PatternItem[] = [
  { label: "Le Thanh Ton", district: "Quan 1", patterns: [/\ble\s+thanh\s+ton\b/i] },
  { label: "Thai Van Lung", district: "Quan 1", patterns: [/\bthai\s+van\s+lung\b/i] },
  { label: "Nguyễn Trãi", patterns: [/\bnguyen\s+trai\b/i] },
  { label: "Hải Bà Trưng", patterns: [/\bhai\s+ba\s+trung\b/i] },
  { label: "Trần Hưng Đạo", patterns: [/\btran\s+hung\s+dao\b/i] },
];

const businessPatternItems: Array<PatternItem & { type: string }> = [
  { label: "Korean BBQ", type: "bbq", patterns: [/\bkorean\s+bbq\b/i, /\bhan\s+quoc\s+bbq\b/i] },
  { label: "BBQ", type: "bbq", patterns: [/\bbbq\b/i, /\bnha\s+hang\s+nuong\b/i, /\bquan\s+nuong\b/i] },
  { label: "Seafood", type: "seafood", patterns: [/\bseafood\b/i, /\bhai\s+san\b/i] },
  { label: "Wine Bar", type: "wine bar", patterns: [/\bwine\s+bar\b/i, /\bbar\s+ruou\b/i] },
  { label: "Restaurant", type: "restaurant", patterns: [/\brestaurant\b/i, /\bnha\s+hang\b/i, /\bquan\s+an\b/i, /\bf\s*&\s*b\b/i, /\bfnb\b/i] },
  { label: "Spa", type: "spa", patterns: [/\bspa\b/i, /\btham\s+my\b/i, /\bsalon\b/i, /\bnail\b/i, /\bmassage\b/i] },
  { label: "Cafe", type: "cafe", patterns: [/\bcafe\b/i, /\bca\s+phe\b/i, /\bcoffee\b/i] },
  { label: "Office", type: "office", patterns: [/\bvan\s+phong\b/i, /\boffice\b/i, /\bvp\b/i] },
];

const featurePatterns: PatternItem[] = [
  { label: "mat tien", patterns: [/\bmat\s+tien\b/i, /\bfrontage\b/i, /\bmt\b/i] },
  { label: "dong nguoi qua lai", patterns: [/\bdong\s+nguoi\s+qua\s+lai\b/i, /\bdong\s+khach\b/i, /\bluu\s+luong\b/i, /\bfoot\s*traffic\b/i] },
  { label: "cho de xe", patterns: [/\bcho\s+de\s+xe\b/i, /\bdau\s+xe\b/i, /\bparking\b/i, /\bgarage\b/i] },
  { label: "hop dong dai han", patterns: [/\bhop\s+dong\s+dai\s+han\b/i, /\bdai\s+han\b/i, /\blong\s+term\b/i] },
];

const targetCustomerPatterns: PatternItem[] = [
  { label: "khach Han", patterns: [/\bkhach\s+han\b/i, /\bhan\s+quoc\b/i, /\bkorean\b/i] },
  { label: "nguoi nuoc ngoai", patterns: [/\bnguoi\s+nuoc\s+ngoai\b/i, /\bkhach\s+tay\b/i, /\bexpat\b/i, /\bforeigner\b/i] },
  { label: "dan van phong", patterns: [/\bdan\s+van\s+phong\b/i, /\bnhan\s+vien\s+van\s+phong\b/i, /\boffice\s+worker/i] },
];

const propertyTypePatterns: PatternItem[] = [
  { label: "nguyen can", patterns: [/\bnguyen\s+can\b/i, /\bnha\s+nguyen\s+can\b/i] },
  { label: "mat bang", patterns: [/\bmat\s+bang\b/i, /\bmb\b/i] },
  { label: "can ho", patterns: [/\bcan\s+ho\b/i, /\bchung\s+cu\b/i, /\bapartment\b/i] },
  { label: "phong tro", patterns: [/\bphong\s+tro\b/i, /\bphong\s+cho\s+thue\b/i] },
];

const cleanupPatterns = [
  /\b(?:quan|q)\s*\.?\s*(?:[1-9]|1[0-2])\b/gi,
  /\b(?:quan\s+)?(?:phu\s+nhuan|binh\s+thanh|go\s+vap|tan\s+binh|tan\s+phu|thu\s+duc|binh\s+tan)\b/gi,
  /\b(?:thao\s+dien|an\s+phu|le\s+thanh\s+ton|thai\s+van\s+lung)\b/gi,
  /\b(?:tu\s+)?\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)?\s*(?:-|den|toi)\s*\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\b/gi,
  /\b(?:duoi|toi\s+da|max|khong\s+qua|tam\s+duoi)\s*\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\s*(?:do\s+lai|tro\s+lai)\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\b/gi,
  /\b(?:tu\s+)?\d+(?:[.,]\d+)?\s*(?:m2|m²)?\s*(?:-|den|toi)\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/gi,
  /\b(?:dt|dien tich|tam|khoang)\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)?/gi,
  /\b(?:ngang|mat\s+tien|be\s+ngang|rong)\s*\d+(?:[.,]\d+)?\s*m?\b/gi,
  /\b\d+(?:[.,]\d+)?\s*m?\s*[x×*]\s*\d*(?:[.,]\d+)?\s*m?\b/gi,
  /\b(?:tret(?:\s+\d+\s*lau|\s+lau)?|\d+\s*lau|san\s+thuong|\bst\b|lung)\b/gi,
  /\b\d+\s*-\s*\d+\s*pn\b/gi,
  /\b\d+\s*pn\b/gi,
  /\b(?:nguyen\s+can|nha\s+nguyen\s+can|mat\s+bang|can\s+ho|chung\s+cu|phong\s+tro|phong\s+cho\s+thue)\b/gi,
  /\b(?:khu\s+vuc\s+ke\s+can|ke\s+can|lan\s+can|gan|quanh)\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/gi,
];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeForParsing(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/m²/g, "m2")
    .replace(/m²/g, "m2")
    .toLowerCase();
}

function normalizeNumber(value: string) {
  const numberValue = Number(value.replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function districtLabel(value: string) {
  const normalized = normalizeDistrictQuery(value);

  if (normalized) {
    return getDistrictLabel(normalized) || value;
  }

  return getDistrictLabel(value) || value;
}

function collectPatternLabels(items: PatternItem[], text: string) {
  return items
    .filter((item) => item.patterns.some((pattern) => pattern.test(text)))
    .map((item) => item.label);
}

function parseDistricts(text: string) {
  const labels: string[] = [];

  for (const groupMatch of text.matchAll(/\b(?:quan|q)\s*\.?\s*((?:\d{1,2}\s*,\s*)+\d{1,2})\b/gi)) {
    const numbers = groupMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const number of numbers) {
      labels.push(`Quan ${number}`);
    }
  }

  for (const districtMatch of text.matchAll(/\b(?:quan|q)\s*\.?\s*(\d{1,2})\b/gi)) {
    labels.push(`Quan ${districtMatch[1]}`);
  }

  for (const item of districtPatterns) {
    if (item.patterns.some((pattern) => pattern.test(text))) {
      labels.push(item.label);
    }
  }

  return unique(labels);
}

function parsePrice(text: string) {
  const range =
    text.match(/\b(?:tu\s+)?(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|ty|ti)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i);

  if (range) {
    const min = normalizeNumber(range[1]);
    const max = normalizeNumber(range[2]);
    const multiplier = /ty|ti/.test(range[3]) ? 1000000000 : 1000000;
    const minPrice = min === null ? undefined : Math.round(min * multiplier);
    const maxPrice = max === null ? undefined : Math.round(max * multiplier);

    return {
      minPrice,
      maxPrice,
      targetPrice:
        minPrice !== undefined && maxPrice !== undefined
          ? Math.round((minPrice + maxPrice) / 2)
          : maxPrice,
      priceMode: "range" as const,
    };
  }

  const single = text.match(/\b(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i);

  if (!single) return {};

  const value = normalizeNumber(single[1]);
  const multiplier = /ty|ti/.test(single[2]) ? 1000000000 : 1000000;
  const price = value === null ? undefined : Math.round(value * multiplier);
  const numberPattern = single[1].replace(".", "\\.").replace(",", "[,.]");
  const explicitMax = new RegExp(
    `(?:duoi|toi\\s+da|max|khong\\s+qua|tam\\s+duoi)\\s*${numberPattern}\\s*(?:tr|trieu|ty|ti)|${numberPattern}\\s*(?:tr|trieu|ty|ti)\\s*(?:do\\s+lai|tro\\s+lai)`,
    "i"
  ).test(text);

  return {
    maxPrice: price,
    targetPrice: price,
    priceMode: explicitMax ? ("max" as const) : ("target" as const),
  };
}

function parseArea(text: string) {
  const range =
    text.match(/\b(?:tu\s+)?(\d+(?:[.,]\d+)?)\s*(?:m2)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*m2\b/i) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*m2\b/i);

  if (range) {
    const minArea = normalizeNumber(range[1]) ?? undefined;
    const maxArea = normalizeNumber(range[2]) ?? undefined;

    return {
      minArea,
      maxArea,
      targetArea:
        minArea !== undefined && maxArea !== undefined
          ? (minArea + maxArea) / 2
          : undefined,
    };
  }

  const minimum =
    text.match(/\b(?:tu|tren|toi\s+thieu|it\s+nhat)\s*(\d+(?:[.,]\d+)?)\s*m2\b/i) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*m2\s*(?:tro\s+len|do\s+len)\b/i);

  if (minimum) {
    return {
      minArea: normalizeNumber(minimum[1]) ?? undefined,
    };
  }

  const single =
    text.match(/\b(?:dt|dien tich|tam|khoang)\s*(\d+(?:[.,]\d+)?)\s*(?:m2)?\b/i) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*m2\b/i);

  if (!single) return {};

  return {
    targetArea: normalizeNumber(single[1]) ?? undefined,
  };
}

function parseDimensions(text: string) {
  const fullSize = text.match(/\b(\d+(?:[.,]\d+)?)\s*m?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*m?\b/i);

  if (fullSize) {
    return {
      targetWidth: normalizeNumber(fullSize[1]) ?? undefined,
      targetLength: normalizeNumber(fullSize[2]) ?? undefined,
    };
  }

  const partialSize = text.match(/\b(\d+(?:[.,]\d+)?)\s*m?\s*[x×*](?!\s*\d)/i);

  if (partialSize) {
    return {
      targetWidth: normalizeNumber(partialSize[1]) ?? undefined,
      targetLength: undefined,
    };
  }

  const widthKeyword = text.match(
    /\b(?:ngang|mat\s+tien|be\s+ngang|rong|mat\s+tien\s+ngang)\s*(\d+(?:[.,]\d+)?)\s*m?\b/i
  );

  const lengthKeyword = text.match(/\b(?:dai|chieu\s+dai)\s*(\d+(?:[.,]\d+)?)\s*m?\b/i);

  return {
    targetWidth: widthKeyword ? normalizeNumber(widthKeyword[1]) ?? undefined : undefined,
    targetLength: lengthKeyword ? normalizeNumber(lengthKeyword[1]) ?? undefined : undefined,
  };
}

function parseBedrooms(text: string) {
  const range = text.match(/\b(\d+)\s*-\s*(\d+)\s*pn\b/i);

  if (range) {
    const min = normalizeNumber(range[1]);
    const max = normalizeNumber(range[2]);

    return {
      bedrooms: min ?? undefined,
      minBedrooms: min ?? undefined,
      maxBedrooms: max ?? undefined,
    };
  }

  const single =
    text.match(/\b(\d+)\s*pn\b/i) ||
    text.match(/\b(\d+)\s*phong\s+ngu\b/i);

  if (!single) return {};

  const value = normalizeNumber(single[1]);

  return {
    bedrooms: value ?? undefined,
    minBedrooms: value ?? undefined,
    maxBedrooms: value ?? undefined,
  };
}

function parseStructure(text: string): {
  targetFloors?: number;
  minFloors?: number;
  hasRooftop: boolean;
  hasMezzanine: boolean;
} {
  const hasRooftop = /\b(?:san\s+thuong|st)\b/i.test(text);
  const hasMezzanine = /\blung\b/i.test(text);
  const groundPlusFloors = text.match(/\btret\s*(\d+)\s*lau\b/i);
  const plainFloors = text.match(/\b(\d+)\s*lau\b/i);

  if (groundPlusFloors) {
    return {
      targetFloors: normalizeNumber(groundPlusFloors[1]) ?? undefined,
      hasRooftop,
      hasMezzanine,
    };
  }

  if (/\btret\s+lau\b/i.test(text)) {
    return {
      targetFloors: 1,
      hasRooftop,
      hasMezzanine,
    };
  }

  if (plainFloors) {
    return {
      targetFloors: normalizeNumber(plainFloors[1]) ?? undefined,
      hasRooftop,
      hasMezzanine,
    };
  }

  if (/\btret\b/i.test(text)) {
    return {
      targetFloors: 0,
      hasRooftop,
      hasMezzanine,
    };
  }

  return {
    hasRooftop,
    hasMezzanine,
  };
}

function parseAllowNearbyDistricts(text: string) {
  return /\b(?:khu\s+vuc\s+ke\s+can|ke\s+can|lan\s+can|gan|quanh)\b/i.test(text);
}

function titleCaseStreet(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (/^[A-Z0-9]+$/.test(word) && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function stripStreetNoise(value: string) {
  let current = value
    .replace(/\b(?:quận|quan|q)\s*\.?\s*(?:[1-9]|1[0-2])\b/giu, " ")
    .replace(
      /\b(?:quận|quan)?\s*(?:phú nhuận|phu nhuan|bình thạnh|binh thanh|gò vấp|go vap|tân bình|tan binh|tân phú|tan phu|thủ đức|thu duc|bình tân|binh tan)\b/giu,
      " "
    )
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let previous = "";
  while (current && current !== previous) {
    previous = current;
    current = current
      .replace(
        /^\s*(?:anh|chị|chi|em|cần|can|tìm|tim|kiếm|kiem|nhà|nha|thuê|thue|mua|ở|o|tại|tai|trên|tren|khu\s*vực|khu\s*vuc)\b\s*/iu,
        ""
      )
      .replace(
        /^\s*(?:đường|duong|phố|pho|mặt\s*tiền|mat\s*tien|mt|hẻm\s*xe\s*hơi|hem\s*xe\s*hoi|hxh|hxt|hxm|hẻm|hem)\b\s*/iu,
        ""
      )
      .replace(/^[\s:.-]+|[\s:.-]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return current;
}

function isStreetCandidate(value: string) {
  const normalized = normalizeForParsing(value).replace(/\s+/g, " ").trim();

  if (!normalized || normalized.length < 3) return false;
  if (parseDistricts(normalized).length > 0) return false;
  if (/\b(?:gia|ngan sach|dien tich|dt|phong ngu|pn|lau|tret)\b/.test(normalized)) return false;
  if (/\b\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti|m2|m)\b/.test(normalized)) return false;
  if (/\b\d+(?:[.,]\d+)?\s*(?:x|×|\*)\s*\d+(?:[.,]\d+)?\b/.test(normalized)) return false;
  if (/\b(?:duoc|la|nhe|nha|voi|can|tim|thue|mua)\b/.test(normalized)) return false;
  if (/^(?:can|tim|kiem|nha|thue|mua|o|tai|tren|khu vuc|duong|pho|mt|hxh|hxt|hxm|hem)+$/.test(normalized.replace(/\s+/g, ""))) {
    return false;
  }

  const words = normalized.split(" ").filter(Boolean);
  return words.length >= 2 && words.length <= 6;
}

function parseStreets(rawText: string, normalizedText: string) {
  const explicitMatches = streetPatterns
    .filter((item) => item.patterns.some((pattern) => pattern.test(normalizedText)))
    .map((item) => item.label);
  const segmentMatches = rawText
    .split(/[,/|\n]+/g)
    .map(stripStreetNoise)
    .filter(isStreetCandidate)
    .map(titleCaseStreet);

  return unique([...explicitMatches, ...segmentMatches]);
}

function extractKeywordSearch(input: string) {
  const normalized = normalizeSearchText(input);
  const keyword = cleanupPatterns
    .reduce((current, pattern) => current.replace(pattern, " "), normalized)
    .replace(/\s+/g, " ")
    .trim();

  if (!keyword) return null;

  return keyword
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseVietnameseRequirement(input: string): ParsedRequirementFilters {
  const rawText = String(input || "");
  const normalized = normalizeForParsing(rawText);
  const districts = parseDistricts(normalized);
  const wards = wardPatterns.filter((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );
  const streets = parseStreets(rawText, normalized);
  const businessMatches = businessPatternItems.filter((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );
  const features = collectPatternLabels(featurePatterns, normalized);
  const targetCustomers = collectPatternLabels(targetCustomerPatterns, normalized);
  const propertyTypes = collectPatternLabels(propertyTypePatterns, normalized);
  const price = parsePrice(normalized);
  const area = parseArea(normalized);
  const dimensions = parseDimensions(normalized);
  const structure = parseStructure(normalized);
  const bedroomFilters = parseBedrooms(normalized);
  const allowNearbyDistricts = parseAllowNearbyDistricts(normalized);
  const businessTypes = unique(businessMatches.map((item) => item.type));
  const concepts = unique(businessMatches.map((item) => item.label));
  const inferredDistricts = [
    ...districts,
    ...wards.map((item) => item.district || ""),
  ];
  const preferredDistricts = unique(inferredDistricts).map(districtLabel);
  const preferredWards = unique(wards.map((item) => item.label));
  const preferredStreets = unique(streets);
  const purpose =
    businessTypes.length > 0 || features.length > 0 || /kinh\s+doanh|mat\s+bang|cho\s+thue/i.test(normalized)
      ? "kinh doanh"
      : /nha\s+o|o\s+gia\s+dinh|de\s+o/i.test(normalized)
        ? "nha o"
        : undefined;
  const noteParts = unique([
    ...concepts,
    ...features,
    ...targetCustomers,
    purpose ? `purpose: ${purpose}` : "",
  ]);

  return {
    rawText,
    businessTypes,
    concepts,
    preferredDistricts,
    allowNearbyDistricts,
    preferredWards,
    preferredStreets,
    minArea: area.minArea,
    maxArea: area.maxArea,
    targetArea: area.targetArea,
    targetWidth: dimensions.targetWidth,
    targetLength: dimensions.targetLength,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    targetPrice: price.targetPrice,
    priceMode: price.priceMode ?? null,
    targetFloors: structure.targetFloors,
    minFloors: structure.minFloors,
    hasRooftop: structure.hasRooftop,
    hasMezzanine: structure.hasMezzanine,
    bedrooms: bedroomFilters.bedrooms ?? null,
    minBedrooms: bedroomFilters.minBedrooms ?? null,
    maxBedrooms: bedroomFilters.maxBedrooms ?? null,
    propertyTypes,
    features,
    targetCustomers,
    purpose,
    preferred_districts: preferredDistricts,
    preferred_streets: preferredStreets,
    min_price: price.minPrice ?? null,
    max_price: price.maxPrice ?? null,
    target_price: price.targetPrice ?? null,
    min_area: area.minArea ?? null,
    max_area: area.maxArea ?? null,
    target_area: area.targetArea ?? null,
    target_width: dimensions.targetWidth ?? null,
    target_length: dimensions.targetLength ?? null,
    target_floors: structure.targetFloors ?? null,
    min_floors: structure.minFloors ?? null,
    has_rooftop: Boolean(structure.hasRooftop),
    has_mezzanine: Boolean(structure.hasMezzanine),
    min_bedrooms: bedroomFilters.minBedrooms ?? null,
    max_bedrooms: bedroomFilters.maxBedrooms ?? null,
    property_types: propertyTypes,
    keywordSearch: extractKeywordSearch(rawText),
    note: unique([...noteParts, ...propertyTypes]).join(", "),
  };
}
