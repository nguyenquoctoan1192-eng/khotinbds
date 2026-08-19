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
const NOMINATIM_DELAY_MS = 1100;

type ListingForGeocode = {
  id: string;
  address?: string | null;
  district?: string | null;
  ward?: string | null;
  street?: string | null;
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
    sanitizePublicStreet(listing.street || listing.address || ""),
    compactText(listing.ward),
    compactText(listing.district),
    "TP. Hồ Chí Minh",
    "Việt Nam",
  ].filter(Boolean);

  return parts.join(", ");
}

async function geocodeWithNominatim(listing: ListingForGeocode): Promise<GeocodeResult | null> {
  const address = buildPublicGeocodeAddress(listing);
  if (!address) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("q", address);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": `batdongsan-web/1.0${process.env.NOMINATIM_EMAIL ? ` (${process.env.NOMINATIM_EMAIL})` : ""}`,
    },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = json[0];
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);

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
  const geocoded = await geocodeWithNominatim(listing);
  if (geocoded) return geocoded;

  return approximateByDistrict(listing);
}

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

    let query = supabase
      .from("listings")
      .select("id,address,district,ward,street,latitude,longitude,geocode_status")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (listingId) {
      query = query.eq("id", listingId).limit(1);
    } else {
      query = query.or("latitude.is.null,longitude.is.null,geocode_status.eq.failed");
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: isMissingCoordinateColumns(error)
            ? "Cần chạy migration 202607220001_add_listing_coordinates.sql trước khi geocode."
            : error.message,
        },
        { status: 500 }
      );
    }

    const listings = (data || []) as ListingForGeocode[];
    const results = [];

    for (const [index, listing] of listings.entries()) {
      if (isValidCoordinatePair(listing.latitude, listing.longitude)) {
        results.push({ id: listing.id, status: "skipped_has_coordinates" });
        continue;
      }

      if (index > 0) await sleep(NOMINATIM_DELAY_MS);

      const coordinate = await resolveCoordinate(listing);
      const payload = coordinate
        ? {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            geocoded_at: new Date().toISOString(),
            geocode_status: coordinate.status,
          }
        : {
            geocoded_at: new Date().toISOString(),
            geocode_status: "failed",
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

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[listings/geocode] failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Không cập nhật được tọa độ.",
      },
      { status: 500 }
    );
  }
}

