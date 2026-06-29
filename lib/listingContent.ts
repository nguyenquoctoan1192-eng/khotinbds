export type ListingContentInput = {
  title?: string | null;
  price?: string | number | null;
  district?: string | null;
  area?: string | number | null;
  width?: string | number | null;
  length?: string | number | null;
  floors?: string | number | null;
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  wc?: string | number | null;
  furnishing?: string | null;
  furniture?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  description?: string | null;
};

export type ListingContentResult = {
  primary_content: string;
  cho_tot_title: string;
  facebook_title: string;
  short_description: string;
  seo_description: string;
};

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value || "").trim();
  if (!raw) return null;

  const numeric = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

const trimWords = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const sliced = normalized.slice(0, maxLength + 1);
  const lastSpace = sliced.lastIndexOf(" ");

  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced.slice(0, maxLength)).trim();
};

const fitSeoLength = (value: string) =>
  value.replace(/\s+/g, " ").trim().replace(/[,\s]+$/, ".");

const sanitizePublicText = (value: string) =>
  value
    .replace(/\bhh\s*trao\s*đổi\b/giu, "")
    .replace(/\bhoa\s*hồng\b/giu, "")
    .replace(/\bhh\s*1\/2\b/giu, "")
    .replace(/\bhh\s*2n1t?\b/giu, "")
    .replace(/\bhhtt\b/giu, "")
    .replace(/\bhh\b/giu, "")
    .replace(/\bNĐ\b/gu, "")
    .replace(/\bnhận\s*đủ\b/giu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const formatListingPriceLabel = (price: ListingContentInput["price"]) => {
  const raw = compactText(price);
  const normalized = normalizeText(raw);
  const millionMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu)\b/);
  const amount =
    millionMatch?.[1] !== undefined
      ? Number(millionMatch[1].replace(",", "."))
      : toNumber(price);

  if (!amount || amount <= 0) return "";

  const millions = amount >= 1000000 ? amount / 1000000 : amount;
  return `${formatNumber(millions)} triệu/tháng`;
};

const getCleanTitle = (input: ListingContentInput) => {
  const title = sanitizePublicText(compactText(input.title));
  return title || "Nhà cho thuê";
};

const getHeadlineTitle = (title: string) =>
  title.replace(/\s*,\s*/g, " - ").toUpperCase();

const getDistrictLabel = (input: ListingContentInput, title: string) => {
  const explicitDistrict = compactText(input.district);
  if (explicitDistrict) return explicitDistrict;

  const titleDistrict = title.match(/,\s*(Quận\s+[^,]+)\s*$/iu);
  return titleDistrict ? titleDistrict[1].trim() : "";
};

const buildAreaLine = (input: ListingContentInput) => {
  const width = toNumber(input.width);
  const length = toNumber(input.length);
  const area = toNumber(input.area);

  if (width && length && area) {
    return `📐 ${formatNumber(width)} x ${formatNumber(length)}m, diện tích sử dụng khoảng ${formatNumber(area)}m²`;
  }

  if (area) {
    return `📐 Diện tích sử dụng khoảng ${formatNumber(area)}m²`;
  }

  return "";
};

const getAreaLabel = (input: ListingContentInput) => {
  const area = toNumber(input.area);
  return area ? `${formatNumber(area)}m²` : "";
};

const buildBuildingLine = (input: ListingContentInput) => {
  const floors = toNumber(input.floors);

  if (floors === null) return "";
  if (floors <= 0) return "Trệt";

  return `Trệt, ${formatNumber(floors)} lầu`;
};

const buildRoomLine = (input: ListingContentInput) => {
  const bedrooms = toNumber(input.bedrooms);
  const wc = toNumber(input.bathrooms ?? input.wc);
  const parts = [
    bedrooms ? `${formatNumber(bedrooms)} phòng ngủ` : "",
    wc ? `${formatNumber(wc)} WC` : "",
  ].filter(Boolean);

  return parts.length ? `🛏 ${parts.join(", ")}` : "";
};

const buildFurnishingLine = (input: ListingContentInput) => {
  const furnishing = compactText(input.furnishing || input.furniture);

  if (/^cơ bản$/iu.test(furnishing)) return "🛋 Nội thất cơ bản";
  if (/^đầy đủ$/iu.test(furnishing)) return "🛋 Full nội thất";

  return "";
};

const isAlleyListing = (title: string) => /\bhẻm\b/iu.test(title);

const isFrontOrLargeListing = (input: ListingContentInput, title: string) => {
  const area = toNumber(input.area) || 0;
  const normalized = normalizeText(`${title} ${input.description || ""}`);

  return (
    area >= 80 ||
    /\bmat\s*tien\b|\bmt\b|\bmat\s*bang\b|\bkinh\s*doanh\b/.test(normalized)
  );
};

const getSuitability = (input: ListingContentInput, title: string) => {
  const price = toNumber(input.price) || 0;
  const area = toNumber(input.area) || 0;
  const smallAlley =
    isAlleyListing(title) && (!price || price <= 15000000) && (!area || area <= 80);

  if (smallAlley) {
    return {
      primary: "ở gia đình nhỏ, văn phòng online, studio nhỏ, kinh doanh online",
      short: "ở, làm văn phòng online, studio nhỏ hoặc kinh doanh online",
      seo: "ở gia đình, văn phòng online, studio nhỏ hoặc kinh doanh online",
    };
  }

  if (isFrontOrLargeListing(input, title)) {
    return {
      primary: "shop, spa, showroom, văn phòng đại diện",
      short: "shop, spa, showroom hoặc văn phòng đại diện",
      seo: "kinh doanh, showroom, spa hoặc văn phòng đại diện",
    };
  }

  return {
    primary: "ở gia đình, văn phòng online, studio nhỏ, kinh doanh online",
    short: "ở gia đình, làm văn phòng online, studio nhỏ hoặc kinh doanh online",
    seo: "ở gia đình, văn phòng online, studio nhỏ hoặc kinh doanh online",
  };
};

const getAdvantageLines = (input: ListingContentInput, title: string) => {
  const district = getDistrictLabel(input, title);

  if (isFrontOrLargeListing(input, title)) {
    return [
      "Mặt tiền dễ nhận diện",
      district ? `Khu trung tâm ${district}` : "",
      "Mặt bằng dễ bố trí công năng",
    ].filter(Boolean);
  }

  const firstLine = isAlleyListing(title)
    ? "Hẻm dễ đi, khu dân cư ổn định"
    : "Khu dân cư ổn định, thuận tiện di chuyển";

  return [firstLine, "Nhà dễ bố trí công năng"];
};

export const generateListingContentFallback = (
  input: ListingContentInput
): ListingContentResult => {
  const title = getCleanTitle(input);
  const headlineTitle = getHeadlineTitle(title);
  const areaLine = buildAreaLine(input);
  const areaLabel = getAreaLabel(input);
  const buildingLine = buildBuildingLine(input);
  const roomLine = buildRoomLine(input);
  const furnishingLine = buildFurnishingLine(input);
  const priceLabel = formatListingPriceLabel(input.price);
  const phone = compactText(input.phone || input.contact_phone);
  const suitability = getSuitability(input, title);
  const advantages = getAdvantageLines(input, title);

  const detailLines = [
    areaLine,
    buildingLine ? `🏢 ${buildingLine}` : "",
    roomLine,
    furnishingLine,
    priceLabel ? `💰 ${priceLabel}` : "",
  ].filter(Boolean);
  const benefitLines = [
    ...advantages.map((line) => `✅ ${line}`),
    `✅ Phù hợp: ${suitability.primary}`,
  ];
  const contactLine =
    phone ? `☎ Liên hệ: ${phone} để xem nhà thực tế.` : "☎ Liên hệ để xem nhà thực tế.";

  const primaryContent = [
    `🔥 CHO THUÊ ${headlineTitle} 🔥`,
    detailLines.join("\n"),
    benefitLines.join("\n"),
    contactLine,
  ]
    .filter(Boolean)
    .join("\n\n");

  const choTotTitle = [
    `Cho thuê ${title}`,
    areaLabel,
    priceLabel,
  ]
    .filter(Boolean)
    .join(", ");
  const facebookTitle = [
    `🔥 ${title}`,
    areaLabel,
    priceLabel,
  ]
    .filter(Boolean)
    .join(" - ");
  const detailParts = [
    areaLabel ? `Diện tích sử dụng khoảng ${areaLabel}` : "",
    buildingLine,
    priceLabel ? `giá ${priceLabel}` : "",
  ].filter(Boolean);
  const shortDescription = [
    `Cho thuê ${title}.`,
    detailParts.length ? `${detailParts.join(", ")}.` : "",
    `Phù hợp ${suitability.short}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const seoDescription = fitSeoLength(
    [
      `Cho thuê ${title}`,
      areaLabel ? `diện tích sử dụng khoảng ${areaLabel}` : "",
      priceLabel ? `giá ${priceLabel}` : "",
    ]
      .filter(Boolean)
      .join(", ") + `. Nhà phù hợp ${suitability.seo}.`
  );

  return {
    primary_content: sanitizePublicText(primaryContent),
    cho_tot_title: sanitizePublicText(trimWords(choTotTitle, 90)),
    facebook_title: sanitizePublicText(trimWords(facebookTitle, 100)),
    short_description: sanitizePublicText(shortDescription),
    seo_description: sanitizePublicText(seoDescription),
  };
};

export const buildListingContentPrompt = (input: ListingContentInput) => {
  const fallback = generateListingContentFallback(input);

  return `Return this exact JSON object without changing any field:\n${JSON.stringify(
    fallback
  )}`;
};

export const sanitizeListingContent = (
  _value: Partial<ListingContentResult>,
  input: ListingContentInput
): ListingContentResult => generateListingContentFallback(input);
