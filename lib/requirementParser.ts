export type ParsedRequirementFilters = {
  preferred_districts: string[];
  max_price: number | null;
  min_area: number | null;
  note: string;
};

const districtPatterns = [
  { label: "Phú Nhuận", patterns: ["phu nhuan"] },
  { label: "Bình Thạnh", patterns: ["binh thanh"] },
  { label: "Gò Vấp", patterns: ["go vap"] },
  { label: "Quận 1", patterns: ["quan 1", "q1", "q 1"] },
  { label: "Quận 3", patterns: ["quan 3", "q3", "q 3"] },
  { label: "Tân Bình", patterns: ["tan binh"] },
  { label: "Tân Phú", patterns: ["tan phu"] },
];

const businessNeeds = [
  { keyword: "spa", note: "làm spa" },
  { keyword: "cafe", note: "cafe" },
  { keyword: "ca phe", note: "cafe" },
  { keyword: "quan an", note: "quán ăn" },
  { keyword: "van phong", note: "văn phòng" },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

export function parseVietnameseRequirement(input: string): ParsedRequirementFilters {
  const normalized = normalizeText(input);

  const district = districtPatterns.find((item) =>
    item.patterns.some((pattern) => normalized.includes(pattern))
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
