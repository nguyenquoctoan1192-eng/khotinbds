import {
  getDistrictLabel,
  normalizeDistrictQuery,
  normalizeSearchText,
} from "@/lib/searchNormalization";

export type ParsedRequirementFilters = {
  preferred_districts: string[];
  max_price: number | null;
  min_area: number | null;
  keywordSearch: string | null;
  note: string;
};

const businessNeeds = [
  { keyword: "spa", note: "làm spa" },
  { keyword: "cafe", note: "cafe" },
  { keyword: "ca phe", note: "cafe" },
  { keyword: "quan an", note: "quán ăn" },
  { keyword: "van phong", note: "văn phòng" },
];

const structuredCleanupPatterns = [
  /\b(?:quan|q)\s*\.?\s*(?:[1-9]|1[0-2])\b/gi,
  /\b(?:quan\s+)?phu\s+nhuan\b/gi,
  /\b(?:quan\s+)?binh\s+thanh\b/gi,
  /\b(?:quan\s+)?go\s+vap\b/gi,
  /\b(?:quan\s+)?tan\s+binh\b/gi,
  /\b(?:quan\s+)?tan\s+phu\b/gi,
  /\b(?:quan\s+)?thu\s+duc\b/gi,
  /\b(?:quan\s+)?binh\s+tan\b/gi,
  /\d+(?:[.,]\d+)?\s*(?:tr|trieu|triệu)\b/gi,
  /(?:dt|dien tich|diện tích)\s*\d+(?:[.,]\d+)?/gi,
  /\d+(?:[.,]\d+)?\s*(?:m2|m²|mÂ²)\b/gi,
  /\b(?:spa|cafe|ca\s+phe|quan\s+an|van\s+phong)\b/gi,
];

function formatKeyword(value: string) {
  const compacted = value.replace(/\s+/g, " ").trim().toLowerCase();

  if (!compacted) return null;

  return compacted
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractKeywordSearch(input: string) {
  const normalized = normalizeSearchText(input);
  const keyword = structuredCleanupPatterns
    .reduce((current, pattern) => current.replace(pattern, " "), normalized)
    .replace(/\s+/g, " ")
    .trim();

  return formatKeyword(keyword);
}

function normalizeDistrictLabel(value: string) {
  const normalized = normalizeDistrictQuery(value) || normalizeSearchText(value);
  const numberMatch = normalized.match(/\b(?:quan|q)\s*\.?\s*(1[0-2]|[1-9])\b/);

  if (numberMatch) {
    return `Quận ${Number(numberMatch[1])}`;
  }

  const compactNumberMatch = normalized.match(/\bq(1[0-2]|[1-9])\b/);

  if (compactNumberMatch) {
    return `Quận ${Number(compactNumberMatch[1])}`;
  }

  const knownDistricts: Array<[RegExp, string]> = [
    [/\bphu\s+nhuan\b/, "Phú Nhuận"],
    [/\bbinh\s+thanh\b/, "Bình Thạnh"],
    [/\bgo\s+vap\b/, "Gò Vấp"],
    [/\btan\s+binh\b/, "Tân Bình"],
    [/\btan\s+phu\b/, "Tân Phú"],
    [/\bthu\s+duc\b/, "Thủ Đức"],
    [/\bbinh\s+tan\b/, "Bình Tân"],
  ];

  for (const [pattern, label] of knownDistricts) {
    if (pattern.test(normalized)) return label;
  }

  return getDistrictLabel(value);
}

export function parseVietnameseRequirement(input: string): ParsedRequirementFilters {
  const normalized = normalizeSearchText(input);
  const district = normalizeDistrictLabel(input);

  const priceMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(tr|trieu|triệu)\b/
  );
  const maxPrice = priceMatch
    ? Math.round(Number(priceMatch[1].replace(",", ".")) * 1000000)
    : null;

  const areaMatch =
    normalized.match(/(?:dt|dien tich|diện tích)\s*(\d+(?:[.,]\d+)?)/) ||
    normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|mÂ²)\b/);
  const minArea = areaMatch ? Number(areaMatch[1].replace(",", ".")) : null;

  const needs = businessNeeds
    .filter((item) => normalized.includes(item.keyword))
    .map((item) => item.note);

  return {
    preferred_districts: district ? [district] : [],
    max_price: maxPrice,
    min_area: minArea,
    keywordSearch: extractKeywordSearch(input),
    note: needs.join(", "),
  };
}