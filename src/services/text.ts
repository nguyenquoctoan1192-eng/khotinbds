export function normalizeVietnameseText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function compactSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasKeyword(text: string, keyword: string) {
  const normalizedText = normalizeVietnameseText(text);
  const normalizedKeyword = normalizeVietnameseText(keyword);
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(normalizedKeyword).replace(/\s+/g, "\\s+")}(?:$|[^a-z0-9])`
  );

  return pattern.test(normalizedText);
}

export function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => normalizeVietnameseText(text).includes(keyword));
}
