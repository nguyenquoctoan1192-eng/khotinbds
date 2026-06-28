import {
  getDistrictLabel,
  normalizeDistrictQuery,
  normalizeSearchText,
} from "@/lib/searchNormalization";

export type ParsedRequirement = {
  rawText: string;
  businessTypes: string[];
  concepts: string[];
  preferredDistricts: string[];
  preferredWards: string[];
  preferredStreets: string[];
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  features: string[];
  targetCustomers: string[];
  purpose?: string;
};

export type ParsedRequirementFilters = ParsedRequirement & {
  preferred_districts: string[];
  max_price: number | null;
  min_price: number | null;
  min_area: number | null;
  max_area: number | null;
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
  {
    label: "Binh Thanh",
    patterns: [/\b(?:quan\s+)?binh\s+thanh\b/i],
  },
  {
    label: "Phu Nhuan",
    patterns: [/\b(?:quan\s+)?phu\s+nhuan\b/i],
  },
  {
    label: "Tan Binh",
    patterns: [/\b(?:quan\s+)?tan\s+binh\b/i],
  },
  {
    label: "Tan Phu",
    patterns: [/\b(?:quan\s+)?tan\s+phu\b/i],
  },
  {
    label: "Go Vap",
    patterns: [/\b(?:quan\s+)?go\s+vap\b/i],
  },
  {
    label: "Thu Duc",
    patterns: [/\b(?:quan\s+)?thu\s+duc\b/i],
  },
  {
    label: "Binh Tan",
    patterns: [/\b(?:quan\s+)?binh\s+tan\b/i],
  },
];

const wardPatterns: PatternItem[] = [
  {
    label: "Thao Dien",
    district: "Quan 2",
    patterns: [/\bthao\s+dien\b/i],
  },
  {
    label: "An Phu",
    district: "Quan 2",
    patterns: [/\ban\s+phu\b/i],
  },
];

const streetPatterns: PatternItem[] = [
  {
    label: "Le Thanh Ton",
    district: "Quan 1",
    patterns: [/\ble\s+thanh\s+ton\b/i],
  },
  {
    label: "Thai Van Lung",
    district: "Quan 1",
    patterns: [/\bthai\s+van\s+lung\b/i],
  },
];

const businessPatternItems: Array<PatternItem & { type: string }> = [
  {
    label: "Korean BBQ",
    type: "bbq",
    patterns: [/\bkorean\s+bbq\b/i, /\bhan\s+quoc\s+bbq\b/i],
  },
  {
    label: "BBQ",
    type: "bbq",
    patterns: [/\bbbq\b/i, /\bnha\s+hang\s+nuong\b/i, /\bquan\s+nuong\b/i],
  },
  {
    label: "Seafood",
    type: "seafood",
    patterns: [/\bseafood\b/i, /\bhai\s+san\b/i],
  },
  {
    label: "Wine Bar",
    type: "wine bar",
    patterns: [/\bwine\s+bar\b/i, /\bbar\s+ruou\b/i],
  },
  {
    label: "Restaurant",
    type: "restaurant",
    patterns: [/\brestaurant\b/i, /\bnha\s+hang\b/i, /\bquan\s+an\b/i, /\bf\s*&\s*b\b/i, /\bfnb\b/i],
  },
  {
    label: "Spa",
    type: "spa",
    patterns: [/\bspa\b/i, /\btham\s+my\b/i, /\bsalon\b/i, /\bnail\b/i, /\bmassage\b/i],
  },
  {
    label: "Cafe",
    type: "cafe",
    patterns: [/\bcafe\b/i, /\bca\s+phe\b/i, /\bcoffee\b/i],
  },
  {
    label: "Office",
    type: "office",
    patterns: [/\bvan\s+phong\b/i, /\boffice\b/i, /\bvp\b/i],
  },
];

const featurePatterns: PatternItem[] = [
  {
    label: "mat tien",
    patterns: [/\bmat\s+tien\b/i, /\bfrontage\b/i, /\bmt\b/i],
  },
  {
    label: "dong nguoi qua lai",
    patterns: [/\bdong\s+nguoi\s+qua\s+lai\b/i, /\bdong\s+khach\b/i, /\bluu\s+luong\b/i, /\bfoot\s*traffic\b/i],
  },
  {
    label: "cho de xe",
    patterns: [/\bcho\s+de\s+xe\b/i, /\bdau\s+xe\b/i, /\bparking\b/i, /\bgarage\b/i],
  },
  {
    label: "hop dong dai han",
    patterns: [/\bhop\s+dong\s+dai\s+han\b/i, /\bdai\s+han\b/i, /\blong\s+term\b/i],
  },
];

const targetCustomerPatterns: PatternItem[] = [
  {
    label: "khach Han",
    patterns: [/\bkhach\s+han\b/i, /\bhan\s+quoc\b/i, /\bkorean\b/i],
  },
  {
    label: "nguoi nuoc ngoai",
    patterns: [/\bnguoi\s+nuoc\s+ngoai\b/i, /\bkhach\s+tay\b/i, /\bexpat\b/i, /\bforeigner\b/i],
  },
  {
    label: "dan van phong",
    patterns: [/\bdan\s+van\s+phong\b/i, /\bnhan\s+vien\s+van\s+phong\b/i, /\boffice\s+worker/i],
  },
];

const cleanupPatterns = [
  /\b(?:quan|q)\s*\.?\s*(?:[1-9]|1[0-2])\b/gi,
  /\b(?:quan\s+)?(?:phu\s+nhuan|binh\s+thanh|go\s+vap|tan\s+binh|tan\s+phu|thu\s+duc|binh\s+tan)\b/gi,
  /\b(?:thao\s+dien|an\s+phu|le\s+thanh\s+ton|thai\s+van\s+lung)\b/gi,
  /\b(?:tu\s+)?\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)?\s*(?:-|den|toi)\s*\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:tr|trieu|ty|ti)\b/gi,
  /\b(?:tu\s+)?\d+(?:[.,]\d+)?\s*(?:m2|m²)?\s*(?:-|den|toi)\s*\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/gi,
  /\b(?:dt|dien tich)\s*\d+(?:[.,]\d+)?/gi,
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

function parsePrice(text: string) {
  const range =
    text.match(
      /\b(?:tu\s+)?(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|ty|ti)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i
    ) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i);

  if (range) {
    const min = normalizeNumber(range[1]);
    const max = normalizeNumber(range[2]);
    const unit = range[3];
    const multiplier = /ty|ti/.test(unit) ? 1000000000 : 1000000;

    return {
      minPrice: min === null ? undefined : Math.round(min * multiplier),
      maxPrice: max === null ? undefined : Math.round(max * multiplier),
    };
  }

  const single = text.match(/\b(\d+(?:[.,]\d+)?)\s*(tr|trieu|ty|ti)\b/i);

  if (!single) return {};

  const value = normalizeNumber(single[1]);
  const multiplier = /ty|ti/.test(single[2]) ? 1000000000 : 1000000;

  return {
    maxPrice: value === null ? undefined : Math.round(value * multiplier),
  };
}

function parseArea(text: string) {
  const range =
    text.match(
      /\b(?:tu\s+)?(\d+(?:[.,]\d+)?)\s*(?:m2)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*m2\b/i
    ) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*m2\b/i);

  if (range) {
    return {
      minArea: normalizeNumber(range[1]) ?? undefined,
      maxArea: normalizeNumber(range[2]) ?? undefined,
    };
  }

  const single =
    text.match(/\b(?:dt|dien tich)\s*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/\b(\d+(?:[.,]\d+)?)\s*m2\b/i);

  if (!single) return {};

  return {
    minArea: normalizeNumber(single[1]) ?? undefined,
  };
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
  const districts = collectPatternLabels(districtPatterns, normalized);
  const wards = wardPatterns.filter((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );
  const streets = streetPatterns.filter((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );
  const businessMatches = businessPatternItems.filter((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );
  const features = collectPatternLabels(featurePatterns, normalized);
  const targetCustomers = collectPatternLabels(targetCustomerPatterns, normalized);
  const price = parsePrice(normalized);
  const area = parseArea(normalized);
  const businessTypes = unique(businessMatches.map((item) => item.type));
  const concepts = unique(businessMatches.map((item) => item.label));
  const inferredDistricts = [
    ...districts,
    ...wards.map((item) => item.district || ""),
    ...streets.map((item) => item.district || ""),
  ];
  const preferredDistricts = unique(inferredDistricts).map(districtLabel);
  const preferredWards = unique(wards.map((item) => item.label));
  const preferredStreets = unique(streets.map((item) => item.label));
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
    preferredWards,
    preferredStreets,
    minArea: area.minArea,
    maxArea: area.maxArea,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    features,
    targetCustomers,
    purpose,
    preferred_districts: preferredDistricts,
    min_price: price.minPrice ?? null,
    max_price: price.maxPrice ?? null,
    min_area: area.minArea ?? null,
    max_area: area.maxArea ?? null,
    keywordSearch: extractKeywordSearch(rawText),
    note: noteParts.join(", "),
  };
}
