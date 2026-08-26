/**
 * scripts/migrate-public-titles.ts
 *
 * MỤC ĐÍCH:
 * Tính lại `title` (publicTitle) cho TOÀN BỘ tin cũ trong bảng `listings`,
 * dựa trên `address` GỐC (không phải title cũ đã lưu sai do bug
 * addressSource = title || address trước đây).
 *
 * ⚠️ BẮT BUỘC LÀM TRƯỚC KHI CHẠY SCRIPT NÀY:
 * Phải áp dụng 2 fix đã thống nhất vào lib/publicListingFormatter.ts:
 *   1. addressSource = address || title   (KHÔNG phải title || address)
 *   2. hasAddressSlash() chỉ nhận diện "/" trong SỐ NHÀ ở đầu chuỗi,
 *      không phải "/" nằm bất kỳ đâu trong địa chỉ (vd "Đường 3/2").
 * Nếu chưa sửa 2 chỗ đó, script này sẽ chỉ tính lại ra y hệt kết quả sai cũ.
 *
 * CÁCH CHẠY:
 *   1. Cài tsx nếu chưa có:      npm install -D tsx
 *   2. Dry-run (XEM TRƯỚC, KHÔNG ghi DB):
 *        npx tsx scripts/migrate-public-titles.ts --dry-run
 *   3. Sau khi review file log JSON thấy ổn, chạy thật:
 *        npx tsx scripts/migrate-public-titles.ts --apply
 *
 * BIẾN MÔI TRƯỜNG CẦN CÓ (đọc từ .env.local hoặc export trước khi chạy):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (bắt buộc dùng service role để bypass RLS
 *                                khi update hàng loạt, KHÔNG dùng anon key)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { formatPublicListing } from "../lib/publicListingFormatter";
import * as fs from "fs";
import * as path from "path";

/* =========================================================
   CONFIG — chỉnh nếu tên cột/table khác
========================================================= */

const TABLE_NAME = "listings";

// Cột sẽ được GHI kết quả publicTitle mới vào.
// Đổi thành "public_title" (hoặc tên khác) nếu bảng của bạn có
// cột riêng cho title công khai thay vì dùng chung cột "title".
const TARGET_COLUMN = "title";

const BATCH_SIZE = 500;

const LOG_FILE = path.join(
  process.cwd(),
  `migrate-public-titles-log-${Date.now()}.json`,
);

/* =========================================================
   SUPABASE CLIENT (service role — bắt buộc để update hàng loạt)
========================================================= */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/* =========================================================
   ARGS
========================================================= */

const isApply = process.argv.includes("--apply");
const isDryRun = !isApply; // mặc định luôn là dry-run cho an toàn

/* =========================================================
   TYPES
========================================================= */

type ListingRow = {
  id: string;
  title: string | null;
  address: string | null;
  description: string | null;
  raw_input: string | null;
  price: number | string | null;
  structure: string | null;
  area: string | null;
  width: number | string | null;
  length: number | string | null;
  [key: string]: unknown;
};

type ChangeLogEntry = {
  id: string;
  address: string | null;
  old_title: string | null;
  new_title: string;
  changed: boolean;
};

/* =========================================================
   FETCH TOÀN BỘ LISTINGS (phân trang để tránh giới hạn 1000 dòng)
========================================================= */

async function fetchAllListings(): Promise<ListingRow[]> {
  const all: ListingRow[] = [];
  let from = 0;

  while (true) {
    const to = from + BATCH_SIZE - 1;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .range(from, to)
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Lỗi khi fetch listings (range ${from}-${to}): ${error.message}`);
    }

    if (!data || data.length === 0) break;

    all.push(...(data as ListingRow[]));

    if (data.length < BATCH_SIZE) break; // hết dữ liệu
    from += BATCH_SIZE;
  }

  return all;
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  console.log(`\n🔎 Chế độ: ${isDryRun ? "DRY-RUN (không ghi DB)" : "APPLY (SẼ GHI ĐÈ DB)"}\n`);

  console.log("📥 Đang tải toàn bộ listings...");
  const listings = await fetchAllListings();
  console.log(`✅ Tải xong ${listings.length} tin.\n`);

  const changeLog: ChangeLogEntry[] = [];
  let changedCount = 0;
  let errorCount = 0;

  for (const row of listings) {
    try {
      const result = formatPublicListing(row);
      const newTitle = result.publicTitle;
      const oldTitle = row[TARGET_COLUMN] as string | null;
      const changed = (oldTitle ?? "").trim() !== newTitle.trim();

      changeLog.push({
        id: row.id,
        address: row.address,
        old_title: oldTitle,
        new_title: newTitle,
        changed,
      });

      if (changed) {
        changedCount += 1;

        console.log(
          `${changed ? "🔧" : "  "} [${row.id}]\n   Cũ:  ${oldTitle}\n   Mới: ${newTitle}\n`,
        );

        if (isApply) {
          const { error: updateError } = await supabase
            .from(TABLE_NAME)
            .update({ [TARGET_COLUMN]: newTitle })
            .eq("id", row.id);

          if (updateError) {
            errorCount += 1;
            console.error(`   ❌ Update lỗi cho id=${row.id}: ${updateError.message}`);
          }
        }
      }
    } catch (err) {
      errorCount += 1;
      console.error(`❌ Lỗi xử lý id=${row.id}:`, err);
    }
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(changeLog, null, 2), "utf-8");

  console.log("\n========== TỔNG KẾT ==========");
  console.log(`Tổng số tin xét duyệt : ${listings.length}`);
  console.log(`Số tin cần đổi title  : ${changedCount}`);
  console.log(`Số lỗi                : ${errorCount}`);
  console.log(`Log chi tiết đã lưu   : ${LOG_FILE}`);

  if (isDryRun) {
    console.log(
      `\n👉 Đây là DRY-RUN, CHƯA ghi gì vào DB. Mở file log ở trên để review,` +
        ` sau đó chạy lại với flag --apply để ghi thật:\n` +
        `   npx tsx scripts/migrate-public-titles.ts --apply\n`,
    );
  } else {
    console.log(`\n✅ Đã ghi ${changedCount} thay đổi vào DB.\n`);
  }
}

main().catch((err) => {
  console.error("❌ Script thất bại:", err);
  process.exit(1);
});
