export type DistrictCenter = {
  label: string;
  latitude: number;
  longitude: number;
};

export const hcmDistrictCenters: DistrictCenter[] = [
  { label: "Quận 1", latitude: 10.7757, longitude: 106.7004 },
  { label: "Quận 2", latitude: 10.7873, longitude: 106.7498 },
  { label: "Quận 3", latitude: 10.7844, longitude: 106.6844 },
  { label: "Quận 4", latitude: 10.7592, longitude: 106.7049 },
  { label: "Quận 5", latitude: 10.754, longitude: 106.6639 },
  { label: "Quận 6", latitude: 10.7469, longitude: 106.6345 },
  { label: "Quận 7", latitude: 10.734, longitude: 106.7216 },
  { label: "Quận 8", latitude: 10.7241, longitude: 106.6286 },
  { label: "Quận 9", latitude: 10.8428, longitude: 106.8287 },
  { label: "Quận 10", latitude: 10.7732, longitude: 106.6679 },
  { label: "Quận 11", latitude: 10.7629, longitude: 106.6501 },
  { label: "Quận 12", latitude: 10.8672, longitude: 106.6413 },
  { label: "Bình Thạnh", latitude: 10.8106, longitude: 106.7091 },
  { label: "Bình Tân", latitude: 10.7653, longitude: 106.6038 },
  { label: "Gò Vấp", latitude: 10.8387, longitude: 106.6653 },
  { label: "Phú Nhuận", latitude: 10.7992, longitude: 106.6803 },
  { label: "Tân Bình", latitude: 10.8017, longitude: 106.6538 },
  { label: "Tân Phú", latitude: 10.7904, longitude: 106.6284 },
  { label: "Thủ Đức", latitude: 10.8494, longitude: 106.7537 },
  { label: "Bình Chánh", latitude: 10.6874, longitude: 106.5939 },
  { label: "Cần Giờ", latitude: 10.4114, longitude: 106.9547 },
  { label: "Củ Chi", latitude: 10.9739, longitude: 106.4934 },
  { label: "Hóc Môn", latitude: 10.8833, longitude: 106.5865 },
  { label: "Nhà Bè", latitude: 10.6956, longitude: 106.7404 },
];

export const defaultHcmCenter: DistrictCenter = {
  label: "TP.HCM",
  latitude: 10.7769,
  longitude: 106.7009,
};

export const normalizeDistrictKey = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\bquan\b/g, "q")
    .replace(/\bthanh pho\b/g, "")
    .replace(/\btp\b/g, "")
    .replace(/\bhcm\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function getDistrictCenter(value: unknown) {
  const key = normalizeDistrictKey(value);
  if (!key) return null;

  return (
    hcmDistrictCenters.find((district) => normalizeDistrictKey(district.label) === key) ||
    hcmDistrictCenters.find((district) => key.includes(normalizeDistrictKey(district.label))) ||
    null
  );
}
