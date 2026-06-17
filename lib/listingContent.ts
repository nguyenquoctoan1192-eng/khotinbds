export type ListingContentInput = {
  title?: string | null;
  address?: string | null;
  district?: string | null;
  price?: string | number | null;
  description?: string | null;
  dimensions?: string | null;
  structure?: string | null;
  bedrooms?: string | number | null;
  wc?: string | number | null;
  contact_phone?: string | null;
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

const compactNumberText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  return text && text !== "0" ? text : "";
};

const trimToLength = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength - 1).trim() : value;

export const formatListingPriceLabel = (price: ListingContentInput["price"]) => {
  if (price === null || price === undefined || price === "") return "";

  const raw = String(price).trim();
  if (/[a-zA-ZÀ-ỹ]/.test(raw)) return raw;

  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return raw;

  if (numeric >= 1000000) {
    const million = numeric / 1000000;
    return `${Number.isInteger(million) ? million : million.toFixed(1)}tr`;
  }

  return raw;
};

const getShortLocation = (input: ListingContentInput) =>
  compactText(input.title) ||
  [compactText(input.address), compactText(input.district)]
    .filter(Boolean)
    .join(", ") ||
  "Nhà cho thuê";

const buildRoomLine = (input: ListingContentInput) => {
  const bedrooms = compactNumberText(input.bedrooms);
  const wc = compactNumberText(input.wc);

  if (bedrooms && wc) return `${bedrooms}PN - ${wc}WC`;
  if (bedrooms) return `${bedrooms}PN`;
  if (wc) return `${wc}WC`;

  return "";
};

export const buildPrimaryListingContent = (input: ListingContentInput) => {
  const shortLocation = getShortLocation(input);
  const price = formatListingPriceLabel(input.price);
  const dimensions = compactText(input.dimensions);
  const structure = compactText(input.structure);
  const roomLine = buildRoomLine(input);
  const contactPhone = compactText(input.contact_phone);
  const lines = [
    `🏠 ${[shortLocation, price].filter(Boolean).join(" - ")}`,
    dimensions ? `📐 ${dimensions}` : "",
    structure ? `🏢 ${structure}` : "",
    roomLine ? `🛏️ ${roomLine}` : "",
    contactPhone ? `☎️ ${contactPhone}` : "",
  ].filter(Boolean);

  return lines.slice(0, 5).join("\n");
};

export const generateListingContentFallback = (
  input: ListingContentInput
): ListingContentResult => {
  const title = getShortLocation(input);
  const district = compactText(input.district);
  const price = formatListingPriceLabel(input.price);
  const primaryContent = buildPrimaryListingContent(input);
  const choTotTitle = trimToLength(
    [title, district, price].filter(Boolean).join(" - "),
    70
  );
  const facebookTitle = trimToLength(
    [title, price].filter(Boolean).join(" - "),
    90
  );
  const seoDescription = trimToLength(
    [title, district, price, compactText(input.dimensions), compactText(input.structure)]
      .filter(Boolean)
      .join(", "),
    155
  );

  return {
    primary_content: primaryContent,
    cho_tot_title: choTotTitle,
    facebook_title: facebookTitle,
    short_description: primaryContent,
    seo_description: seoDescription,
  };
};

export const buildListingContentPrompt = (input: ListingContentInput) => `
Bạn là trợ lý định dạng nội dung tin bất động sản cho môi giới Việt Nam.

Nội dung chính phải dùng đúng format này, tối đa 5 dòng:
🏠 {short_location} - {price}
📐 {dimensions}
🏢 {structure}
🛏️ {bedrooms}PN - {wc}WC
☎️ {contact_phone}

Rules:
- Keep under 6 lines.
- No marketing language.
- No emojis except: 🏠 📐 🏢 🛏️ ☎️
- Remove long descriptions by default.
- Optimize for Facebook groups, Zalo and broker sharing.
- Do not invent missing facts.

Dữ liệu:
- Title: ${compactText(input.title) || "chưa có"}
- Address: ${compactText(input.address) || "chưa có"}
- District: ${compactText(input.district) || "chưa có"}
- Price: ${formatListingPriceLabel(input.price) || "chưa có"}
- Dimensions: ${compactText(input.dimensions) || "chưa có"}
- Structure: ${compactText(input.structure) || "chưa có"}
- Bedrooms: ${compactNumberText(input.bedrooms) || "chưa có"}
- WC: ${compactNumberText(input.wc) || "chưa có"}
- Contact phone: ${compactText(input.contact_phone) || "chưa có"}
- Description reference only: ${compactText(input.description) || "chưa có"}

Trả về JSON thuần với:
primary_content, cho_tot_title, facebook_title, short_description, seo_description.

short_description should use the same compact sharing format as primary_content.
`;

export const sanitizeListingContent = (
  value: Partial<ListingContentResult>,
  input: ListingContentInput
): ListingContentResult => {
  const fallback = generateListingContentFallback(input);
  const primaryContent = fallback.primary_content;

  return {
    primary_content: primaryContent,
    cho_tot_title: compactText(value.cho_tot_title) || fallback.cho_tot_title,
    facebook_title:
      compactText(value.facebook_title) || fallback.facebook_title,
    short_description: primaryContent,
    seo_description:
      compactText(value.seo_description) || fallback.seo_description,
  };
};
