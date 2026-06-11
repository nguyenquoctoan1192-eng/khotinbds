export type ParsedRequirementFilters = {
  preferred_districts: string[];
  max_price: number | null;
  min_area: number | null;
  note: string;
};

type DistrictPattern = {
  label: string;
  patterns: RegExp[];
};

const districtPatterns: DistrictPattern[] = [
  {
    label: "Ph\u00fa Nhu\u1eadn",
    patterns: [/\b(?:quan\s+)?phu\s+nhuan\b/],
  },
  {
    label: "B\u00ecnh Th\u1ea1nh",
    patterns: [/\b(?:quan\s+)?binh\s+thanh\b/],
  },
  {
    label: "G\u00f2 V\u1ea5p",
    patterns: [/\b(?:quan\s+)?go\s+vap\b/],
  },
  {
    label: "Qu\u1eadn 10",
    patterns: [/\b(?:quan|q)\s*10\b/],
  },
  {
    label: "Qu\u1eadn 1",
    patterns: [/\b(?:quan|q)\s*1\b/],
  },
  {
    label: "Qu\u1eadn 3",
    patterns: [/\b(?:quan|q)\s*3\b/],
  },
  {
    label: "T\u00e2n B\u00ecnh",
    patterns: [/\b(?:quan\s+)?tan\s+binh\b/],
  },
  {
    label: "T\u00e2n Ph\u00fa",
    patterns: [/\b(?:quan\s+)?tan\s+phu\b/],
  },
];

const businessNeeds = [
  { keyword: "spa", note: "l\u00e0m spa" },
  { keyword: "cafe", note: "cafe" },
  { keyword: "ca phe", note: "cafe" },
  { keyword: "quan an", note: "qu\u00e1n \u0103n" },
  { keyword: "van phong", note: "v\u0103n ph\u00f2ng" },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVietnameseRequirement(input: string): ParsedRequirementFilters {
  const normalized = normalizeText(input);

  const district = districtPatterns.find((item) =>
    item.patterns.some((pattern) => pattern.test(normalized))
  );

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
    preferred_districts: district ? [district.label] : [],
    max_price: maxPrice,
    min_area: minArea,
    note: needs.join(", "),
  };
}
