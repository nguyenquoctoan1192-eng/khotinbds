import { getDistrictLabel, normalizeSearchText } from "@/lib/searchNormalization";

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
  /\d+(?:[.,]\d+)?\s*(?:tr|trieu)\b/gi,
  /(?:dt|dien tich)\s*\d+(?:[.,]\d+)?/gi,
  /\d+(?:[.,]\d+)?\s*(?:m2|m²)\b/gi,
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

export function parseVietnameseRequirement(input: string): ParsedRequirementFilters {
  const normalized = normalizeSearchText(input);
  const district = getDistrictLabel(input);

  const priceMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(tr|trieu)\b/);
  const maxPrice = priceMatch
    ? Math.round(Number(priceMatch[1].replace(",", ".")) * 1000000)
    : null;

  const areaMatch =
    normalized.match(/(?:dt|dien tich)\s*(\d+(?:[.,]\d+)?)/) ||
    normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²)\b/);
  const minArea = areaMatch
    ? Number(areaMatch[1].replace(",", "."))
    : null;

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
