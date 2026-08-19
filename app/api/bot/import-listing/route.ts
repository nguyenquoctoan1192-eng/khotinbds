import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerUserId = process.env.BOT_OWNER_USER_ID;
const bucket =
  process.env.BOT_STORAGE_BUCKET ?? "listing-images";

/* =========================================================
 * SUPABASE
 * ======================================================= */

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Thiếu biến môi trường Supabase");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

/* =========================================================
 * AUTH BOT
 * ======================================================= */

function authorized(req: NextRequest) {
  const expected = process.env.BOT_SECRET;
  const supplied = req.headers.get("x-bot-secret");

  if (!expected || !supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(
      expectedBuffer,
      suppliedBuffer,
    )
  );
}

/* =========================================================
 * TEXT
 * ======================================================= */

function text(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value).trim();

  return result || null;
}

/* =========================================================
 * NUMBER
 * ======================================================= */

/**
 * Chuyển giá trị số về number.
 *
 * Ví dụ:
 *
 * "12"         -> 12
 * "12m"        -> 12,000,000
 * "12 triệu"   -> 12,000,000
 * "12tr"       -> 12,000,000
 * "12,5 triệu" -> 12,500,000
 * "2 tỷ"       -> 2,000,000,000
 * "80m2"       -> 80
 */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  let raw = String(value)
    .toLowerCase()
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

  if (!raw) return null;

  // Chuẩn hóa tiếng Việt
  raw = raw
    .replace(/đồng\/?tháng/g, "")
    .replace(/đồng\/?thang/g, "")
    .replace(/vnđ/g, "")
    .replace(/vnd/g, "")
    .trim();

  /*
   * Ví dụ:
   * 50tr      -> 50.000.000
   * 50 tr     -> 50.000.000
   * 50 triệu  -> 50.000.000
   * 12,5tr    -> 12.500.000
   * 2 tỷ      -> 2.000.000.000
   * 50000000  -> 50.000.000
   */

  const match = raw.match(/(\d+(?:[.,]\d+)?)/);

  if (!match) return null;

  const number = Number(match[1].replace(",", "."));

  if (!Number.isFinite(number)) {
    return null;
  }

  if (/(tỷ|ty|tỉ)(?![\p{L}])/u.test(raw)) {
    return Math.round(number * 1_000_000_000);
  }

  if (/(tr|triệu)(?![\p{L}])/u.test(raw)) {
    return Math.round(number * 1_000_000);
  }

  if (/(k|nghìn|nghin)(?![\p{L}])/u.test(raw)) {
    return Math.round(number * 1_000);
  }

  return Math.round(number);
}

/* =========================================================
 * GIÁ TỪ TOÀN BỘ NỘI DUNG TIN
 * ======================================================= */

/**
 * Tìm giá có đơn vị trong nội dung tin.
 *
 * Ví dụ:
 *
 * "50tr hh1/2 0903718307"
 * -> 50,000,000
 *
 * "12 triệu/tháng"
 * -> 12,000,000
 *
 * "2 tỷ"
 * -> 2,000,000,000
 *
 * QUAN TRỌNG:
 * Không lấy số "2" trong "hh1/2" làm giá.
 */
function parsePriceFromText(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const raw = String(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) {
    return null;
  }

  /*
   * Ưu tiên tỷ
   */
  const billionMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:tỷ|ty|tỉ|ti)(?![\p{L}])/u,
  );

  if (billionMatch) {
    const number = Number(
      billionMatch[1],
    );

    if (Number.isFinite(number)) {
      return Math.round(
        number * 1_000_000_000,
      );
    }
  }

  /*
   * Sau đó triệu / tr
   */
  const millionMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:triệu|tr)(?![\p{L}])/u,
  );

  if (millionMatch) {
    const number = Number(
      millionMatch[1],
    );

    if (Number.isFinite(number)) {
      return Math.round(
        number * 1_000_000,
      );
    }
  }

  /*
   * Một số tin có dạng:
   * 50m/tháng
   */
  const monthMillionMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*m\s*\/\s*th[aá]ng/,
  );

  if (monthMillionMatch) {
    const number = Number(
      monthMillionMatch[1],
    );

    if (Number.isFinite(number)) {
      return Math.round(
        number * 1_000_000,
      );
    }
  }

  return null;
}

/* =========================================================
 * DIỆN TÍCH
 * ======================================================= */

/**
 * Diện tích:
 *
 * "80m2"   -> 80
 * "80 m²"  -> 80
 * "300m2"  -> 300
 * "4x20"   -> 80
 */
function parseArea(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const raw = String(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/,/g, ".")
    .trim();

  if (!raw) {
    return null;
  }

  /*
   * Dạng 4x20
   */
  const dimension = raw.match(
    /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/,
  );

  if (dimension) {
    const width = Number(
      dimension[1],
    );

    const length = Number(
      dimension[2],
    );

    if (
      Number.isFinite(width) &&
      Number.isFinite(length)
    ) {
      return Math.round(
        width * length * 100,
      ) / 100;
    }
  }

  /*
   * Dạng 300m2 / 300m²
   */
  const areaMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:m2|m²|mét vuông)\b/,
  );

  if (areaMatch) {
    const result = Number(
      areaMatch[1],
    );

    if (Number.isFinite(result)) {
      return result;
    }
  }

  return null;
}

/**
 * Tìm diện tích trong toàn bộ nội dung tin.
 *
 * "300m2 trệt lầu 3pn 2wc"
 * -> 300
 *
 * Nếu không có m2 nhưng có:
 * "4x20 trệt lầu"
 * -> 80
 */
function parseAreaFromText(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const raw = String(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/,/g, ".")
    .trim();

  if (!raw) {
    return null;
  }

  /*
   * Ưu tiên diện tích có m2.
   */
  const areaMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*(?:m2|m²|mét vuông)\b/,
  );

  if (areaMatch) {
    const result = Number(
      areaMatch[1],
    );

    if (Number.isFinite(result)) {
      return result;
    }
  }

  /*
   * Nếu không có m2 thì tìm 4x20.
   */
  const dimensionMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/,
  );

  if (dimensionMatch) {
    const width = Number(
      dimensionMatch[1],
    );

    const length = Number(
      dimensionMatch[2],
    );

    if (
      Number.isFinite(width) &&
      Number.isFinite(length)
    ) {
      return Math.round(
        width * length * 100,
      ) / 100;
    }
  }

  return null;
}

/* =========================================================
 * KÍCH THƯỚC
 * ======================================================= */

function parseDimension(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const raw = String(value)
    .toLowerCase()
    .replace(/,/g, ".")
    .trim();

  if (!raw) {
    return null;
  }

  const match = raw.match(
    /(\d+(?:\.\d+)?)/,
  );

  if (!match) {
    return null;
  }

  const result = Number(
    match[1],
  );

  return Number.isFinite(result)
    ? result
    : null;
}

/**
 * Tìm 4x20 trong toàn bộ nội dung.
 */
function parseDimensionFromText(
  value: unknown,
): {
  width: number;
  length: number;
} | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const raw = String(value)
    .toLowerCase()
    .replace(/,/g, ".")
    .trim();

  if (!raw) {
    return null;
  }

  const match = raw.match(
    /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/,
  );

  if (!match) {
    return null;
  }

  const width = Number(
    match[1],
  );

  const length = Number(
    match[2],
  );

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(length)
  ) {
    return null;
  }

  return {
    width,
    length,
  };
}

/* =========================================================
 * INTEGER
 * ======================================================= */

function parseInteger(
  value: unknown,
): number | null {
  const number =
    parseDimension(value);

  if (number === null) {
    return null;
  }

  return Math.round(number);
}

/* =========================================================
 * TÌM PN / WC TRONG NỘI DUNG
 * ======================================================= */

function parseBedroomsFromText(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const raw = String(value)
    .toLowerCase()
    .trim();

  const match = raw.match(
    /(\d+)\s*(?:pn|phòng ngủ|phong ngu)\b/,
  );

  if (!match) {
    return null;
  }

  const result = Number(
    match[1],
  );

  return Number.isFinite(result)
    ? Math.round(result)
    : null;
}

function parseBathroomsFromText(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const raw = String(value)
    .toLowerCase()
    .trim();

  const match = raw.match(
    /(\d+)\s*(?:wc|phòng tắm|phong tam)\b/,
  );

  if (!match) {
    return null;
  }

  const result = Number(
    match[1],
  );

  return Number.isFinite(result)
    ? Math.round(result)
    : null;
}

/* =========================================================
 * AMENITIES
 * ======================================================= */

function parseAmenities(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        String(item).trim(),
      )
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n|]+/)
      .map((item) =>
        item.trim(),
      )
      .filter(Boolean);
  }

  return [];
}

/* =========================================================
 * MÔ TẢ NGẮN
 * ======================================================= */

function shortDescription(
  payload: Record<string, unknown>,
) {
  return [
    payload.alleyType,
    payload.street,
    payload.district,
    payload.structure,
  ]
    .filter(Boolean)
    .join(" - ");
}

/* =========================================================
 * ERROR
 * ======================================================= */

function getErrorDetails(
  error: unknown,
) {
  if (
    error &&
    typeof error === "object"
  ) {
    const e =
      error as Record<
        string,
        unknown
      >;

    return {
      message:
        typeof e.message === "string"
          ? e.message
          : null,

      details:
        typeof e.details === "string"
          ? e.details
          : null,

      hint:
        typeof e.hint === "string"
          ? e.hint
          : null,

      code:
        typeof e.code === "string"
          ? e.code
          : null,

      status:
        typeof e.status === "number"
          ? e.status
          : null,
    };
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : String(error),

    details: null,
    hint: null,
    code: null,
    status: null,
  };
}

/* =========================================================
 * GET
 * ======================================================= */

export async function GET(
  req: NextRequest,
) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    service:
      "khotinbds-folder-bot",
    target:
      "listing_library",
    syncTarget:
      "listing_library+listings",
  });
}

/* =========================================================
 * POST
 * ======================================================= */

export async function POST(
  req: NextRequest,
) {
  const uploadedPaths: string[] =
    [];

  let supabase:
    | ReturnType<typeof getSupabase>
    | null = null;

  let libraryId:
    | string
    | null = null;

  try {
    /* =====================================================
     * 0. AUTH
     * =================================================== */

    if (!authorized(req)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    if (!ownerUserId) {
      return NextResponse.json(
        {
          error:
            "Thiếu BOT_OWNER_USER_ID",
        },
        {
          status: 500,
        },
      );
    }

    supabase = getSupabase();

    /* =====================================================
     * 1. FORM DATA
     * =================================================== */

    const form =
      await req.formData();

    const payloadText =
      form.get("payload");

    if (
      typeof payloadText !==
      "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu payload",
        },
        {
          status: 400,
        },
      );
    }

    const payload =
      JSON.parse(
        payloadText,
      ) as Record<
        string,
        unknown
      >;

    const importHash =
      text(
        payload.importHash,
      );

    const images =
      form
        .getAll("images")
        .filter(
          (
            item,
          ): item is File =>
            item instanceof File,
        );

    if (!importHash) {
      return NextResponse.json(
        {
          error:
            "Thiếu importHash",
        },
        {
          status: 400,
        },
      );
    }

    if (!images.length) {
      return NextResponse.json(
        {
          error:
            "Thiếu ảnh",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
     * 2. KIỂM TRA DUPLICATE
     * =================================================== */

    const {
      data: existed,
      error: existsError,
    } = await supabase
      .from("listing_library")
      .select("id")
      .eq(
        "import_hash",
        importHash,
      )
      .maybeSingle();

    if (existsError) {
      throw existsError;
    }

    if (existed) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        id: existed.id,
      });
    }

    /* =====================================================
     * 3. UPLOAD ẢNH
     * =================================================== */

    const folder =
      `${ownerUserId}/${new Date()
        .toISOString()
        .slice(0, 10)}/${crypto.randomUUID()}`;

    const imageUrls: string[] =
      [];

    for (
      let index = 0;
      index < images.length;
      index += 1
    ) {
      const file =
        images[index];

      if (
        !file.type.startsWith(
          "image/",
        )
      ) {
        throw new Error(
          `File không phải ảnh: ${file.name}`,
        );
      }

      const objectPath =
        `${folder}/${String(
          index + 1,
        ).padStart(
          2,
          "0",
        )}-${safeName(
          file.name,
        )}`;

      const bytes =
        Buffer.from(
          await file.arrayBuffer(),
        );

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(bucket)
          .upload(
            objectPath,
            bytes,
            {
              contentType:
                file.type ||
                "image/jpeg",
              upsert: false,
            },
          );

      if (uploadError) {
        throw uploadError;
      }

      uploadedPaths.push(
        objectPath,
      );

      const { data } =
        supabase.storage
          .from(bucket)
          .getPublicUrl(
            objectPath,
          );

      imageUrls.push(
        data.publicUrl,
      );
    }

    /* =====================================================
     * 4. CHUẨN HÓA DỮ LIỆU CƠ BẢN
     * =================================================== */

    const title =
      text(payload.title) ||
      text(payload.headline) ||
      text(payload.street) ||
      "Tin bất động sản";

    const district =
      text(payload.district);

    const address =
      text(payload.address) ||
      text(payload.street);

    const street =
      text(payload.street);

    const structure =
      text(payload.structure);

    const phone =
      text(payload.phone) ||
      text(payload.contactPhone);

    const description =
      text(payload.description) ||
      text(payload.primaryContent) ||
      text(payload.primary_content) ||
      text(payload.rawInput) ||
      "";

    const sourceFolder =
      text(payload.sourceFolder);

    /*
     * Toàn bộ nội dung dùng làm nguồn fallback.
     *
     * Đây là phần QUAN TRỌNG để bắt được:
     *
     * 300m2
     * 4x20
     * 50tr
     * 3pn
     * 2wc
     *
     * kể cả khi bot parser không đưa chúng
     * vào field riêng.
     */
    const rawInput =
      text(payload.rawInput) ||
      text(payload.primaryContent) ||
      text(payload.primary_content) ||
      text(payload.description) ||
      "";

    const searchableText = [
      rawInput,
      text(payload.description),
      text(payload.primaryContent),
      text(payload.primary_content),
      text(payload.title),
      text(payload.headline),
      text(payload.address),
      text(payload.street),
      text(payload.structure),
      text(payload.price),
      text(payload.area),
    ]
      .filter(Boolean)
      .join(" ");

    const amenities =
      parseAmenities(
        payload.amenities,
      );

    /* =====================================================
     * 5. CHUẨN HÓA GIÁ
     * =================================================== */

    /*
     * Tìm giá có đơn vị trong nội dung trước.
     *
     * Ví dụ:
     *
     * "50tr hh1/2 0903718307"
     *
     * => 50,000,000
     *
     * Như vậy không thể lấy nhầm số "2"
     * từ "hh1/2".
     */
    const priceFromText =
      parsePriceFromText(
        searchableText,
      );

    const priceFromPayload =
      parseNumber(
        payload.price,
      );

    /*
     * Nếu nội dung có giá rõ ràng như 50tr,
     * ưu tiên giá đó.
     *
     * Nếu nội dung không có giá có đơn vị,
     * dùng payload.price.
     */
    const price =
      priceFromText ??
      priceFromPayload ??
      null;

    /* =====================================================
     * 6. CHUẨN HÓA DIỆN TÍCH
     * =================================================== */

    const areaFromPayload =
      parseArea(
        payload.area,
      );

    const areaFromText =
      parseAreaFromText(
        searchableText,
      );

    /*
     * Ưu tiên:
     *
     * 1. payload.area
     * 2. 300m2 trong nội dung
     * 3. tính từ 4x20
     */
    const area =
      areaFromPayload ??
      areaFromText ??
      null;

    /* =====================================================
     * 7. CHUẨN HÓA KÍCH THƯỚC
     * =================================================== */

    const dimensionFromText =
      parseDimensionFromText(
        searchableText,
      );

    const widthFromPayload =
      parseDimension(
        payload.width,
      );

    const lengthFromPayload =
      parseDimension(
        payload.length,
      );

    const width =
      widthFromPayload ??
      dimensionFromText?.width ??
      null;

    const length =
      lengthFromPayload ??
      dimensionFromText?.length ??
      null;

    /*
     * Nếu có 4x20 nhưng area chưa có,
     * tự tính 80m².
     *
     * Trường hợp có 300m2:
     * area vẫn giữ 300.
     */
    const finalArea =
      area ??
      (
        width !== null &&
        length !== null
          ? Math.round(
              width *
                length *
                100,
            ) / 100
          : null
      );

    /* =====================================================
     * 8. SỐ TẦNG / PN / WC
     * =================================================== */

    const floors =
      parseInteger(
        payload.floors,
      );

    const bedroomsFromPayload =
      parseInteger(
        payload.bedrooms,
      );

    const bathroomsFromPayload =
      parseInteger(
        payload.bathrooms,
      );

    const bedrooms =
      bedroomsFromPayload ??
      parseBedroomsFromText(
        searchableText,
      ) ??
      null;

    const bathrooms =
      bathroomsFromPayload ??
      parseBathroomsFromText(
        searchableText,
      ) ??
      null;

    /* =====================================================
     * LOG DỮ LIỆU ĐÃ CHUẨN HÓA
     * =================================================== */

    console.log(
      "[BOT] NORMALIZED LISTING:",
      JSON.stringify(
        {
          title,
          district,
          address,
          street,

          price,
          area: finalArea,

          width,
          length,

          floors,
          bedrooms,
          bathrooms,

          phone,
        },
        null,
        2,
      ),
    );

    /* =====================================================
     * 9. INSERT LISTING_LIBRARY
     * =================================================== */

    const libraryRow = {
      user_id:
        ownerUserId,

      raw_input:
        rawInput,

      title,

      primary_content:
        description,

      short_description:
        text(
          payload.shortDescription,
        ) ||
        shortDescription(
          payload,
        ),

      seo_description:
        text(
          payload.seoDescription,
        ) ||
        shortDescription(
          payload,
        ),

      phone,

      district,

      street,

      /*
       * Lưu GIÁ ĐÃ CHUẨN HÓA.
       *
       * 50tr => 50000000
       */
      price:
        price ?? null,

      /*
       * Lưu DIỆN TÍCH ĐÃ CHUẨN HÓA.
       *
       * 300m2 => 300
       * 4x20 => 80
       */
      area:
        finalArea ?? null,

      structure,

      images:
        imageUrls,

      source:
        "folder_bot",

      source_folder:
        sourceFolder,

      import_hash:
        importHash,

      status:
        text(
          payload.status,
        ) ||
        "pending",
    };

    console.log(
      "[BOT] INSERT LISTING_LIBRARY:",
      JSON.stringify(
        libraryRow,
        null,
        2,
      ),
    );

    const {
      data: libraryData,
      error: libraryError,
    } =
      await supabase
        .from(
          "listing_library",
        )
        .insert(
          libraryRow,
        )
        .select("id")
        .single();

    if (libraryError) {
      throw libraryError;
    }

    libraryId =
      libraryData.id;

    /* =====================================================
     * 10. INSERT LISTINGS
     *
     * WEBSITE CHÍNH ĐỌC BẢNG NÀY.
     * =================================================== */

    const listingRow = {
      title,

      district,

      address,

      /*
       * 50tr
       * =>
       * 50000000
       */
      price:
        price ?? 0,

      /*
       * 300m2
       * =>
       * 300
       *
       * hoặc:
       *
       * 4x20
       * =>
       * 80
       */
      area:
        finalArea ?? 0,

      /*
       * 4x20
       * =>
       * width = 4
       * length = 20
       */
      width:
        width ?? 0,

      length:
        length ?? 0,

      floors:
        floors ?? 0,

      bedrooms:
        bedrooms ?? 0,

      bathrooms:
        bathrooms ?? 0,

      furniture:
        text(
          payload.furniture,
        ) ||
        "Trống",

      amenities,

      contact_phone:
        phone,

      description,

      images:
        imageUrls,

      status:
        "available",
    };

    console.log(
      "[BOT] INSERT LISTINGS:",
      JSON.stringify(
        listingRow,
        null,
        2,
      ),
    );

    const {
      data: listingData,
      error: listingError,
    } =
      await supabase
        .from("listings")
        .insert(
          listingRow,
        )
        .select("id")
        .single();

    if (listingError) {
      console.error(
        "[BOT] LISTINGS INSERT ERROR:",
        getErrorDetails(
          listingError,
        ),
      );

      /*
       * XÓA listing_library nếu listings thất bại.
       */
      if (libraryId) {
        await supabase
          .from(
            "listing_library",
          )
          .delete()
          .eq(
            "id",
            libraryId,
          );
      }

      throw listingError;
    }

    /* =====================================================
     * 11. THÀNH CÔNG
     * =================================================== */

    return NextResponse.json({
      ok: true,

      libraryId:
        libraryData.id,

      listingId:
        listingData.id,

      images:
        imageUrls.length,

      synced: true,

      normalized: {
        price:
          price ?? null,

        area:
          finalArea ?? null,

        width:
          width ?? null,

        length:
          length ?? null,

        bedrooms:
          bedrooms ?? null,

        bathrooms:
          bathrooms ?? null,
      },
    });
  } catch (error) {
    const details =
      getErrorDetails(
        error,
      );

    console.error(
      "[BOT_IMPORT_ERROR]",
      details,
    );

    /* =====================================================
     * XÓA ẢNH NẾU DATABASE THẤT BẠI
     * =================================================== */

    if (
      uploadedPaths.length &&
      supabase
    ) {
      try {
        await supabase
          .storage
          .from(bucket)
          .remove(
            uploadedPaths,
          );
      } catch (
        cleanupError
      ) {
        console.error(
          "[BOT_IMAGE_CLEANUP_ERROR]",
          cleanupError,
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,

        error:
          details.message ||
          "Không xác định",

        code:
          details.code,

        details:
          details.details,

        hint:
          details.hint,
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
 * SAFE FILE NAME
 * ======================================================= */

function safeName(
  name: string,
) {
  return name
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    )
    .replace(
      /-+/g,
      "-",
    );
}
