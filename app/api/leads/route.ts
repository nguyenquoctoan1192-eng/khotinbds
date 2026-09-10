import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/services/supabaseServer";
import { parseVietnameseRequirement } from "@/lib/requirementParser";
import { normalizeSearchText } from "@/lib/searchNormalization";

type ListingRow = {
  id: string;
  title: string | null;
  address: string | null;
  district: string | null;
  price: number | string | null;
  area: number | string | null;
  bedrooms: number | string | null;
  status?: string | null;
  images?: string[] | null;
  description?: string | null;
};

type CustomerContactInfo = {
  fullname: string | null;
  phone: string | null;
  zalo: string | null;
  facebook: string | null;
};

type ParsedRequirement = {
  preferred_districts?: unknown;
  max_price?: unknown;
  min_area?: unknown;
};

const toNumber = (value: unknown): number => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const normalizeDistrict = (value: unknown): string =>
  normalizeSearchText(String(value || "")).trim();

const getPriceScore = (
  listingPrice: number,
  maxPrice: number | null
): number => {
  if (!listingPrice || !maxPrice) {
    return 0;
  }

  const diffRate =
    Math.abs(listingPrice - maxPrice) / maxPrice;

  if (listingPrice <= maxPrice) {
    return 35;
  }

  if (diffRate <= 0.1) {
    return 28;
  }

  if (diffRate <= 0.2) {
    return 18;
  }

  if (diffRate <= 0.35) {
    return 8;
  }

  return 0;
};

const getAreaScore = (
  listingArea: number,
  minArea: number | null
): number => {
  if (!listingArea || !minArea) {
    return 0;
  }

  if (listingArea >= minArea) {
    return 20;
  }

  if (listingArea >= minArea * 0.9) {
    return 12;
  }

  if (listingArea >= minArea * 0.8) {
    return 6;
  }

  return 0;
};

const buildKeywordText = (listing: ListingRow): string =>
  normalizeSearchText(
    [
      listing.title,
      listing.address,
      listing.district,
      listing.description,
    ]
      .filter(Boolean)
      .join(" ")
  );

const getReasons = ({
  districtScore,
  priceScore,
  areaScore,
}: {
  districtScore: number;
  priceScore: number;
  areaScore: number;
}): string[] => {
  const reasons: string[] = [];

  if (districtScore > 0) {
    reasons.push("Khu vực phù hợp");
  }

  if (priceScore > 0) {
    reasons.push("Giá gần ngân sách");
  }

  if (areaScore > 0) {
    reasons.push("Diện tích phù hợp");
  }

  return reasons;
};

/**
 * Phân tích thông tin liên hệ từ nội dung khách gửi.
 *
 * Chỉ nhận diện:
 * - Họ tên
 * - Số điện thoại
 * - Zalo
 * - Facebook
 *
 * Không phân tích nhu cầu BĐS trong mode customer_raw.
 * Toàn bộ nội dung khách gửi vẫn được giữ nguyên trong note.
 */
function extractCustomerContactInfo(
  rawText: string
): CustomerContactInfo {
  const text = String(rawText || "").trim();

  let phone: string | null = null;
  let zalo: string | null = null;
  let facebook: string | null = null;
  let fullname: string | null = null;

  // =====================================================
  // SỐ ĐIỆN THOẠI
  // =====================================================
  //
  // Hỗ trợ:
  // 0901234567
  // 0903 123 456
  // 0903.123.456
  // 0903-123-456
  //
  const phoneMatch = text.match(
    /(?<!\d)(0\d{2}[\s.-]?\d{3}[\s.-]?\d{4})(?!\d)/
  );

  if (phoneMatch?.[1]) {
    phone = phoneMatch[1]
      .replace(/[.\s-]/g, "")
      .trim();
  }

  // =====================================================
  // FACEBOOK URL
  // =====================================================
  //
  // Hỗ trợ:
  // facebook.com/...
  // fb.com/...
  // www.facebook.com/...
  // https://facebook.com/...
  //
  const facebookUrlMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/[^\s]+/i
  );

  if (facebookUrlMatch?.[0]) {
    facebook = facebookUrlMatch[0].trim();
  } else {
    // Facebook: abc
    // Facebook - abc
    // Facebook abc
    const facebookLabelMatch = text.match(
      /facebook\s*[:-]?\s*([^\n,;]+)/i
    );

    if (facebookLabelMatch?.[1]) {
      const value = facebookLabelMatch[1].trim();

      if (value) {
        facebook = value;
      }
    }
  }

  // =====================================================
  // ZALO
  // =====================================================
  //
  // Hỗ trợ:
  // Zalo: Huyền
  // Zalo - Huyền
  // Zalo Huyền
  //
  // Nếu chỉ có SĐT mà không ghi Zalo
  // thì KHÔNG tự động lấy SĐT làm Zalo.
  //
  const zaloLabelMatch = text.match(
    /zalo\s*[:-]?\s*([^\n,;]+)/i
  );

  if (zaloLabelMatch?.[1]) {
    const value = zaloLabelMatch[1]
      .trim()
      .replace(/\s+/g, " ");

    if (
      value &&
      !/^có$/i.test(value) &&
      !/^co$/i.test(value) &&
      !/^yes$/i.test(value)
    ) {
      zalo = value;
    }
  }

  // =====================================================
  // HỌ TÊN
  // =====================================================
  //
  // Ưu tiên:
  // Tên: Huyền
  // Tên khách: Huyền
  // Khách tên: Huyền
  // Liên hệ Huyền
  // IB Huyền
  // inbox Huyền
  //
  const explicitNamePatterns: RegExp[] = [
    /(?:tên\s*(?:khách)?|khách\s*tên)\s*[:-]\s*([^\n,.;]+)/i,

    /(?:liên\s*hệ|lien\s*he)\s+([A-Za-zÀ-ỹĐđ][A-Za-zÀ-ỹĐđ\s]{1,40}?)(?:\s+ạ|\s+nhé|\s+nha|[.,;]|$)/i,

    /\b(?:ib|inbox)\s+([A-Za-zÀ-ỹĐđ][A-Za-zÀ-ỹĐđ\s]{1,40}?)(?:\s+ạ|\s+nhé|\s+nha|[.,;]|$)/i,
  ];

  for (const pattern of explicitNamePatterns) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const candidate = match[1]
      .replace(/\s+/g, " ")
      .trim();

    if (
      candidate &&
      candidate.length <= 50 &&
      !/\d/.test(candidate) &&
      !/facebook|zalo|sdt|số điện thoại/i.test(candidate)
    ) {
      fullname = candidate;
      break;
    }
  }

  return {
    fullname,
    phone,
    zalo,
    facebook,
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // =====================================================
    // CUSTOMER RAW
    // =====================================================
    //
    // Frontend gửi:
    //
    // {
    //   mode: "customer_raw",
    //   rawText: "..."
    // }
    //
    // Luồng này:
    // 1. Nhận nguyên văn nội dung khách.
    // 2. Tách Tên / SĐT / Zalo / Facebook.
    // 3. Lưu nguyên văn vào note.
    // 4. KHÔNG parse nhu cầu.
    // 5. KHÔNG matching bất động sản.
    // 6. KHÔNG chạy logic search cũ.
    //
    if (body.mode === "customer_raw") {
      const rawText = String(
        body.rawText ||
          body.note ||
          ""
      ).trim();

      if (!rawText) {
        return NextResponse.json(
          {
            success: false,
            error: "Vui lòng nhập nội dung khách gửi.",
          },
          { status: 400 }
        );
      }

      const contactInfo =
        extractCustomerContactInfo(rawText);

      const supabase =
        createSupabaseServiceClient();

      const { data: lead, error } =
        await supabase
          .from("leads")
          .insert([
            {
              fullname: contactInfo.fullname,
              phone: contactInfo.phone,
              zalo: contactInfo.zalo,
              facebook: contactInfo.facebook,

              // Giữ nguyên 100% nội dung khách gửi.
              note: rawText,
            },
          ])
          .select()
          .single();

      if (error) {
        console.error(
          "POST /api/leads customer_raw error:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "customer_raw",
        lead,
        detected: contactInfo,
      });
    }

    // =====================================================
    // LUỒNG CŨ
    // =====================================================

    const query = String(
      body.query ||
        body.keywordSearch ||
        body.note ||
        ""
    ).trim();

    if (!query && body.mode !== "lead") {
      return NextResponse.json(
        {
          success: false,
          message: "Missing query",
        },
        { status: 400 }
      );
    }

    const parsed =
      parseVietnameseRequirement(query) as ParsedRequirement;

    // =====================================================
    // CHUẨN HÓA PREFERRED DISTRICTS
    // =====================================================

    const bodyPreferredDistricts =
      Array.isArray(body.preferred_districts)
        ? body.preferred_districts
            .map(String)
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

    const parsedPreferredDistricts =
      Array.isArray(parsed.preferred_districts)
        ? parsed.preferred_districts
            .map(String)
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

    const preferredDistricts: string[] =
      bodyPreferredDistricts.length > 0
        ? bodyPreferredDistricts
        : parsedPreferredDistricts;

    // =====================================================
    // CHUẨN HÓA GIÁ
    // =====================================================

    const bodyMaxPrice = toNumber(
      body.max_price
    );

    const parsedMaxPrice = toNumber(
      parsed.max_price
    );

    const maxPrice: number | null =
      bodyMaxPrice > 0
        ? bodyMaxPrice
        : parsedMaxPrice > 0
          ? parsedMaxPrice
          : null;

    // =====================================================
    // CHUẨN HÓA DIỆN TÍCH
    // =====================================================

    const bodyMinArea = toNumber(
      body.min_area
    );

    const parsedMinArea = toNumber(
      parsed.min_area
    );

    const minArea: number | null =
      bodyMinArea > 0
        ? bodyMinArea
        : parsedMinArea > 0
          ? parsedMinArea
          : null;

    const supabase =
      createSupabaseServiceClient();

    // =====================================================
    // MODE LEAD
    // =====================================================

    if (body.mode === "lead") {
      const { data: lead, error } =
        await supabase
          .from("leads")
          .insert([
            {
              fullname:
                typeof body.fullname === "string"
                  ? body.fullname
                  : null,

              phone:
                typeof body.phone === "string"
                  ? body.phone
                  : null,

              preferred_districts:
                preferredDistricts,

              max_price:
                maxPrice,

              min_area:
                minArea,

              note:
                typeof body.note === "string"
                  ? body.note
                  : null,
            },
          ])
          .select()
          .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        lead,
        matches: Array.isArray(body.existing_matches)
          ? body.existing_matches
          : [],
      });
    }

    // =====================================================
    // MATCHING LISTING
    // =====================================================

    let request = supabase
      .from("listings")
      .select(
        "id, title, address, district, price, area, bedrooms, status, images, description"
      );

    // Nếu có quận yêu cầu thì lọc cứng
    // trước khi scoring.
    if (preferredDistricts.length > 0) {
      request = request.in(
        "district",
        preferredDistricts
      );
    }

    const { data, error } =
      await request;

    if (error) {
      throw error;
    }

    const listings =
      (data || []) as ListingRow[];

    const normalizedQuery =
      normalizeSearchText(query);

    const scored = listings
      .map((listing) => {
        const listingDistrict =
          normalizeDistrict(
            listing.district
          );

        const districtScore =
          preferredDistricts.length > 0 &&
          preferredDistricts.some(
            (district) =>
              normalizeDistrict(district) ===
              listingDistrict
          )
            ? 45
            : 0;

        const price =
          toNumber(listing.price);

        const area =
          toNumber(listing.area);

        const priceScore =
          getPriceScore(
            price,
            maxPrice
          );

        const areaScore =
          getAreaScore(
            area,
            minArea
          );

        const keywordText =
          buildKeywordText(listing);

        const keywordScore =
          normalizedQuery &&
          keywordText.includes(
            normalizedQuery
          )
            ? 15
            : 0;

        const score =
          districtScore +
          priceScore +
          areaScore +
          keywordScore;

        const reasons =
          getReasons({
            districtScore,
            priceScore,
            areaScore,
          });

        if (keywordScore > 0) {
          reasons.push(
            "Từ khóa phù hợp"
          );
        }

        return {
          ...listing,

          score,

          breakdown: {
            district_score:
              districtScore,

            price_score:
              priceScore,

            area_score:
              areaScore,

            bedroom_score: 0,

            business_score: 0,

            data_quality_penalty: 0,

            total_score: score,

            reasons,
          },

          reasons,
        };
      })
      .filter(
        (listing) =>
          listing.score > 0
      )
      .sort((a, b) => {
        const priceA =
          toNumber(a.price);

        const priceB =
          toNumber(b.price);

        if (maxPrice) {
          const priceDifference =
            Math.abs(
              priceA - maxPrice
            ) -
            Math.abs(
              priceB - maxPrice
            );

          if (priceDifference !== 0) {
            return priceDifference;
          }
        }

        return b.score - a.score;
      })
      .slice(0, 30);

    // =====================================================
    // FALLBACK WARNING
    // =====================================================

    const fallbackWarning =
      scored.length === 0
        ? preferredDistricts.length > 0
          ? `Không tìm thấy bất động sản phù hợp tại ${preferredDistricts.join(
              ", "
            )}.`
          : "Không tìm thấy bất động sản phù hợp với từ khóa này."
        : "";

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      query,

      parsed: {
        preferred_districts:
          preferredDistricts,

        max_price:
          maxPrice,

        min_area:
          minArea,
      },

      matches:
        scored,

      fallbackWarning,
    });
  } catch (err) {
    console.error(
      "POST /api/leads error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        message: "Server error",
        error:
          err instanceof Error
            ? err.message
            : "Lỗi máy chủ.",
      },
      { status: 500 }
    );
  }
}