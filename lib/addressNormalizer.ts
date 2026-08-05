export type RoadType =
  | "Mặt Tiền"
  | "Hẻm"
  | "Hẻm Xe Hơi"
  | "Hẻm Xe Tải"
  | "Hẻm Xe Máy"
  | "Hẻm Ba Gác"
  | "Hai Mặt Tiền"
  | "Góc Mặt Tiền"
  | "Góc Hai Mặt Tiền"
  | "Mặt Bằng"
  | "Hai Mặt Bằng";

export type NormalizedAddress = {
  roadType: RoadType;
  street: string;
  ward: string;
  district: string;
  displayAddress: string;
};

function stripMarks(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function cleanSpace(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function removeLeadingRoadKeyword(value: string): string {
  return value
    .replace(
      /^(?:góc\s*2mt|2mt\s*góc|góc\s*mt|2mt|hxh|hxt|hxm|h3g|2mb|mb|mặt\s*tiền|hẻm\s*xe\s*hơi|hẻm\s*xe\s*tải|hẻm\s*xe\s*máy|hẻm\s*ba\s*gác|hẻm)\s*[-–:]?\s*/iu,
      "",
    )
    .trim();
}

export function removeHouseNumber(value: string): string {
  let result = cleanSpace(value);
  result = result.replace(/^(?:địa\s*chỉ|đc)\s*:\s*/iu, "");
  result = removeLeadingRoadKeyword(result);

  // 69-69A, 382EF, 536/32, 29/13A, 18A/111...
  result = result.replace(
    /^(?:số\s*)?(?:\d+[a-z]{0,4})(?:\s*[-/]\s*\d*[a-z]{0,4})*\s+/iu,
    "",
  );

  // Lô A12, lô 5...
  result = result.replace(/^lô\s+[a-z]?\d+[a-z-]*\s+/iu, "");
  return cleanSpace(result);
}

function detectRoadType(address: string, description: string): RoadType {
  const source = stripMarks(`${address}\n${description}`).toLowerCase();
  const rules: Array<[RoadType, RegExp]> = [
    ["Góc Hai Mặt Tiền", /\b(?:goc\s*2mt|2mt\s*goc|goc\s*hai\s*mat\s*tien)\b/i],
    ["Góc Mặt Tiền", /\b(?:goc\s*mt|goc\s*mat\s*tien)\b/i],
    ["Hai Mặt Tiền", /\b(?:2mt|hai\s*mat\s*tien)\b/i],
    ["Hẻm Xe Tải", /\b(?:hxt|hem\s*xe\s*tai)\b/i],
    ["Hẻm Xe Hơi", /\b(?:hxh|hem\s*xe\s*hoi)\b/i],
    ["Hẻm Xe Máy", /\b(?:hxm|hem\s*xe\s*may)\b/i],
    ["Hẻm Ba Gác", /\b(?:h3g|hem\s*3\s*gac|hem\s*ba\s*gac|ba\s*gac)\b/i],
    ["Hai Mặt Bằng", /\b(?:2mb|hai\s*mat\s*bang)\b/i],
    ["Mặt Bằng", /\b(?:mb|mat\s*bang)\b/i],
  ];

  for (const [type, pattern] of rules) {
    if (pattern.test(source)) return type;
  }

  return /\d+[a-z]{0,4}\s*\/\s*\d*/iu.test(address) ? "Hẻm" : "Mặt Tiền";
}

function splitAddress(address: string): {
  street: string;
  ward: string;
  district: string;
} {
  const parts = cleanSpace(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let street = parts[0] || "";
  let ward = "";
  let district = "";

  for (const part of parts.slice(1)) {
    const normalized = stripMarks(part).toLowerCase();
    if (/^(?:p\.?|phuong)\s*\w+/i.test(normalized)) ward = part;
    if (/^(?:q\.?|quan|tp\.?|thanh pho)\s*/i.test(normalized)) district = part;
  }

  street = removeHouseNumber(street);
  return { street, ward, district };
}

export function normalizeAddress(
  address: string | null | undefined,
  description = "",
): NormalizedAddress {
  const rawAddress = cleanSpace(String(address || ""));
  const { street, ward, district } = splitAddress(rawAddress);
  const roadType = detectRoadType(rawAddress, description);
  const displayAddress = [street ? `${roadType} ${street}` : roadType, ward, district]
    .filter(Boolean)
    .join(", ");

  return { roadType, street, ward, district, displayAddress };
}

export function replacePrivateAddressInContent(
  content: string,
  address: string | null | undefined,
  description = "",
): string {
  const normalized = normalizeAddress(address, description);
  let output = String(content || "");
  const rawAddress = cleanSpace(String(address || ""));

  if (rawAddress) {
    output = output.split(rawAddress).join(normalized.displayAddress);
  }

  output = output
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (/^(?:📍\s*)?(?:địa\s*chỉ|đc)\s*:/iu.test(trimmed)) {
        return `📍 ${normalized.displayAddress}`;
      }
      if (/^(?:📍\s*)?\d+[a-z]{0,4}(?:\s*[-/]\s*\d*[a-z]{0,4})*\s+[\p{L}]/iu.test(trimmed)) {
        return `📍 ${normalized.displayAddress}`;
      }
      return line;
    })
    .join("\n");

  return output.trim();
}
