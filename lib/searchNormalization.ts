export const noSearchResultsMessage =
  "Không tìm thấy bất động sản phù hợp với từ khóa này.";

export function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\bq\s*\.\s*(\d{1,2})\b/gi, "q$1")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const numberedDistrictNames = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;

  return {
    normalized: `quan ${number}`,
    label: `Quận ${number}`,
  };
});

const namedDistrictNames = [
  { normalized: "binh thanh", label: "Bình Thạnh" },
  { normalized: "phu nhuan", label: "Phú Nhuận" },
  { normalized: "tan binh", label: "Tân Bình" },
  { normalized: "tan phu", label: "Tân Phú" },
  { normalized: "go vap", label: "Gò Vấp" },
  { normalized: "thu duc", label: "Thủ Đức" },
  { normalized: "binh tan", label: "Bình Tân" },
];

export const normalizedDistrictNames = [
  ...numberedDistrictNames,
  ...namedDistrictNames,
];

export function normalizeDistrictQuery(value: unknown) {
  const normalized = normalizeSearchText(value);
  const compact = normalized.replace(/\s+/g, "");
  const numberedMatch =
    normalized.match(/^(?:quan|q)\s*([1-9]|1[0-2])$/) ||
    compact.match(/^(?:quan|q)([1-9]|1[0-2])$/);

  if (numberedMatch) {
    return `quan ${Number(numberedMatch[1])}`;
  }

  const withoutDistrictPrefix = normalized.replace(/^quan\s+/, "").trim();
  const namedMatch = namedDistrictNames.find(
    (district) => district.normalized === withoutDistrictPrefix
  );

  return namedMatch?.normalized || null;
}

export function getDistrictLabel(value: unknown) {
  const normalized = normalizeDistrictQuery(value);

  if (!normalized) return null;

  return (
    normalizedDistrictNames.find((district) => district.normalized === normalized)
      ?.label || null
  );
}
