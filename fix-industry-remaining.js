const fs = require("fs");

const filePath = "lib/socialContent.ts";
let content = fs.readFileSync(filePath, "utf8");

let fixedCount = 0;

// ============================================================
// BƯỚC 2: Đổi chữ ký hàm buildSuitableFor
// ============================================================
const sigPattern = /function buildSuitableFor\(\r?\n\s*raw: string,\r?\n\): string\[\] \{/;

if (sigPattern.test(content)) {
  content = content.replace(
    sigPattern,
    'function buildSuitableFor(\r\n  raw: string,\r\n  attrs: { prefix: string; areaM2: number | null; floorCount: number | null },\r\n): string[] {'
  );
  fixedCount++;
  console.log("✓ Bước 2: Đã đổi chữ ký hàm buildSuitableFor");
} else {
  console.log("✗ Bước 2: Vẫn không khớp");
}

// ============================================================
// BƯỚC 3: Gộp gợi ý theo đặc điểm vật lý vào return cuối hàm
// ============================================================
const returnPattern = /return \[\.\.\.new Set\(result\)\];\r?\n\}/;

if (returnPattern.test(content)) {
  content = content.replace(
    returnPattern,
    'const attributeSuggestions = suggestIndustriesByAttributes(\r\n    attrs.prefix,\r\n    attrs.areaM2,\r\n    attrs.floorCount,\r\n  );\r\n\r\n  return [...new Set([...result, ...attributeSuggestions])];\r\n}'
  );
  fixedCount++;
  console.log("✓ Bước 3: Đã gộp gợi ý theo đặc điểm vật lý");
} else {
  console.log("✗ Bước 3: Vẫn không khớp");
}

// ============================================================
// BƯỚC 4: Sửa chỗ gọi buildSuitableFor(raw)
// ============================================================
const callPattern = /const suitableFor =\r?\n\s*buildSuitableFor\(raw\);/;

if (callPattern.test(content)) {
  content = content.replace(
    callPattern,
    'const suitableFor =\r\n    buildSuitableFor(raw, {\r\n      prefix,\r\n      areaM2: getAreaNumber(listing, parsed, raw),\r\n      floorCount: getFloorCount(raw),\r\n    });'
  );
  fixedCount++;
  console.log("✓ Bước 4: Đã sửa chỗ gọi buildSuitableFor");
} else {
  console.log("✗ Bước 4: Vẫn không khớp");
}

if (fixedCount > 0) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`\n✓ Đã lưu ${fixedCount}/3 thay đổi vào file.`);
} else {
  console.log("\nKhông có gì được sửa thêm.");
}
