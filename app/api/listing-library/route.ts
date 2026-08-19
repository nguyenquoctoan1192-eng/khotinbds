import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/services/supabaseServer";
import { getAccess } from "@/lib/access";

const supabase = createSupabaseServiceClient();

const LISTING_LIBRARY_MIGRATION_MESSAGE =
  "Bạn cần chạy migration 202606210001_create_listing_library.sql trên Supabase.";

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const isMissingListingLibraryTable = (error: SupabaseError) => {
  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("listing_library") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
};

const logSupabaseError = (operation: "GET" | "POST", error: SupabaseError) => {
  console.error(`[listing-library] Supabase ${operation} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
};

const getSupabaseErrorMessage = (error: SupabaseError) =>
  isMissingListingLibraryTable(error)
    ? LISTING_LIBRARY_MIGRATION_MESSAGE
    : `Lỗi Supabase: ${error.message || "Không xác định."}`;

const clampPagination = (
  value: string | null,
  fallback: number,
  max: number
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return Math.min(Math.floor(parsed), max);
};

const compactText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const escapeSearch = (value: string) =>
  value.replace(/[%_]/g, (match) => `\\${match}`).replace(/[,()]/g, " ");

const inferStreet = (value: unknown) => {
  const text = compactText(value) || "";

  return (
    text
      .replace(/\bP\.\s*[^,\n]+?(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i, " ")
      .replace(/\bPhường\s+[^,\n]+?(?=\s+Q\.?\s*\d|\s+Quận|\n|$)/i, " ")
      .replace(/\bQ\.?\s*\d{1,2}\b/gi, " ")
      .replace(/\bQuận\s*\d{1,2}\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
};

export async function POST(req: Request) {
  try {
    const access = await getAccess(req, ["admin", "agent"]);

    if (!access) {
      return NextResponse.json(
        {
          success: false,
          error: "Không có quyền tạo tin trong kho.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const content = body.content || {};

    const payload = {
      user_id: access.user.id,

      raw_input: compactText(body.raw_input),
      title: compactText(body.title),

      primary_content:
        compactText(content.primary_content) ||
        compactText(body.primary_content),

      chotot_title:
        compactText(content.cho_tot_title) || compactText(body.chotot_title),

      facebook_title:
        compactText(content.facebook_title) || compactText(body.facebook_title),

      short_description:
        compactText(content.short_description) ||
        compactText(body.short_description),

      seo_description:
        compactText(content.seo_description) || compactText(body.seo_description),

      phone: compactText(body.phone),
      district: compactText(body.district),

      street:
        compactText(body.street) || inferStreet(body.address || body.title),

      price: compactText(body.price),
      area: compactText(body.area),
      structure: compactText(body.structure),
    };

    if (!payload.primary_content) {
      return NextResponse.json(
        {
          success: false,
          error: "Thiếu nội dung chia sẻ.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("listing_library")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      logSupabaseError("POST", error);

      return NextResponse.json(
        {
          success: false,
          error: getSupabaseErrorMessage(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error) {
    console.error("Create listing library item failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `Không lưu được tin vào kho: ${error.message}`
            : "Không lưu được tin vào kho.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const access = await getAccess(req, ["admin", "agent"]);

    if (!access) {
      return NextResponse.json(
        {
          success: false,
          error: "Không có quyền truy cập kho tin đăng.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = clampPagination(searchParams.get("page"), 1, 100000);
    const limit = clampPagination(searchParams.get("limit"), 20, 50);
    const search = compactText(searchParams.get("search"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("listing_library")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (access.isAgent) {
  query = query.eq("user_id", access.user.id);
}

    if (search) {
      const keyword = `%${escapeSearch(search)}%`;

      query = query.or(
        [
          `raw_input.ilike.${keyword}`,
          `title.ilike.${keyword}`,
          `primary_content.ilike.${keyword}`,
          `chotot_title.ilike.${keyword}`,
          `facebook_title.ilike.${keyword}`,
          `district.ilike.${keyword}`,
          `street.ilike.${keyword}`,
          `phone.ilike.${keyword}`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;

    if (error) {
      logSupabaseError("GET", error);

      return NextResponse.json(
        {
          success: false,
          error: getSupabaseErrorMessage(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    });
  } catch (error) {
    console.error("[listing-library] GET failed before Supabase response:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `Không tải được kho tin đăng: ${error.message}`
            : "Không tải được kho tin đăng.",
      },
      { status: 500 }
    );
  }
}

