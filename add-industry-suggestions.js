const fs = require("fs");

const filePath = "lib/socialContent.ts";
let content = fs.readFileSync(filePath, "utf8");

// ============================================================
// BƯỚC 1: Chèn 2 hàm helper (tính diện tích số, tính số tầng lầu)
// và 1 hàm gợi ý ngành nghề theo đặc điểm vật lý,
// ngay trước hàm buildSuitableFor
// ============================================================
const anchor1 = "function buildSuitableFor(";
const anchor1Index = content.indexOf(anchor1);

if (anchor1Index === -1) {
  console.log("✗ Không tìm thấy 'function buildSuitableFor(' — dừng lại, không sửa gì.");
  process.exit(1);
}

const newHelpers = `function getAreaNumber(
  listing: SocialListingInput,
  parsed: ParsedListing,
  raw: string,
): number | null {
  const size = raw.match(
    /(\\d+(?:[.,]\\d+)?)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)/i,
  );

  if (size) {
    const w = Number(size[1].replace(",", "."));
    const l = Number(size[2].replace(",", "."));

    if (Number.isFinite(w) && Number.isFinite(l)) {
      return Math.round(w * l);
    }
  }

  if (parsed.width && parsed.length) {
    const w = Number(parsed.width);
    const l = Number(parsed.length);

    if (Number.isFinite(w) && Number.isFinite(l)) {
      return Math.round(w * l);
    }
  }

  if (listing.width && listing.length) {
    const w = Number(listing.width);
    const l = Number(listing.length);

    if (Number.isFinite(w) && Number.isFinite(l)) {
      return Math.round(w * l);
    }
  }

  const areaVal = Number(listing.area ?? parsed.area);

  if (Number.isFinite(areaVal) && areaVal > 0) {
    return Math.round(areaVal);
  }

  return null;
}

function getFloorCount(raw: string): number | null {
  const normalized = normalizeText(raw);

  const floor = normalized.match(/(\\d+)\\s*l[aầ]u\\b/);
  const floorShort = normalized.match(/(\\d+)\\s*l\\b(?!\\w)/);

  const value = floor?.[1] ?? floorShort?.[1];

  return value ? Number(value) : null;
}

/**
 * Gợi ý ngành nghề PHÙ HỢP dựa trên đặc điểm vật lý căn nhà
 * (mặt tiền/hẻm, diện tích, số tầng) — bổ sung thêm cho phần
 * "phù hợp" đã có, KHÔNG thay thế các gợi ý từ từ khóa thật
 * trong nội dung gốc.
 */
function suggestIndustriesByAttributes(
  prefix: string,
  areaM2: number | null,
  floorCount: number | null,
): string[] {
  const result: string[] = [];
  const isMatTien = /mặt tiền|mặt bằng|góc/i.test(prefix);

  if (isMatTien) {
    if ((areaM2 && areaM2 >= 100) || (floorCount && floorCount >= 3)) {
      result.push("🏬 Showroom / trưng bày sản phẩm");
      result.push("🏢 Văn phòng công ty");
      result.push("🍜 Nhà hàng / quán ăn quy mô lớn");
    } else if (areaM2 && areaM2 >= 50) {
      result.push("🛍️ Cửa hàng / bán lẻ");
      result.push("💆 Spa / nail / salon / thẩm mỹ");
      result.push("🏢 Văn phòng nhỏ");
    } else {
      result.push("🛍️ Cửa hàng kinh doanh nhỏ");
      result.push("☕ Quán café / trà sữa nhỏ");
    }
  } else {
    if (/xe hơi|xe tải/i.test(prefix)) {
      result.push("🏢 Văn phòng nhỏ / xưởng nhẹ");
      result.push("📦 Kho chứa hàng");
    }

    result.push("🏠 Gia đình / ở lâu dài");
  }

  if (floorCount && floorCount >= 3) {
    result.push("🛏️ Tiềm năng cho thuê từng tầng / căn hộ dịch vụ");
  }

  return result;
}

`;

content =
  content.slice(0, anchor1Index) +
  newHelpers +
  content.slice(anchor1Index);

console.log("✓ Bước 1: Đã chèn helper functions");

// ============================================================
// BƯỚC 2: Đổi chữ ký hàm buildSuitableFor để nhận thêm tham số
// ============================================================
const oldSignature = `function buildSuitableFor(
  raw: string,
): string[] {`;

const newSignature = `function buildSuitableFor(
  raw: string,
  attrs: { prefix: string; areaM2: number | null; floorCount: number | null },
): string[] {`;

if (content.includes(oldSignature)) {
  content = content.replace(oldSignature, newSignature);
  console.log("✓ Bước 2: Đã đổi chữ ký hàm buildSuitableFor");
} else {
  console.log("✗ Bước 2: Không khớp chữ ký hàm — cần kiểm tra tay");
}

// ============================================================
// BƯỚC 3: Gộp thêm gợi ý theo đặc điểm vật lý vào return cuối hàm
// ============================================================
const oldReturn = "  return [...new Set(result)];\n}";
const newReturn = `  const attributeSuggestions = suggestIndustriesByAttributes(
    attrs.prefix,
    attrs.areaM2,
    attrs.floorCount,
  );

  return [...new Set([...result, ...attributeSuggestions])];
}`;

if (content.includes(oldReturn)) {
  content = content.replace(oldReturn, newReturn);
  console.log("✓ Bước 3: Đã gộp gợi ý theo đặc điểm vật lý vào return");
} else {
  console.log("✗ Bước 3: Không khớp return statement — cần kiểm tra tay");
}

// ============================================================
// BƯỚC 4: Sửa chỗ gọi buildSuitableFor(raw) để truyền thêm tham số
// ============================================================
const oldCall = `  const suitableFor =
    buildSuitableFor(raw);`;

const newCall = `  const suitableFor =
    buildSuitableFor(raw, {
      prefix,
      areaM2: getAreaNumber(listing, parsed, raw),
      floorCount: getFloorCount(raw),
    });`;

if (content.includes(oldCall)) {
  content = content.replace(oldCall, newCall);
  console.log("✓ Bước 4: Đã sửa chỗ gọi buildSuitableFor");
} else {
  console.log("✗ Bước 4: Không khớp chỗ gọi hàm — cần kiểm tra tay");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("\n✓ Đã lưu file lib/socialContent.ts");
