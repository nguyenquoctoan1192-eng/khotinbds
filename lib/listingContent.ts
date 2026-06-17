export type ListingContentInput = {
  title?: string | null;
  price?: string | number | null;
  district?: string | null;
  area?: string | number | null;
  description?: string | null;
};

export type ListingContentResult = {
  listing_title: string;
  short_description: string;
  facebook_post: string;
  seo_description: string;
};

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

export const formatListingPriceLabel = (price: ListingContentInput["price"]) => {
  if (price === null || price === undefined || price === "") return "";

  const raw = String(price).trim();
  if (/[a-zA-Z]/.test(raw)) return raw;

  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return raw;

  if (numeric >= 1000000) {
    const million = numeric / 1000000;
    return `${Number.isInteger(million) ? million : million.toFixed(1)}tr`;
  }

  return raw;
};

const buildDetailsLine = (input: ListingContentInput) => {
  const area = compactText(input.area);
  const description = compactText(input.description);

  return [area ? `Diện tích ${area}m²` : "", description]
    .filter(Boolean)
    .join(", ");
};

export const generateListingContentFallback = (
  input: ListingContentInput
): ListingContentResult => {
  const title = compactText(input.title) || "Nhà cho thuê";
  const district = compactText(input.district);
  const price = formatListingPriceLabel(input.price);
  const details = buildDetailsLine(input);
  const location = district ? `khu vực ${district}` : "vị trí thuận tiện";

  const listingTitle = [title, district, price].filter(Boolean).join(" - ");
  const shortDescription = [
    `${title} ${location}.`,
    details ? `Thông tin nổi bật: ${details}.` : "",
    price ? `Giá thuê ${price}, phù hợp khách đang cần xem nhanh và chốt sớm.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const facebookPost = [
    listingTitle,
    "",
    details ? `Thông tin: ${details}` : "",
    price ? `Giá: ${price}` : "",
    district ? `Khu vực: ${district}` : "",
    "Liên hệ để xem hình thực tế và lịch xem nhà.",
  ]
    .filter(Boolean)
    .join("\n");

  const seoDescription = `${shortDescription}`.slice(0, 155);

  return {
    listing_title: listingTitle,
    short_description: shortDescription,
    facebook_post: facebookPost,
    seo_description: seoDescription,
  };
};

export const buildListingContentPrompt = (input: ListingContentInput) => `
Bạn là chuyên viên viết nội dung tin đăng bất động sản cho môi giới Việt Nam.

Hãy tạo nội dung ngắn, rõ, có tính bán hàng nhưng không phóng đại.
Không bịa thông tin ngoài dữ liệu đầu vào.
Giữ tiếng Việt tự nhiên, phù hợp đăng website/Zalo/Facebook.

Dữ liệu:
- Title/address: ${compactText(input.title) || "chưa có"}
- Price: ${formatListingPriceLabel(input.price) || "chưa có"}
- District: ${compactText(input.district) || "chưa có"}
- Area: ${compactText(input.area) || "chưa có"}
- Description/structure: ${compactText(input.description) || "chưa có"}

Trả về JSON thuần với:
listing_title, short_description, facebook_post, seo_description.
`;

export const sanitizeListingContent = (
  value: Partial<ListingContentResult>,
  input: ListingContentInput
): ListingContentResult => {
  const fallback = generateListingContentFallback(input);

  return {
    listing_title: compactText(value.listing_title) || fallback.listing_title,
    short_description:
      compactText(value.short_description) || fallback.short_description,
    facebook_post: compactText(value.facebook_post) || fallback.facebook_post,
    seo_description:
      compactText(value.seo_description) || fallback.seo_description,
  };
};
