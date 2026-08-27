"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import SiteNavbar from "@/app/components/site-navbar";
import { useUserRole } from "@/lib/userRole";
import RoleGate from "@/app/components/role-gate";

type ListingLibraryItem = {
  id: string;
  raw_input: string | null;
  title: string | null;
  primary_content: string;
  chotot_title: string | null;
  facebook_title: string | null;
  short_description: string | null;
  seo_description: string | null;
  phone: string | null;
  district: string | null;
  street: string | null;
  price: string | null;
  area: string | null;
  structure: string | null;
  created_at: string | null;
};

type LibraryResponse = {
  success: boolean;
  items: ListingLibraryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
};

const pageSize = 20;

/* ============================================================
   FORMAT DATE
============================================================ */

const formatDate = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("vi-VN");
};

/* ============================================================
   CHUẨN HÓA QUẬN
============================================================ */

const normalizeDistrict = (value: string | null): string => {
  if (!value) return "";

  let result = value
    .replace(/\s+/g, " ")
    .trim();

  result = result
    .replace(/^Q\.?\s*/i, "Quận ")
    .replace(/^Quận\s*/i, "Quận ")
    .replace(/^TP\.?\s*Thủ\s*Đức$/i, "Thành phố Thủ Đức");

  return result.trim();
};

/* ============================================================
   KIỂM TRA DÒNG CÓ PHẢI GIÁ
============================================================ */

const isPriceOnlyLine = (line: string): boolean => {
  const value = line.trim();

  return /^\d+(?:[.,]\d+)?\s*(tr|triệu|tỷ|ty)\b/i.test(value);
};

/* ============================================================
   KIỂM TRA DÒNG CÓ PHẢI KÍCH THƯỚC
============================================================ */

const isSizeOnlyLine = (line: string): boolean => {
  const value = line.trim();

  return /^\d+(?:[.,]\d+)?\s*x\s*\d+/i.test(value);
};

/* ============================================================
   KIỂM TRA DÒNG CÓ PHẢI SỐ ĐIỆN THOẠI
============================================================ */

const isPhoneOnlyLine = (line: string): boolean => {
  const digits = line.replace(/\D/g, "");

  return /^(?:0\d{8,10}|84\d{8,10})$/.test(digits);
};

/* ============================================================
   KIỂM TRA DẠNG SỐ NHÀ / HẺM

   Ví dụ:
   83/3 Nguyễn Hữu Tiến
   12/5A Lũy Bán Bích
   123/45 Nguyễn Trãi

   => TRUE

============================================================ */

const hasHouseNumberSlash = (address: string): boolean => {
  return /^\s*\d+[A-Za-z]?\s*(?:\/\s*\d+[A-Za-z]?)+(?:\s+|$)/i.test(
    address
  );
};

/* ============================================================
   XÁC ĐỊNH LOẠI VỊ TRÍ

   THỨ TỰ ƯU TIÊN:

   2MT
   2MB trước sau
   2MB
   Góc
   MT
   MB
   HXH
   HXT
   HXM
   H3G
   số nhà dạng 83/3 => Hẻm

   Không có gì => ""

============================================================ */

const detectLocationType = (
  address: string
): string => {
  const value = address.trim();

  /*
   * ==========================================================
   * SỐ NHÀ / HẺM
   *
   * Phải kiểm tra TRƯỚC MT / MB.
   *
   * 83/3 Nguyễn Hữu Tiến
   * 12/5/7 Lũy Bán Bích
   * 175/50/21 Ni Sư Huỳnh Liên
   *
   * => Hẻm
   * ==========================================================
   */
  if (hasHouseNumberSlash(value)) {
    return "Hẻm";
  }

  /*
   * ==========================================================
   * HAI MẶT TIỀN
   * ==========================================================
   */
  if (/\b2\s*MT\b/i.test(value)) {
    return "Hai Mặt Tiền";
  }

  /*
   * ==========================================================
   * HAI MẶT BẰNG TRƯỚC SAU
   * ==========================================================
   */
  if (
    /\b2\s*MB\s*(?:trước\s*sau|truoc\s*sau)\b/i.test(
      value
    )
  ) {
    return "Hai Mặt Bằng Trước Sau";
  }

  /*
   * ==========================================================
   * HAI MẶT BẰNG
   * ==========================================================
   */
  if (/\b2\s*MB\b/i.test(value)) {
    return "Hai Mặt Bằng";
  }

  /*
   * ==========================================================
   * GÓC
   * ==========================================================
   */
  if (/\bGóc\b/i.test(value)) {
    return "Góc";
  }

  /*
   * ==========================================================
   * MẶT TIỀN
   * ==========================================================
   */
  if (/\bMT\b/i.test(value)) {
    return "Mặt Tiền";
  }

  /*
   * ==========================================================
   * MẶT BẰNG
   * ==========================================================
   */
  if (/\bMB\b/i.test(value)) {
    return "Mặt Bằng";
  }

  /*
   * ==========================================================
   * HẺM XE HƠI
   * ==========================================================
   */
  if (/\bHXH\b/i.test(value)) {
    return "Hẻm Xe Hơi";
  }

  /*
   * ==========================================================
   * HẺM XE TẢI
   * ==========================================================
   */
  if (/\bHXT\b/i.test(value)) {
    return "Hẻm Xe Tải";
  }

  /*
   * ==========================================================
   * HẺM XE MÁY
   * ==========================================================
   */
  if (/\bHXM\b/i.test(value)) {
    return "Hẻm Xe Máy";
  }

  /*
   * ==========================================================
   * HẺM BA GÁC
   * ==========================================================
   */
  if (/\bH3G\b/i.test(value)) {
    return "Hẻm Ba Gác";
  }

  /*
   * Không có keyword vị trí.
   */
  return "";
};

/* ============================================================
   XÓA KEYWORD VỊ TRÍ KHỎI ĐỊA CHỈ
============================================================ */

const cleanLocationKeywords = (address: string): string => {
  return address
    .replace(
      /\b2\s*MB\s*(trước\s*sau|truoc\s*sau)\b/gi,
      ""
    )
    .replace(/\b2\s*MT\b/gi, "")
    .replace(/\b2\s*MB\b/gi, "")
    .replace(/\bHXH\b/gi, "")
    .replace(/\bHXT\b/gi, "")
    .replace(/\bHXM\b/gi, "")
    .replace(/\bH3G\b/gi, "")
    .replace(/\bMT\b/gi, "")
    .replace(/\bMB\b/gi, "")
    .replace(/\bGóc\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/* ============================================================
   BỎ SỐ NHÀ

   83/3 Nguyễn Hữu Tiến
   => Nguyễn Hữu Tiến

   180 Hồng Bàng
   => Hồng Bàng

============================================================ */

const removeHouseNumber = (address: string): string => {
  return address
    .replace(/^\s*\d+\s*\/\s*\d+[A-Za-z]?\s+/i, "")
    .replace(/^\s*\d+\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

/* ============================================================
   CHUẨN HÓA ĐỊA CHỈ
============================================================ */

const normalizeAddress = (address: string): string => {
  return address
    .replace(/\bQ\.?\s*/gi, "Quận ")
    .replace(/\bTP\.?\s*Thủ\s*Đức\b/gi, "Thành phố Thủ Đức")
    .replace(/\bP\.?\s*/gi, "P. ")
    .replace(/\s+/g, " ")
    .trim();
};

/* ============================================================
   TÌM QUẬN TRONG CHUỖI
============================================================ */

const containsDistrict = (address: string): boolean => {
  const value = address.trim();

  if (/\bQuận\s+\d+\b/i.test(value)) {
    return true;
  }

  if (/\bQuận\s+[A-Za-zÀ-ỹĐđ]+(?:\s+[A-Za-zÀ-ỹĐđ]+)*$/i.test(value)) {
    return true;
  }

  if (/\bThành phố Thủ Đức\b/i.test(value)) {
    return true;
  }

  return false;
};

/* ============================================================
   LẤY DÒNG ĐỊA CHỈ

   KHÔNG lấy:
   - giá
   - diện tích
   - số điện thoại

   Đặc biệt:
   - ưu tiên dòng có dạng số nhà / đường
   - nếu không có thì lấy dòng đầu tiên hợp lệ

============================================================ */

const getAddressSource = (
  item: ListingLibraryItem
): string => {
  const raw = item.raw_input?.trim() || "";

  if (!raw) {
    return item.street?.trim() || "";
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return item.street?.trim() || "";
  }

  /*
   * ƯU TIÊN 1:
   * Dòng có dạng số nhà/hẻm.
   *
   * 83/3 Nguyễn Hữu Tiến
   * 12/5 Lũy Bán Bích
   */
  const houseSlashLine = lines.find((line) =>
    hasHouseNumberSlash(line)
  );

  if (houseSlashLine) {
    return houseSlashLine;
  }

  /*
   * ƯU TIÊN 2:
   * Dòng có keyword vị trí.
   */
  const locationKeywordLine = lines.find((line) =>
    /\b(?:2\s*MT|2\s*MB|MT|MB|HXH|HXT|HXM|H3G|Góc)\b/i.test(
      line
    )
  );

  if (locationKeywordLine) {
    return locationKeywordLine;
  }

  /*
   * ƯU TIÊN 3:
   * Dòng có Q./Quận/P.
   */
  const districtLine = lines.find((line) =>
    /\b(?:Q\.?\s*\d+|Quận\s+\d+|P\.?\s*\d+)\b/i.test(
      line
    )
  );

  if (districtLine) {
    return districtLine;
  }

  /*
   * CUỐI CÙNG:
   * Lấy dòng đầu tiên không phải giá,
   * diện tích, điện thoại.
   */
  const normalLine = lines.find((line) => {
    if (isPriceOnlyLine(line)) {
      return false;
    }

    if (isSizeOnlyLine(line)) {
      return false;
    }

    if (isPhoneOnlyLine(line)) {
      return false;
    }

    return true;
  });

  return normalLine || item.street?.trim() || "";
};

/* ============================================================
   BUILD TIÊU ĐỀ KHO TIN

   QUY TẮC:

   83/3 Nguyễn Hữu Tiến Q.Tân Phú
   =>
   Hẻm - Nguyễn Hữu Tiến Quận Tân Phú

   Nguyễn Hữu Tiến MT Q.Tân Phú
   =>
   Mặt Tiền - Nguyễn Hữu Tiến Quận Tân Phú

   Nguyễn Hữu Tiến MB Q.Tân Phú
   =>
   Mặt Bằng - Nguyễn Hữu Tiến Quận Tân Phú

   Nguyễn Hữu Tiến Q.Tân Phú
   =>
   Nguyễn Hữu Tiến Quận Tân Phú

============================================================ */

const buildAdminListingTitle = (
  item: ListingLibraryItem
): string => {
  const source = getAddressSource(item);

  console.log("========== DEBUG TITLE ==========");
  console.log("ID:", item.id);
  console.log("RAW_INPUT:", item.raw_input);
  console.log("STREET:", item.street);
  console.log("TITLE:", item.title);
  console.log("ADDRESS SOURCE:", source);
  console.log(
    "HAS HOUSE SLASH:",
    hasHouseNumberSlash(source)
  );
  console.log(
    "DETECT LOCATION:",
    detectLocationType(source)
  );
  console.log("=================================");

  /*
   * Các phần code phía dưới
   * giữ nguyên từ code hiện tại của bạn.
   */
  

  if (!source) {
    return (
      item.street ||
      item.title ||
      item.chotot_title ||
      item.facebook_title ||
      "Tin đã lưu"
    );
  }

  /*
   * CHUẨN HÓA INPUT
   */
  const address = source
    .replace(/\s+/g, " ")
    .trim();

  /*
   * ==========================================================
   * XÁC ĐỊNH LOẠI VỊ TRÍ
   * ==========================================================
   *
   * QUAN TRỌNG:
   *
   * Nếu địa chỉ có dạng:
   *
   *   83/3 Nguyễn Hữu Tiến
   *   12/5/7 Lũy Bán Bích
   *   175/50/21 Ni Sư Huỳnh Liên
   *   440/51 Nguyễn Kiệm
   *
   * thì LUÔN là Hẻm.
   *
   * Không cho MT/MB ở phần khác của tin đăng
   * ảnh hưởng đến kết quả.
   */

  const isHouseSlashAddress =
    hasHouseNumberSlash(address);

  const locationType = isHouseSlashAddress
    ? "Hẻm"
    : detectLocationType(address);

  /*
   * ==========================================================
   * XÓA KEYWORD VỊ TRÍ
   * ==========================================================
   */
  let cleanAddress =
    cleanLocationKeywords(address);

  /*
   * ==========================================================
   * BỎ SỐ NHÀ
   *
   * 83/3 Nguyễn Hữu Tiến
   * =>
   * Nguyễn Hữu Tiến
   *
   * 175/50/21 Ni Sư Huỳnh Liên
   * =>
   * Ni Sư Huỳnh Liên
   * ==========================================================
   */
  cleanAddress =
    removeHouseNumber(cleanAddress);

  /*
   * ==========================================================
   * CHUẨN HÓA QUẬN / P.
   * ==========================================================
   */
  cleanAddress =
    normalizeAddress(cleanAddress);

  /*
   * ==========================================================
   * LẤY QUẬN TỪ DATABASE
   * ==========================================================
   */
  const districtText =
    normalizeDistrict(item.district);

  /*
   * Nếu địa chỉ chưa có quận,
   * lấy quận từ database.
   */
  if (
    districtText &&
    !containsDistrict(cleanAddress)
  ) {
    cleanAddress =
      `${cleanAddress} ${districtText}`.trim();
  }

  /*
   * ==========================================================
   * DỌN CHUỖI
   * ==========================================================
   */
  cleanAddress = cleanAddress
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();

  /*
   * ==========================================================
   * NẾU KHÔNG CÒN ĐỊA CHỈ
   * ==========================================================
   */
  if (!cleanAddress) {
    return (
      locationType ||
      item.street ||
      item.title ||
      "Tin đã lưu"
    );
  }

  /*
   * ==========================================================
   * GHÉP TIÊU ĐỀ
   *
   * Hẻm - Nguyễn Hữu Tiến - Quận Tân Phú
   *
   * Mặt Tiền - Nguyễn Hữu Tiến - Quận Tân Phú
   * ==========================================================
   */
  return [
    locationType,
    cleanAddress,
  ]
    .filter(Boolean)
    .join(" - ");
};

/* ============================================================
   COMPONENT
============================================================ */

function ListingLibraryContent({
  mode,
}: {
  mode: "admin" | "agent";
}) {
  const router = useRouter();

  const { role, roleLoading } = useUserRole();

  const canAccessLibrary =
    role === "admin" || role === "agent";

  const canManageLibrary =
    role === "admin";

  const [items, setItems] =
    useState<ListingLibraryItem[]>([]);

  const [search, setSearch] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [selectedItem, setSelectedItem] =
    useState<ListingLibraryItem | null>(null);

  const canGoPrevious =
    page > 1;

  const canGoNext =
    page < totalPages;

  const resultLabel = useMemo(
    () =>
      `${total.toLocaleString("vi-VN")} tin`,
    [total]
  );

  /* ============================================================
     FETCH
  ============================================================ */

  const fetchItems = async () => {
    setLoading(true);
    setMessage("");

    try {
      const params =
        new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });

      if (appliedSearch.trim()) {
        params.set(
          "search",
          appliedSearch.trim()
        );
      }

      const res = await fetch(
        `/api/listing-library?${params.toString()}`
      );

      const json =
        (await res.json()) as LibraryResponse;

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
            "Không tải được kho tin đăng"
        );
      }

      setItems(json.items || []);
      setTotal(json.total || 0);
      setTotalPages(
        json.totalPages || 1
      );
    } catch (error) {
      console.error(
        "Không tải được kho tin đăng:",
        error
      );

      setItems([]);
      setTotal(0);
      setTotalPages(1);

      setMessage(
        error instanceof Error
          ? error.message
          : "Không tải được kho tin đăng."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      roleLoading ||
      !canAccessLibrary
    ) {
      return;
    }

    fetchItems();
  }, [
    page,
    appliedSearch,
    roleLoading,
    canAccessLibrary,
  ]);

  /* ============================================================
     COPY
  ============================================================ */

  const copyText = async (
    value: string | null
  ) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );

      setMessage("Đã copy.");
    } catch (error) {
      console.error(error);

      setMessage(
        "Chưa copy được, bạn copy thủ công nhé."
      );
    }
  };

  /* ============================================================
     DELETE
  ============================================================ */

  const deleteItem = async (
    item: ListingLibraryItem
  ) => {
    if (
      !confirm(
        "Xóa tin này khỏi kho tin đăng?"
      )
    ) {
      return;
    }

    setMessage("");

    try {
      const res = await fetch(
        `/api/listing-library/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error ||
            "Không xóa được tin"
        );
      }

      setSelectedItem(null);
      setMessage("Đã xóa tin.");

      fetchItems();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Chưa xóa được tin."
      );
    }
  };

  /* ============================================================
     SEARCH
  ============================================================ */

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search);
  };

  /* ============================================================
     ROLE LOADING
  ============================================================ */

  if (roleLoading) {
    return (
      <div style={{ padding: 20 }}>
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!canAccessLibrary) {
    return (
      <>
        <SiteNavbar />

        <div style={{ padding: 20 }}>
          Kho tin đăng chỉ dành cho quản trị
          viên và môi giới.
        </div>
      </>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>
      <SiteNavbar />

      <main style={styles.page}>
        <section style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Kho tin đăng
            </h1>

            <p style={styles.subtitle}>
              Lưu và dùng lại nội dung AI đã tạo.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/post")
            }
            style={styles.primaryButton}
          >
            Tạo tin mới
          </button>
        </section>

        <section style={styles.toolbar}>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applySearch();
              }
            }}
            placeholder="Tìm theo đường, quận, SĐT, tiêu đề..."
            style={styles.searchInput}
          />

          <button
            type="button"
            onClick={applySearch}
            style={styles.searchButton}
          >
            Tìm kiếm
          </button>
        </section>

        <div style={styles.metaRow}>
          <span>{resultLabel}</span>

          <span>
            Trang {page}/{totalPages}
          </span>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {loading ? (
          <p>Đang tải...</p>
        ) : items.length === 0 ? (
          <p>Không có tin phù hợp.</p>
        ) : (
          <section style={styles.list}>
            {items.map((item) => {
              const displayTitle =
                buildAdminListingTitle(item);

              return (
                <article
                  key={item.id}
                  style={styles.card}
                >
                  <div style={styles.cardMain}>
                    <h2
                      style={styles.cardTitle}
                    >
                      {displayTitle}
                    </h2>

                    <p
                      style={styles.cardMeta}
                    >
                      {[
                        item.street,
                        item.district,
                        item.price,
                        item.phone,
                      ]
                        .filter(Boolean)
                        .join(" ⬢ ")}
                    </p>

                    <p
                      style={styles.preview}
                    >
                      {item.primary_content}
                    </p>

                    <p style={styles.date}>
                      {formatDate(
                        item.created_at
                      )}
                    </p>
                  </div>

                  <div style={styles.actions}>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          item.primary_content
                        )
                      }
                      style={styles.smallButton}
                    >
                      Copy nội dung
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          displayTitle
                        )
                      }
                      style={styles.smallButton}
                    >
                      Copy tiêu đề
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedItem(item)
                      }
                      style={styles.smallButton}
                    >
                      Xem chi tiết
                    </button>

                    {canManageLibrary && (
                      <button
                        type="button"
                        onClick={() =>
                          deleteItem(item)
                        }
                        style={styles.deleteButton}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section style={styles.pagination}>
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(
                  1,
                  current - 1
                )
              )
            }
            disabled={!canGoPrevious}
            style={
              canGoPrevious
                ? styles.pageButton
                : styles.disabledButton
            }
          >
            Trang trước
          </button>

          <button
            type="button"
            onClick={() =>
              setPage(
                (current) =>
                  current + 1
              )
            }
            disabled={!canGoNext}
            style={
              canGoNext
                ? styles.pageButton
                : styles.disabledButton
            }
          >
            Trang sau
          </button>
        </section>

        {selectedItem && (
          <div
            style={styles.modalBackdrop}
            onClick={() =>
              setSelectedItem(null)
            }
          >
            <section
              style={styles.modal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div
                style={styles.modalHeader}
              >
                <h2
                  style={styles.modalTitle}
                >
                  Chi tiết tin
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedItem(null)
                  }
                  style={styles.closeButton}
                >
                  Đóng
                </button>
              </div>

              <Detail
                label="Tiêu đề hiển thị"
                value={buildAdminListingTitle(
                  selectedItem
                )}
                onCopy={copyText}
              />

              <Detail
                label="Nội dung chia sẻ"
                value={
                  selectedItem.primary_content
                }
                onCopy={copyText}
              />

              <Detail
                label="Tiêu đề Chợ Tốt"
                value={
                  selectedItem.chotot_title
                }
                onCopy={copyText}
              />

              <Detail
                label="Tiêu đề Facebook"
                value={
                  selectedItem.facebook_title
                }
                onCopy={copyText}
              />

              <Detail
                label="Mô tả ngắn"
                value={
                  selectedItem.short_description
                }
                onCopy={copyText}
              />

              <Detail
                label="SEO description"
                value={
                  selectedItem.seo_description
                }
                onCopy={copyText}
              />
            </section>
          </div>
        )}
      </main>
    </>
  );
}

/* ============================================================
   PAGE
============================================================ */

type ListingLibraryPageProps = {
  mode: "admin" | "agent";
};

export default function ListingLibraryPage({
  mode,
}: ListingLibraryPageProps) {
  return (
    <RoleGate
      allowedRoles={[
        "admin",
        "agent",
      ]}
    >
      <ListingLibraryContent
        mode={mode}
      />
    </RoleGate>
  );
}

/* ============================================================
   DETAIL
============================================================ */

function Detail({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string | null;
  onCopy: (
    value: string | null
  ) => void;
}) {
  if (!value) {
    return null;
  }

  return (
    <div style={styles.detailBlock}>
      <div style={styles.detailHeader}>
        <strong>{label}</strong>

        <button
          type="button"
          onClick={() =>
            onCopy(value)
          }
          style={styles.smallButton}
        >
          Copy
        </button>
      </div>

      <pre style={styles.detailText}>
        {value}
      </pre>
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: 24,
    fontFamily:
      "var(--font-inter), Inter, Arial, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    margin: 0,
    fontSize: 28,
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  primaryButton: {
    background: "#0f766e",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    padding: "11px 14px",
  },

  toolbar: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },

  searchInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    flex: 1,
    fontSize: 15,
    padding: 12,
  },

  searchButton: {
    background: "#2563eb",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    padding: "0 16px",
  },

  metaRow: {
    color: "#475569",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  message: {
    background: "#ecfeff",
    border: "1px solid #67e8f9",
    borderRadius: 8,
    color: "#155e75",
    marginBottom: 12,
    padding: 10,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    display: "grid",
    gap: 12,
    gridTemplateColumns:
      "minmax(0, 1fr) auto",
    padding: 14,
  },

  cardMain: {
    minWidth: 0,
  },

  cardTitle: {
    fontSize: 18,
    margin: "0 0 6px",
  },

  cardMeta: {
    color: "#475569",
    margin: "0 0 8px",
  },

  preview: {
    color: "#111827",
    margin: 0,
    maxHeight: 72,
    overflow: "hidden",
    whiteSpace: "pre-line",
  },

  date: {
    color: "#94a3b8",
    fontSize: 13,
    margin: "8px 0 0",
  },

  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 132,
  },

  smallButton: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 10px",
  },

  deleteButton: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    color: "#b91c1c",
    cursor: "pointer",
    padding: "8px 10px",
  },

  pagination: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginTop: 20,
  },

  pageButton: {
    background: "#111827",
    border: "none",
    borderRadius: 8,
    color: "white",
    cursor: "pointer",
    padding: "10px 14px",
  },

  disabledButton: {
    background: "#e2e8f0",
    border: "none",
    borderRadius: 8,
    color: "#94a3b8",
    cursor: "not-allowed",
    padding: "10px 14px",
  },

  modalBackdrop: {
    alignItems: "center",
    background:
      "rgba(15, 23, 42, 0.5)",
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    left: 0,
    padding: 16,
    position: "fixed",
    right: 0,
    top: 0,
    zIndex: 50,
  },

  modal: {
    background: "white",
    borderRadius: 8,
    maxHeight: "88vh",
    maxWidth: 760,
    overflow: "auto",
    padding: 18,
    width: "100%",
  },

  modalHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalTitle: {
    margin: 0,
  },

  closeButton: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 10px",
  },

  detailBlock: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 12,
    marginTop: 12,
  },

  detailHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },

  detailText: {
    background: "#f8fafc",
    borderRadius: 8,
    fontFamily: "inherit",
    lineHeight: 1.5,
    marginBottom: 0,
    overflow: "auto",
    padding: 12,
    whiteSpace: "pre-wrap",
  },
};