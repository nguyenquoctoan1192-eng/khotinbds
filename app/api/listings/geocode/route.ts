import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";
import { getDistrictCenter } from "@/lib/map/districtCenters";
import { isValidCoordinatePair, sanitizePublicStreet } from "@/lib/map/coordinates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BATCH_SIZE = 5;
const GEOCODE_DELAY_MS = 500;

type ListingForGeocode = {
  id: string;
  address?: string | null;
  district?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  status: "geocoded" | "approximate";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

function isMissingCoordinateColumns(error: { code?: string; message?: string; details?: string; hint?: string }) {
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return error.code === "42703" || text.includes("latitude") || text.includes("longitude") || text.includes("geocode_status");
}

function buildPublicGeocodeAddress(listing: ListingForGeocode) {
  const parts = [
    sanitizePublicStreet(listing.address || ""),
    compactText(listing.district),
    "TP. Hồ Chí Minh",
    "Việt Nam",
  ].filter(Boolean);

  return parts.join(", ");
}

function normalizeVietnamese(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

async function geocodeWithPhoton(listing: ListingForGeocode): Promise<GeocodeResult | null> {
  const streetQuery = sanitizePublicStreet(listing.address || "");
  const address = buildPublicGeocodeAddress(listing);
  if (!address || !streetQuery) return null;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "10");
  // Giới hạn CỨNG kết quả trong khung tọa độ TP.HCM (và vùng giáp ranh gần)
  url.searchParams.set("bbox", "106.35,10.35,106.95,10.95");

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string;
        street?: string;
        osm_key?: string;
        osm_value?: string;
      };
    }>;
  };

  const features = json.features || [];
  if (features.length === 0) return null;

  const normalizedStreetQuery = normalizeVietnamese(streetQuery);

  // Chỉ chấp nhận kết quả có TÊN ĐƯỜNG thật sự chứa tên đường đang tìm.
  // Photon fuzzy-match có thể trả về địa điểm phát âm gần giống (cửa hàng,
  // trạm xe bus...) hoàn toàn không liên quan — phải loại bỏ.
  const candidates = features.filter((feature) => {
    const haystack = normalizeVietnamese(
      [feature.properties?.street, feature.properties?.name]
        .filter(Boolean)
        .join(" ")
    );
    return haystack.includes(normalizedStreetQuery);
  });

  if (candidates.length === 0) return null;

  // Trong các kết quả khớp tên đường, ưu tiên kết quả là đường thật
  // (osm_key=highway) hơn là nhà/địa điểm gắn trên đường đó.
  const chosen =
    candidates.find((feature) => feature.properties?.osm_key === "highway") ||
    candidates[0];

  const coordinates = chosen.geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);

  if (!isValidCoordinatePair(latitude, longitude)) return null;

  return { latitude, longitude, status: "geocoded" };
}

function approximateByDistrict(listing: ListingForGeocode): GeocodeResult | null {
  const center = getDistrictCenter(listing.district || listing.address);
  if (!center) return null;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    status: "approximate",
  };
}

async function resolveCoordinate(listing: ListingForGeocode) {
  const geocoded = await geocodeWithPhoton(listing);
  if (geocoded) return geocoded;

  return approximateByDistrict(listing);
}

/**
 * Lõi xử lý dùng chung cho cả:
 * - POST (geocode 1 tin cụ thể ngay sau khi tạo/sửa, yêu cầu quyền admin)
 * - GET  (Vercel Cron gọi định kỳ, xử lý hàng loạt tin còn thiếu tọa độ)
 */
async function runGeocodeBatch(listingId: string, limit: number) {
  let query = supabase
    .from("listings")
    .select("id,address,district,latitude,longitude,geocode_status")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (listingId) {
    query = query.eq("id", listingId).limit(1);
  } else {
    query = query.or("latitude.is.null,longitude.is.null,geocode_status.eq.failed");
  }

  const { data, error } = await query;

     if (error) {
    return {
      success: false as const,
      status: 500,
      error: isMissingCoordinateColumns(error)
        ? "Cần chạy migration 202607220001_add_listing_coordinates.sql trước khi geocode."
        : error.message,
    };
  }

  const listings = (data || []) as ListingForGeocode[];
  const results = [];

  for (const [index, listing] of listings.entries()) {
    if (isValidCoordinatePair(listing.latitude, listing.longitude)) {
      results.push({ id: listing.id, status: "skipped_has_coordinates" });
      continue;
    }

        if (index > 0) await sleep(GEOCODE_DELAY_MS);

        const coordinate = await resolveCoordinate(listing);
    const hasAnyAddressData = Boolean(
      compactText(listing.address) || compactText(listing.district)
    );
    const payload = coordinate
      ? {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          geocoded_at: new Date().toISOString(),
          geocode_status: coordinate.status,
        }
      : {
          geocoded_at: new Date().toISOString(),
          // Tin thiếu hẳn address/district: không có gì để thử lại,
          // đánh dấu trạng thái riêng để KHÔNG bị chọn lại vô tận
          // (khác "failed" — "failed" vẫn được thử lại ở batch sau).
          geocode_status: hasAnyAddressData ? "failed" : "no_address_data",
        };

    const { error: updateError } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", listing.id);

    results.push({
      id: listing.id,
      status: updateError ? "update_failed" : payload.geocode_status,
      error: updateError?.message,
    });
  }

  return { success: true as const, processed: results.length, results };
}

/**
 * Dùng cho việc geocode 1 tin ngay sau khi tạo/sửa từ trang admin.
 * Yêu cầu quyền admin (giữ nguyên như cũ).
 */
export async function POST(req: Request) {
  try {
    const access = await getAccess(req, ["admin"]);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Không có quyền cập nhật tọa độ." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const listingId = compactText(body.id || body.listing_id);
    const limit = Math.min(Math.max(Number(body.limit) || MAX_BATCH_SIZE, 1), MAX_BATCH_SIZE);

    const result = await runGeocodeBatch(listingId, limit);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, processed: result.processed, results: result.results });
  } catch (error) {
    console.error("[listings/geocode] POST failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không cập nhật được tọa độ.",
      },
      { status: 500 }
    );
  }
}

/**
 * Dùng cho Vercel Cron — tự động dọn dần các tin cũ chưa có tọa độ,
 * chạy định kỳ (xem vercel.json), KHÔNG cần đăng nhập admin.
 * Xác thực bằng CRON_SECRET (Vercel tự gửi header Authorization).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGeocodeBatch("", MAX_BATCH_SIZE);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, processed: result.processed, results: result.results });
  } catch (error) {
    console.error("[listings/geocode] CRON failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không cập nhật được tọa độ.",
      },
      { status: 500 }
    );
  }
}