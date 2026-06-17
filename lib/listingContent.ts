export type ListingContentInput = {
  title?: string | null;
  address?: string | null;
  district?: string | null;
  price?: string | number | null;
  description?: string | null;
};

export type ListingContentResult = {
  cho_tot_title: string;
  facebook_title: string;
  short_description: string;
  seo_description: string;
};

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const trimToLength = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}…` : value;

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

const getBaseTitle = (input: ListingContentInput) =>
  compactText(input.title) ||
  compactText(input.address) ||
  "Nhà cho thuê";

const buildLocationLabel = (input: ListingContentInput) =>
  [compactText(input.address), compactText(input.district)]
    .filter(Boolean)
    .join(", ");

export const generateListingContentFallback = (
  input: ListingContentInput
): ListingContentResult => {
  const title = getBaseTitle(input);
  const address = compactText(input.address);
  const district = compactText(input.district);
  const price = formatListingPriceLabel(input.price);
  const description = compactText(input.description);
  const location = buildLocationLabel(input) || "vị trí thuận tiện";

  const choTotTitle = trimToLength(
    [title, district, price].filter(Boolean).join(" - "),
    70
  );
  const facebookTitle = trimToLength(
    [`Cho thuê ${title}`, district, price].filter(Boolean).join(" | "),
    90
  );
  const shortDescription = [
    `${title} tại ${location}.`,
    description ? `Điểm nổi bật: ${description}.` : "",
    price ? `Giá ${price}, phù hợp khách cần xem nhanh và chốt sớm.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const seoDescription = trimToLength(
    [
      `Cho thuê ${title}`,
      address ? `địa chỉ ${address}` : "",
      district ? `khu vực ${district}` : "",
      price ? `giá ${price}` : "",
      description,
    ]
      .filter(Boolean)
      .join(", "),
    155
  );

  return {
    cho_tot_title: choTotTitle,
    facebook_title: facebookTitle,
    short_description: shortDescription,
    seo_description: seoDescription,
  };
};

export const buildListingContentPrompt = (input: ListingContentInput) => `
Bạn là chuyên viên viết nội dung tin đăng bất động sản cho môi giới Việt Nam.

Hãy tạo 4 nội dung ngắn, rõ, có tính bán hàng nhưng không phóng đại.
Không bịa thông tin ngoài dữ liệu đầu vào.
Giữ tiếng Việt tự nhiên, dễ đăng trên Chợ Tốt, Facebook và website.

Yêu cầu từng trường:
- cho_tot_title: tiêu đề đăng Chợ Tốt, tối đa 70 ký tự.
- facebook_title: tiêu đề đăng Facebook, tự nhiên, dễ thu hút, tối đa 90 ký tự.
- short_description: mô tả ngắn 2-3 câu.
- seo_description: mô tả SEO tối đa 155 ký tự.

Dữ liệu:
- Title: ${compactText(input.title) || "chưa có"}
- Address: ${compactText(input.address) || "chưa có"}
- District: ${compactText(input.district) || "chưa có"}
- Price: ${formatListingPriceLabel(input.price) || "chưa có"}
- Description: ${compactText(input.description) || "chưa có"}

Trả về JSON thuần với:
cho_tot_title, facebook_title, short_description, seo_description.
`;

export const sanitizeListingContent = (
  value: Partial<ListingContentResult>,
  input: ListingContentInput
): ListingContentResult => {
  const fallback = generateListingContentFallback(input);

  return {
    cho_tot_title: compactText(value.cho_tot_title) || fallback.cho_tot_title,
    facebook_title:
      compactText(value.facebook_title) || fallback.facebook_title,
    short_description:
      compactText(value.short_description) || fallback.short_description,
    seo_description:
      compactText(value.seo_description) || fallback.seo_description,
  };
};
