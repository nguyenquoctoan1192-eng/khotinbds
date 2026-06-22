"use client";

import {
  type DragEvent,
  useEffect,
  useState,
} from "react";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  useParams,
  useRouter,
} from "next/navigation";
import { useUserRole } from "@/lib/userRole";
import RoleGate from "@/app/components/role-gate";

const supabase = createClient(
  process.env
    .NEXT_PUBLIC_SUPABASE_URL || "",
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type ImageEnhanceOptions = {
  removeLogo: boolean;
  removePhone: boolean;
  removeAddress: boolean;
  enhanceQuality: boolean;
  removeObjects: boolean;
};

type ImageEnhanceState = {
  index: number;
  imageUrl: string;
  options: ImageEnhanceOptions;
  loading: boolean;
  message: string;
  enhancedImageUrl: string;
};

type ListingStatus = "available" | "rented";

const defaultEnhanceOptions = (): ImageEnhanceOptions => ({
  removeLogo: false,
  removePhone: false,
  removeAddress: false,
  enhanceQuality: true,
  removeObjects: false,
});

function EditContent() {
  const router = useRouter();
  const { role, roleLoading } = useUserRole();

  const params = useParams();
  const id = Array.isArray(params?.id)
  ? params.id[0]
  : params?.id;

  console.log("PARAMS =", params);
  console.log("ID =", id);
  
  const [loading, setLoading] =
    useState(false);

  const [status, setStatus] =
    useState<ListingStatus>("available");

  const [statusLoading, setStatusLoading] =
    useState(false);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [uploading, setUploading] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [price, setPrice] =
    useState("");

  const [district, setDistrict] =
    useState("");

  const [address, setAddress] =
  useState("");

const [area, setArea] =
  useState("");

const [width, setWidth] =
  useState("");

const [length, setLength] =
  useState("");

const [floors, setFloors] =
  useState("");

const [furniture, setFurniture] =
  useState("Trống");

const [contactPhone, setContactPhone] =
  useState("");

const [amenities, setAmenities] =
  useState<string[]>([]);  

  const [bedrooms, setBedrooms] =
    useState("");

  const [bathrooms, setBathrooms] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [images, setImages] =
    useState<string[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] =
    useState<number | null>(null);

  const [imageEnhance, setImageEnhance] =
    useState<ImageEnhanceState | null>(null);

  // LOAD DATA
 useEffect(() => {
  if (!id || roleLoading || role !== "admin") return;
  fetchData();
}, [id, role, roleLoading]);

  const fetchData = async () => {
  if (!id) return;

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    alert("Không load được dữ liệu");
    return;
  }

  setTitle(data.title || "");
  setPrice(String(data.price || ""));
  setDistrict(data.district || "");
  setAddress(data.address || "");
  setArea(String(data.area || ""));
  setWidth(String(data.width || ""));
  setLength(String(data.length || ""));
  setFloors(String(data.floors || ""));
  setFurniture(data.furniture || "Trống");
  setContactPhone(data.contact_phone || "");
  setAmenities(data.amenities || []);
  setBedrooms(String(data.bedrooms || ""));
  setBathrooms(String(data.bathrooms || ""));
  setDescription(data.description || "");
  setImages(data.images || []);
  setStatus(data.status === "rented" ? "rented" : "available");
};

  // UPLOAD IMAGES
  const uploadImages = async (
    files: FileList | null
  ) => {
    if (!files) return;

    setUploading(true);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const fileName = `${Date.now()}-${file.name}`;

      const { error } =
        await supabase.storage
          .from("image")
          .upload(fileName, file);

      if (error) {
        console.error(error);
        continue;
      }

      const { data } = supabase.storage
        .from("image")
        .getPublicUrl(fileName);

      uploadedUrls.push(
        data.publicUrl
      );
    }

    setImages((prev) => [
      ...prev,
      ...uploadedUrls,
    ]);

    setUploading(false);
  };

  // REMOVE IMAGE
  const removeImage = (
    index: number
  ) => {
    const newImages = [...images];

    newImages.splice(index, 1);

    setImages(newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImages((current) => {
      if (toIndex < 0 || toIndex >= current.length) {
        return current;
      }

      const nextImages = [...current];
      const [movedImage] = nextImages.splice(fromIndex, 1);
      nextImages.splice(toIndex, 0, movedImage);

      return nextImages;
    });
  };

  const handleImageDragStart = (
    event: DragEvent<HTMLDivElement>,
    index: number
  ) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggedImageIndex(index);
  };

  const handleImageDragEnter = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    event.preventDefault();

    setDraggedImageIndex((currentIndex) => {
      if (currentIndex === null || currentIndex === targetIndex) {
        return currentIndex;
      }

      moveImage(currentIndex, targetIndex);
      return targetIndex;
    });
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
  };

  const openImageEnhance = (index: number) => {
    setImageEnhance({
      index,
      imageUrl: images[index],
      options: defaultEnhanceOptions(),
      loading: false,
      message: "",
      enhancedImageUrl: "",
    });
  };

  const toggleImageEnhanceOption = (key: keyof ImageEnhanceOptions) => {
    setImageEnhance((current) =>
      current
        ? {
            ...current,
            options: {
              ...current.options,
              [key]: !current.options[key],
            },
          }
        : current
    );
  };

  const runImageEnhance = async () => {
    if (!imageEnhance) return;

    setImageEnhance({
      ...imageEnhance,
      loading: true,
      message: "",
      enhancedImageUrl: "",
    });

    try {
      const res = await fetch("/api/image-enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: imageEnhance.imageUrl,
          options: imageEnhance.options,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Chưa cấu hình AI xử lý ảnh. Vui lòng thêm OPENAI_API_KEY hoặc provider xử lý ảnh."
        );
      }

      setImageEnhance((current) =>
        current
          ? {
              ...current,
              loading: false,
              message: "",
              enhancedImageUrl: json.enhancedImageUrl || "",
            }
          : current
      );
    } catch (error) {
      setImageEnhance((current) =>
        current
          ? {
              ...current,
              loading: false,
              message:
                error instanceof Error
                  ? error.message
                  : "Chưa cấu hình AI xử lý ảnh. Vui lòng thêm OPENAI_API_KEY hoặc provider xử lý ảnh.",
            }
          : current
      );
    }
  };

  const useEnhancedImage = () => {
    if (!imageEnhance?.enhancedImageUrl) return;

    setImages((current) =>
      current.map((img, index) =>
        index === imageEnhance.index ? imageEnhance.enhancedImageUrl : img
      )
    );
    setImageEnhance(null);
  };

  const toggleListingStatus = async () => {
    if (!id || statusLoading) return;

    const nextStatus: ListingStatus =
      status === "available" ? "rented" : "available";

    setStatusLoading(true);
    setStatusMessage("");

    const { error } = await supabase
      .from("listings")
      .update({ status: nextStatus })
      .eq("id", id);

    setStatusLoading(false);

    if (error) {
      console.error("Không cập nhật được trạng thái tin:", error);
      setStatusMessage(`Không cập nhật được trạng thái: ${error.message}`);
      return;
    }

    setStatus(nextStatus);
    setStatusMessage(
      nextStatus === "rented"
        ? "Đã đánh dấu tin này là đã cho thuê"
        : "Tin đã được mở lại"
    );
  };

  // UPDATE
  const updatePost = async () => {
  setLoading(true);

  const payload = {
    title,
    district,
    address,

    price: Number(price) || 0,
    area: Number(area) || 0,
    width: Number(width) || 0,
    length: Number(length) || 0,
    floors: Number(floors) || 0,

    bedrooms: Number(bedrooms) || 0,
    bathrooms: Number(bathrooms) || 0,

    furniture,
    amenities,

    contact_phone: contactPhone,

    description,
    images,
    status,
  };

  console.log("ID =", params.id);
  console.log("PAYLOAD =", payload);

  const { data, error } = await supabase
  .from("listings")
  .update(payload)
  .eq("id", id)
  .select();

  console.log("DATA =", data);
  console.log("ERROR =", error);

  setLoading(false);

  if (error) {
  alert(error.message);
  return;
}

alert("Đã cập nhật");

// QUAY VỀ TRANG CHỦ
window.location.href = "/";
};

  if (roleLoading) {
    return <div style={{ padding: 20 }}>Đang kiểm tra quyền truy cập...</div>;
  }

  if (role !== "admin") {
    return (
      <div style={{ padding: 20 }}>
        Bạn không có quyền quản trị tin đăng này.
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* NAV */}
      <div style={styles.nav}>
        <h2
          style={{
            cursor: "pointer",
          }}
          onClick={() =>
            router.push("/")
          }
        >
          🏠 BDS
        </h2>

        <button
          style={styles.backBtn}
          onClick={() =>
            router.back()
          }
        >
          ← Quay lại
        </button>
      </div>

      {/* FORM */}
      <div style={styles.container}>
        <div style={styles.form}>
          <h1>✏️ Sửa tin</h1>

          {/* TITLE */}
          <input
            placeholder="Tiêu đề"
            value={title}
            onChange={(e) =>
              setTitle(
                e.target.value
              )
            }
            style={styles.input}
          />

          {/* PRICE */}
          <input
            placeholder="Giá"
            value={price}
            onChange={(e) =>
              setPrice(
                e.target.value
              )
            }
            style={styles.input}
          />

          {/* DISTRICT */}
          <input
            placeholder="Quận"
            value={district}
            onChange={(e) =>
              setDistrict(
                e.target.value
              )
            }
            style={styles.input}
          />
          <input
  placeholder="Địa chỉ"
  value={address}
  onChange={(e) =>
    setAddress(e.target.value)
  }
  style={styles.input}
/>

<input
  placeholder="Diện tích"
  value={area}
  onChange={(e) =>
    setArea(e.target.value)
  }
  style={styles.input}
/>

<input
  placeholder="Ngang"
  value={width}
  onChange={(e) =>
    setWidth(e.target.value)
  }
  style={styles.input}
/>

<input
  placeholder="Dài"
  value={length}
  onChange={(e) =>
    setLength(e.target.value)
  }
  style={styles.input}
/>

<input
  placeholder="Số tầng"
  value={floors}
  onChange={(e) =>
    setFloors(e.target.value)
  }
  style={styles.input}
/>

<input
  placeholder="SĐT liên hệ"
  value={contactPhone}
  onChange={(e) =>
    setContactPhone(
      e.target.value
    )
  }
  style={styles.input}
/>

<select
  value={furniture}
  onChange={(e) =>
    setFurniture(
      e.target.value
    )
  }
  style={styles.input}
>
  <option>Trống</option>
  <option>Cơ bản</option>
  <option>Đầy đủ</option>
</select>

          {/* BEDROOMS */}
          <input
            placeholder="Số phòng ngủ"
            value={bedrooms}
            onChange={(e) =>
              setBedrooms(
                e.target.value
              )
            }
            style={styles.input}
          />

          {/* BATHROOMS */}
          <input
            placeholder="Số WC"
            value={bathrooms}
            onChange={(e) =>
              setBathrooms(
                e.target.value
              )
            }
            style={styles.input}
          />

          {/* DESCRIPTION */}
          <textarea
            placeholder="Mô tả"
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            style={styles.textarea}
          />

          {/* UPLOAD */}
          <div>
            <p>
              📸 Upload thêm ảnh
            </p>

            <input
              type="file"
              multiple
              onChange={(e) =>
                uploadImages(
                  e.target.files
                )
              }
            />

            {uploading && (
              <p>
                Đang upload...
              </p>
            )}
          </div>

          {/* GALLERY */}
          <div style={styles.gallery}>
            {images.map((img, index) => (
              <div
                key={index}
                draggable
                onDragStart={(event) => handleImageDragStart(event, index)}
                onDragEnter={(event) => handleImageDragEnter(event, index)}
                onDragOver={(event) => event.preventDefault()}
                onDragEnd={handleImageDragEnd}
                style={{
                  ...styles.imageBox,
                  ...(draggedImageIndex === index ? styles.imageBoxDragging : {}),
                }}
              >
                <img
                  src={img}
                  style={styles.image}
                  draggable={false}
                />

                {index === 0 && (
                  <div style={styles.coverBadge}>
                    Ảnh bìa
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  style={styles.removeBtn}
                >
                  ✕
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    openImageEnhance(index);
                  }}
                  style={styles.enhanceImageButton}
                >
                  ✏️ AI sửa ảnh
                </button>
              </div>
            ))}
          </div>

          {imageEnhance && (
            <div style={styles.enhanceOverlay}>
              <div style={styles.enhancePanel}>
                <div style={styles.enhanceHeader}>
                  <strong>AI sửa ảnh</strong>
                  <button
                    type="button"
                    onClick={() => setImageEnhance(null)}
                    style={styles.enhanceCloseButton}
                  >
                    ×
                  </button>
                </div>

                <div style={styles.enhanceOptions}>
                  <label style={styles.enhanceOption}>
                    <input
                      type="checkbox"
                      checked={imageEnhance.options.removeLogo}
                      onChange={() => toggleImageEnhanceOption("removeLogo")}
                    />
                    Xóa logo/watermark
                  </label>
                  <label style={styles.enhanceOption}>
                    <input
                      type="checkbox"
                      checked={imageEnhance.options.removePhone}
                      onChange={() => toggleImageEnhanceOption("removePhone")}
                    />
                    Xóa số điện thoại
                  </label>
                  <label style={styles.enhanceOption}>
                    <input
                      type="checkbox"
                      checked={imageEnhance.options.removeAddress}
                      onChange={() => toggleImageEnhanceOption("removeAddress")}
                    />
                    Xóa địa chỉ trên ảnh
                  </label>
                  <label style={styles.enhanceOption}>
                    <input
                      type="checkbox"
                      checked={imageEnhance.options.enhanceQuality}
                      onChange={() => toggleImageEnhanceOption("enhanceQuality")}
                    />
                    Làm sáng / nét hơn
                  </label>
                  <label style={styles.enhanceOption}>
                    <input
                      type="checkbox"
                      checked={imageEnhance.options.removeObjects}
                      onChange={() => toggleImageEnhanceOption("removeObjects")}
                    />
                    Xóa vật thể thừa
                  </label>
                </div>

                <button
                  type="button"
                  onClick={runImageEnhance}
                  disabled={imageEnhance.loading}
                  style={{
                    ...styles.enhanceRunButton,
                    ...(imageEnhance.loading ? styles.enhanceRunButtonDisabled : {}),
                  }}
                >
                  Chạy AI
                </button>

                {imageEnhance.loading && (
                  <p style={styles.enhanceMessage}>Đang xử lý ảnh...</p>
                )}

                {imageEnhance.message && (
                  <p style={styles.enhanceError}>{imageEnhance.message}</p>
                )}

                {imageEnhance.enhancedImageUrl && (
                  <>
                    <div style={styles.beforeAfterGrid}>
                      <div>
                        <p style={styles.previewLabel}>Ảnh cũ</p>
                        <img src={imageEnhance.imageUrl} style={styles.previewImage} />
                      </div>
                      <div>
                        <p style={styles.previewLabel}>Ảnh mới</p>
                        <img
                          src={imageEnhance.enhancedImageUrl}
                          style={styles.previewImage}
                        />
                      </div>
                    </div>
                    <div style={styles.enhanceActions}>
                      <button
                        type="button"
                        onClick={useEnhancedImage}
                        style={styles.useNewButton}
                      >
                        Dùng ảnh mới
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageEnhance(null)}
                        style={styles.keepOldButton}
                      >
                        Giữ ảnh cũ
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* BUTTONS */}
          {statusMessage && (
            <p
              style={
                statusMessage.startsWith("Không")
                  ? styles.statusError
                  : styles.statusSuccess
              }
            >
              {statusMessage}
            </p>
          )}

          <div style={styles.primaryActions}>
            <button
              type="button"
              onClick={toggleListingStatus}
              disabled={statusLoading}
              style={{
                ...styles.statusButton,
                ...(status === "rented"
                  ? styles.reopenButton
                  : styles.rentedButton),
                ...(statusLoading ? styles.disabledButton : {}),
              }}
            >
              {statusLoading
                ? "Đang cập nhật trạng thái..."
                : status === "available"
                  ? "Đánh dấu đã cho thuê"
                  : "Mở lại tin"}
            </button>

            <button
              type="button"
              onClick={updatePost}
              disabled={loading || statusLoading}
              style={{
                ...styles.button,
                ...(loading || statusLoading ? styles.disabledButton : {}),
              }}
            >
              {loading
                ? "Đang cập nhật..."
                : "💾 Cập nhật tin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  page: {
  minHeight: "100vh",
  width: "100%",
  overflowX: "hidden",
  background: "#f3f4f6",
  fontFamily: "Arial",
},

  nav: {
    background: "#111827",
    color: "white",
    padding: "16px 24px",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  backBtn: {
    background: "white",
    color: "#111827",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },

  container: {
    display: "flex",
    justifyContent: "center",
    padding: 30,
  },

  form: {
    background: "white",
    width: "100%",
    maxWidth: 700,
    borderRadius: 16,
    padding: 24,
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  input: {
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 15,
  },

  textarea: {
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ddd",
    minHeight: 120,
    outline: "none",
    fontSize: 15,
  },

  gallery: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
  },

  imageBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    background: "#f3f4f6",
    border: "2px solid transparent",
    borderRadius: 10,
    cursor: "grab",
    boxSizing: "border-box",
  },

  imageBoxDragging: {
    opacity: 0.55,
    border: "2px solid #2563eb",
    cursor: "grabbing",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    background: "red",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: 24,
    height: 24,
    cursor: "pointer",
  },

  enhanceImageButton: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    background: "rgba(17, 24, 39, 0.9)",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 6px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  coverBadge: {
    position: "absolute",
    left: 6,
    top: 6,
    background: "#16a34a",
    color: "white",
    borderRadius: 6,
    padding: "3px 6px",
    fontSize: 12,
    fontWeight: 700,
  },

  enhanceOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    background: "rgba(17, 24, 39, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  enhancePanel: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "white",
    borderRadius: 8,
    padding: 16,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  enhanceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  enhanceCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontSize: 20,
    lineHeight: 1,
  },

  enhanceOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  enhanceOption: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  },

  enhanceRunButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },

  enhanceRunButtonDisabled: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },

  enhanceMessage: {
    margin: 0,
    color: "#1d4ed8",
    fontSize: 14,
  },

  enhanceError: {
    margin: 0,
    color: "#b91c1c",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },

  beforeAfterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  previewLabel: {
    margin: "0 0 6px",
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
  },

  previewImage: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: 8,
    background: "#f3f4f6",
    display: "block",
  },

  enhanceActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  useNewButton: {
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },

  keepOldButton: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "bold",
  },

  button: {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: 16,
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 16,
  },

  primaryActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  statusButton: {
    border: "none",
    padding: 16,
    borderRadius: 12,
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  rentedButton: {
    background: "#dc2626",
  },

  reopenButton: {
    background: "#16a34a",
  },

  disabledButton: {
    background: "#94a3b8",
    cursor: "not-allowed",
  },

  statusSuccess: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
  },

  statusError: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 700,
  },
};

export default function EditPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <EditContent />
    </RoleGate>
  );
}
