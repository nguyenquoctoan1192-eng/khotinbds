import {
  getDistrictLabel,
  normalizeDistrictQuery,
  normalizeSearchText,
} from "@/lib/searchNormalization";

export const nearbyDistricts: Record<string, string[]> = {
  "quan 1": ["quan 3", "quan 4", "quan 5", "quan 10", "binh thanh", "phu nhuan"],
  "quan 2": ["quan 1", "quan 7", "quan 9", "binh thanh", "thu duc"],
  "quan 3": ["quan 1", "quan 5", "quan 10", "phu nhuan", "tan binh"],
  "quan 4": ["quan 1", "quan 5", "quan 7", "quan 8"],
  "quan 5": ["quan 1", "quan 3", "quan 4", "quan 6", "quan 8", "quan 10", "quan 11"],
  "quan 6": ["quan 5", "quan 8", "quan 11", "binh tan", "tan phu"],
  "quan 7": ["quan 2", "quan 4", "quan 8"],
  "quan 8": ["quan 4", "quan 5", "quan 6", "quan 7", "binh tan"],
  "quan 9": ["quan 2", "thu duc"],
  "quan 10": ["quan 1", "quan 3", "quan 5", "quan 11", "tan binh"],
  "quan 11": ["quan 5", "quan 6", "quan 10", "tan binh", "tan phu"],
  "quan 12": ["go vap", "tan binh", "tan phu", "thu duc"],
  "binh thanh": ["quan 1", "quan 2", "phu nhuan", "go vap", "thu duc"],
  "phu nhuan": ["quan 1", "quan 3", "binh thanh", "go vap", "tan binh"],
  "tan binh": ["quan 3", "quan 10", "quan 11", "quan 12", "phu nhuan", "go vap", "tan phu"],
  "tan phu": ["quan 6", "quan 11", "quan 12", "binh tan", "tan binh"],
  "go vap": ["quan 12", "binh thanh", "phu nhuan", "tan binh"],
  "thu duc": ["quan 2", "quan 9", "quan 12", "binh thanh"],
  "binh tan": ["quan 6", "quan 8", "tan phu"],
};

export function normalizeDistrictKey(value: unknown) {
  return normalizeDistrictQuery(value) || normalizeSearchText(value);
}

export function getNearbyDistrictKeys(value: unknown) {
  const district = normalizeDistrictKey(value);

  return district ? nearbyDistricts[district] || [] : [];
}

export function getNearbyDistrictLabels(value: unknown) {
  return getNearbyDistrictKeys(value).map(
    (district) => getDistrictLabel(district) || district
  );
}

export function districtIsNearby(preferredDistrict: unknown, listingDistrict: unknown) {
  const preferred = normalizeDistrictKey(preferredDistrict);
  const listing = normalizeDistrictKey(listingDistrict);

  return Boolean(preferred && listing && nearbyDistricts[preferred]?.includes(listing));
}
