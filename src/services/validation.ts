import { compactSpaces, normalizeVietnameseText } from "./text.ts";

export type NormalizedSize = {
  sqm?: number;
  dimensions?: {
    width: number;
    length: number;
  };
};

export function extractPhoneNumber(text: string): string | null {
  const compact = text.replace(/[\s.-]/g, "");
  const match = compact.match(/(?:0|\+84)(?:3|5|7|8|9)[0-9]{8}/);

  return match?.[0] ?? null;
}

export function normalizeBudget(raw: string): number | null {
  const text = normalizeVietnameseText(raw);
  const chucMatch = text.match(/(\d{1,2})\s*chuc/);

  if (chucMatch?.[1]) {
    const value = Number(chucMatch[1]);
    return Number.isFinite(value) ? value * 10 : null;
  }

  const unitMatch = text.match(/(\d{1,3})(?:[.,]\d+)?\s*(?:trieu|tr|cu|chai)\b/);

  if (unitMatch?.[1]) {
    const value = Number(unitMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const contextualNumber = text.match(
    /(?:duoi|toi da|max|tam|khoang|ngan sach|gia|budget)\s*(\d{1,3})(?:\b|\/thang| mot thang)/
  );

  if (contextualNumber?.[1]) {
    const value = Number(contextualNumber[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

export function normalizeSize(raw: string): NormalizedSize | null {
  const text = normalizeVietnameseText(raw);
  const dimensionMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)/
  );

  if (dimensionMatch?.[1] && dimensionMatch[2]) {
    const width = Number(dimensionMatch[1].replace(",", "."));
    const length = Number(dimensionMatch[2].replace(",", "."));

    if (Number.isFinite(width) && Number.isFinite(length)) {
      return { dimensions: { width, length }, sqm: width * length };
    }
  }

  const sqmMatch = text.match(/(\d{2,4})\s*(?:m2|m²|m\^2|met vuong|met|m)(?:\b|$)/);

  if (sqmMatch?.[1]) {
    const sqm = Number(sqmMatch[1]);
    return Number.isFinite(sqm) ? { sqm } : null;
  }

  return null;
}

export function formatSizeForState(size: NormalizedSize | null): string | null {
  if (!size) return null;
  if (size.dimensions) {
    return `${size.dimensions.width}x${size.dimensions.length}`;
  }
  if (size.sqm) return `${size.sqm}m2`;
  return null;
}

export function normalizeStructure(raw: string): string | null {
  const text = normalizeVietnameseText(raw);

  if (text.includes("tret") && text.includes("lung")) return "tret_lung";

  const groundFloorMatch = text.match(/(?:tret\s*)?(\d+)\s*lau/);
  if (text.includes("tret") && groundFloorMatch?.[1]) {
    return `tret_${groundFloorMatch[1]}_lau`;
  }

  if (text.includes("tret") && text.includes("lau")) return "tret_lau";
  if (text.includes("san thuong")) return "san_thuong";
  if (text.includes("lung")) return "co_lung";
  if (text.includes("tret")) return "tret";

  const bedroom = text.match(/(\d+)\s*(?:pn|phong ngu)/)?.[1];
  const wc = text.match(/(\d+)\s*(?:wc|toilet|ve sinh)/)?.[1];
  if (bedroom || wc) {
    return compactSpaces(
      `${bedroom ? `${bedroom}_phong_ngu` : ""}${wc ? `_${wc}_wc` : ""}`
    ).replace(/^_/, "");
  }

  return null;
}

export function normalizeContactType(raw: string): "phone" | "zalo" | null {
  const text = normalizeVietnameseText(raw);
  if (text.includes("zalo")) return "zalo";
  return extractPhoneNumber(raw) ? "phone" : null;
}
