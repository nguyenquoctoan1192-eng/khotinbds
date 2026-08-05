import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { parseZaloListingText } from "@/lib/zaloListingParser";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.BOT_STORAGE_BUCKET ?? "image";

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function authorized(req: NextRequest) {
  const expected = process.env.BOT_SECRET;
  const supplied = req.headers.get("x-bot-secret");

  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:phuong|p)\.?\s*[\w-]+\b/g, " ")
    .replace(/\b(?:quan|q)\.?\s*/g, " q ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: unknown) {
  let phone = String(value ?? "").replace(/\D/g, "");

  if (phone.startsWith("84") && phone.length >= 11) {
    phone = `0${phone.slice(2)}`;
  }

  return phone;
}

function districtFromSourceFolder(sourceFolder: string | null) {
  const parent = String(sourceFolder ?? "")
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean)[0];

  if (!parent) return "";

  const normalized = normalizeText(parent);

  const namedDistricts: Array<[RegExp, string]> = [
    [/\bbinh tan\b/, "Quận Bình Tân"],
    [/\bbinh thanh\b/, "Quận Bình Thạnh"],
    [/\bphu nhuan\b/, "Quận Phú Nhuận"],
    [/\btan binh\b/, "Quận Tân Bình"],
    [/\btan phu\b/, "Quận Tân Phú"],
    [/\bgo vap\b/, "Quận Gò Vấp"],
    [/\bthu duc\b/, "Thành phố Thủ Đức"],
  ];

  for (const [pattern, district] of namedDistricts) {
    if (pattern.test(normalized)) return district;
  }

  const numericMatch =
    normalized.match(/\bq\s*(\d{1,2})\b/) ??
    normalized.match(/\bquan\s*(\d{1,2})\b/) ??
    normalized.match(/^(\d{1,2})$/);

  if (numericMatch) return `Quận ${Number(numericMatch[1])}`;

  return parent;
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = [
      value.message,
      value.details,
      value.hint,
      value.code ? `code=${value.code}` : null,
    ]
      .filter(Boolean)
      .map(String);

    if (parts.length) return parts.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error ?? "Lỗi không xác định");
}

function addressKey(address: unknown, district: unknown) {
  return `${normalizeText(address)}|${normalizeText(district)}`;
}

type ExistingListing = {
  id: string;
  address: string | null;
  district: string | null;
  contact_phone: string | null;
  import_hash: string | null;
  created_at: string | null;
};

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    service: "khotinbds-folder-bot",
    target: "listings",
    duplicateMode: "always-update-duplicate-with-latest-data",
    uploadBucket: bucket,
  });
}

export async function POST(req: NextRequest) {
  const uploadedPaths: string[] = [];

  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const formData = await req.formData();
    const payloadText = formData.get("payload");

    if (typeof payloadText !== "string") {
      return NextResponse.json({ error: "Thiếu payload" }, { status: 400 });
    }

    const inputPayload = JSON.parse(payloadText) as {
      rawInput?: string;
      sourceFolder?: string;
      importHash?: string;
    };

    const rawInput = String(inputPayload.rawInput ?? "").trim();
    const importHash = String(inputPayload.importHash ?? "").trim() || null;
    const sourceFolder =
      String(inputPayload.sourceFolder ?? "").trim() || null;

    if (!rawInput) {
      return NextResponse.json(
        { error: "Không có nội dung tin trong file TXT" },
        { status: 400 }
      );
    }

    const parsed = parseZaloListingText(rawInput);

    // Nếu parser chưa nhận dạng được quận, lấy từ tên thư mục cha.
    if (!parsed.district) {
      parsed.district = districtFromSourceFolder(sourceFolder);
    }

    if (!parsed.title || !parsed.price || !parsed.district) {
      return NextResponse.json(
        {
          error:
            "Không đọc đủ Tiêu đề, Giá hoặc Quận. Kiểm tra lại nội dung file TXT.",
          parsed,
        },
        { status: 400 }
      );
    }

    /*
     * LỚP 1: Nếu trùng import_hash thì vẫn xem đó là tin đã tồn tại
     * và tiếp tục cập nhật bằng dữ liệu mới nhất.
     */
    let sameHashListing: ExistingListing | null = null;

    if (importHash) {
      const { data: sameHash, error: sameHashError } = await supabase
        .from("listings")
        .select("id,address,district,contact_phone,import_hash,created_at")
        .eq("import_hash", importHash)
        .maybeSingle();

      if (sameHashError) throw sameHashError;

      sameHashListing = (sameHash as ExistingListing | null) ?? null;
    }

    /*
     * LỚP 2: Tìm căn đã có theo địa chỉ đã chuẩn hóa trong cùng quận.
     * Không dùng so sánh chính xác đơn thuần vì chữ hoa, dấu tiếng Việt,
     * dấu chấm và khoảng trắng có thể khác nhau.
     */
    const { data: districtListings, error: candidateError } = await supabase
      .from("listings")
      .select("id,address,district,contact_phone,import_hash,created_at")
      .eq("district", parsed.district)
      .limit(1000);

    if (candidateError) throw candidateError;

    const incomingAddressKey = addressKey(parsed.address, parsed.district);
    const incomingPhone = normalizePhone(parsed.phone);

    const candidates = (districtListings ?? []) as ExistingListing[];

    let existing =
      sameHashListing ??
      candidates.find(
        (item) =>
          incomingAddressKey !== "|" &&
          addressKey(item.address, item.district) === incomingAddressKey
      ) ?? null;

    /*
     * LỚP 3: Nếu cách ghi địa chỉ hơi khác, dùng số điện thoại +
     * phần địa chỉ tương đồng để nhận diện. Không dùng số điện thoại đơn lẻ
     * vì một môi giới có thể đăng nhiều căn.
     */
    if (!existing && incomingPhone && normalizeText(parsed.address).length >= 5) {
      const incomingAddress = normalizeText(parsed.address);

      existing =
        candidates.find((item) => {
          const oldPhone = normalizePhone(item.contact_phone);
          const oldAddress = normalizeText(item.address);

          if (!oldPhone || oldPhone !== incomingPhone || !oldAddress) {
            return false;
          }

          return (
            oldAddress.includes(incomingAddress) ||
            incomingAddress.includes(oldAddress)
          );
        }) ?? null;
    }

    const imageFiles = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File);

    if (!imageFiles.length) {
      return NextResponse.json(
        { error: "Thư mục chưa có ảnh" },
        { status: 400 }
      );
    }

    const uploadFolder = [
      "folder-bot",
      new Date().toISOString().slice(0, 10),
      crypto.randomUUID(),
    ].join("/");

    const imageUrls: string[] = [];

    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index];

      if (!file.type.startsWith("image/")) {
        throw new Error(`File không phải hình ảnh: ${file.name}`);
      }

      const fileName =
        `${String(index + 1).padStart(2, "0")}-` +
        `${safeFileName(file.name) || "image.jpg"}`;

      const objectPath = `${uploadFolder}/${fileName}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, bytes, {
          contentType: file.type || "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(objectPath);

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(objectPath);

      imageUrls.push(publicUrlData.publicUrl);
    }

    const now = new Date().toISOString();

    const listingPayload = {
      title: parsed.title,
      district: parsed.district,
      address: parsed.address,

      price: numberValue(parsed.price),
      area: numberValue(parsed.area),
      width: numberValue(parsed.width),
      length: numberValue(parsed.length),
      floors: numberValue(parsed.floors),

      bedrooms: numberValue(parsed.bedrooms),
      bathrooms: numberValue(parsed.bathrooms),

      furniture: parsed.furnishing || "Trống",
      amenities: [],

      contact_phone: parsed.phone || "",
      description: parsed.description || rawInput,
      images: imageUrls,

      source: "folder-bot",
      source_folder: sourceFolder,
      import_hash: importHash,
      updated_at: now,
    };

    if (existing) {
      /*
       * Cùng căn: cập nhật bản ghi cũ, không xóa rồi tạo lại.
       * Nhờ vậy id và ngày tạo ban đầu được giữ nguyên.
       */
      const { data, error: updateError } = await supabase
        .from("listings")
        .update(listingPayload)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        ok: true,
        action: "updated_existing",
        id: data.id,
        target: "listings",
        reason: sameHashListing ? "same_import_hash_updated" : "same_normalized_address",
        sourceFolder,
        images: imageUrls.length,
      });
    }

    const { data, error: insertError } = await supabase
      .from("listings")
      .insert([
        {
          ...listingPayload,
          created_at: now,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      action: "created_new",
      id: data.id,
      target: "listings",
      sourceFolder,
      images: imageUrls.length,
    });
  } catch (error) {
    const message = readableError(error);
    console.error("BOT_IMPORT_LISTING_ERROR", message, error);

    if (uploadedPaths.length && supabaseUrl && serviceKey) {
      try {
        await getSupabase().storage.from(bucket).remove(uploadedPaths);
      } catch (cleanupError) {
        console.error(
          "BOT_IMAGE_CLEANUP_ERROR",
          readableError(cleanupError),
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
