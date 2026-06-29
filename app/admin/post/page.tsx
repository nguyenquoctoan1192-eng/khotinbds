"use client";

import { useState, type DragEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import SiteNavbar from "@/app/components/site-navbar";
import RoleGate from "@/app/components/role-gate";
import { parseZaloListingText } from "@/lib/zaloListingParser";

function DraggableImage({
  img,
  index,
  removeImage,
  onEnhance,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isDragging,
}: any) {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, index)}
      onDragEnter={(event) => onDragEnter(event, index)}
      onDragOver={(event) => event.preventDefault()}
      onDragEnd={onDragEnd}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        overflow: "hidden",
        background: "#f3f4f6",
        opacity: isDragging ? 0.55 : 1,
        border: isDragging ? "2px solid #2563eb" : "2px solid transparent",
        borderRadius: 10,
        cursor: isDragging ? "grabbing" : "grab",
        boxSizing: "border-box",
      }}
    >
      <img
        src={img}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        draggable={false}
      />

      {index === 0 && (
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 6,
            background: "#16a34a",
            color: "white",
            borderRadius: 6,
            padding: "3px 6px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Ảnh bìa
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          removeImage(index)
        }
        style={{
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
        }}
      >
        ✕
      </button>

      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onEnhance(index);
        }}
        style={{
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
        }}
      >
        ✏️ AI sửa ảnh
      </button>
    </div>
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type AiListingContent = {
  primary_content: string;
  cho_tot_title: string;
  facebook_title: string;
  short_description: string;
  seo_description: string;
};

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

const defaultEnhanceOptions = (): ImageEnhanceOptions => ({
  removeLogo: false,
  removePhone: false,
  removeAddress: false,
  enhanceQuality: true,
  removeObjects: false,
});

function PostContent() {
  const router = useRouter();

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

  const [zaloText, setZaloText] =
  useState("");  

  const [images, setImages] =
    useState<string[]>([]);
  const [draggedImageIndex, setDraggedImageIndex] =
    useState<number | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [aiContentLoading, setAiContentLoading] =
    useState(false);

  const [aiContentMessage, setAiContentMessage] =
    useState("");

  const [aiContent, setAiContent] =
    useState<AiListingContent | null>(null);

  const [savingAiContent, setSavingAiContent] =
    useState(false);

  const [imageEnhance, setImageEnhance] =
    useState<ImageEnhanceState | null>(null);

  // UPLOAD IMAGES
  const uploadImages = async (
    files: FileList | null
  ) => {
    if (!files) return;

    setUploading(true);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const fileName =
  `${Date.now()}-${Math.random()}-${file.name}`;

      const { error } =
        await supabase.storage
          .from("image")
          .upload(fileName, file);

      if (error) {
        console.error(error);
        alert("Upload ảnh thất bại");
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



  

  const toggleAmenity = (
  value: string
) => {
  if (
    amenities.includes(value)
  ) {
    setAmenities(
      amenities.filter(
        (a) => a !== value
      )
    );
  } else {
    setAmenities([
      ...amenities,
      value,
    ]);
  }
};

const parseZaloPost = () => {
  alert("TEST");
};

const copyAiContent = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    setAiContentMessage("Đã copy nội dung.");
  } catch (error) {
    console.error(error);
    setAiContentMessage("Chưa copy được nội dung, bạn copy thủ công nhé.");
  }
};

const getAiListingDimensions = () =>
  width && length
    ? `${width}x${length}`
    : area
      ? `${area}m²`
      : "";

const getAiListingStructure = () => (floors ? `${floors} tầng` : "");

const saveAiContentToLibrary = async () => {
  if (!aiContent) return;

  setSavingAiContent(true);
  setAiContentMessage("");

  try {
    const res = await fetch("/api/listing-library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw_input: zaloText || description,
        title,
        address,
        district,
        street: address,
        price,
        area: getAiListingDimensions() || area,
        structure: getAiListingStructure(),
        phone: contactPhone,
        content: aiContent,
      }),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Không lưu được tin vào kho");
    }

    setAiContentMessage("Đã lưu vào kho tin đăng.");
  } catch (error) {
    console.error("Không lưu được tin vào kho:", error);
    setAiContentMessage(
      error instanceof Error
        ? error.message
        : "Chưa lưu được vào kho tin đăng, bạn thử lại sau nhé."
    );
  } finally {
    setSavingAiContent(false);
  }
};

const autoFillFromZalo = () => {
  const text = (zaloText || "").trim();
  if (!text) return;

  const parsed = parseZaloListingText(text);
  console.log("ZALO_PARSE_RESULT", parsed);

  setTitle(parsed.title);
  setPrice(parsed.price ? String(parsed.price) : "");
  setDistrict(parsed.district);
  setAddress(parsed.address);
  setArea(parsed.area !== null ? String(parsed.area) : "");
  setWidth(parsed.width !== null ? String(parsed.width) : "");
  setLength(parsed.length !== null ? String(parsed.length) : "");
  setFloors(String(parsed.floors));
  setContactPhone(parsed.phone);
  setFurniture(parsed.furnishing);
  setDescription(parsed.description);

  if (parsed.bedrooms !== null) setBedrooms(String(parsed.bedrooms));
  if (parsed.bathrooms !== null) setBathrooms(String(parsed.bathrooms));

  alert("Đã tự điền xong");
};

  const generateAiContent = async () => {
    setAiContentMessage("");
    setAiContent(null);
    setAiContentLoading(true);

    try {
      const res = await fetch("/api/listing-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          price,
          district,
          area,
          width,
          length,
          floors,
          bedrooms,
          bathrooms,
          wc: bathrooms,
          furnishing: furniture,
          phone: contactPhone,
          description,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không tạo được nội dung AI");
      }

      setAiContent(json.content);
      setAiContentMessage("Đã tạo nội dung AI.");
    } catch (error) {
      console.error(error);
      setAiContentMessage("Chưa tạo được nội dung AI, bạn thử lại sau nhé.");
    } finally {
      setAiContentLoading(false);
    }
  };

  // CREATE POST
  const createPost = async () => {
    if (
      !title ||
      !price ||
      !district
    ) {
      alert("Nhập thiếu thông tin");
      return;
    }

    setLoading(true);

    // KIỂM TRA TIN TRÙNG
const { data: oldPosts } =
  await supabase
    .from("listings")
    .select("id")
    .eq("address", address);

if (oldPosts?.length) {
  await supabase
    .from("listings")
    .delete()
    .in(
      "id",
      oldPosts.map(x => x.id)
    );
}

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

  created_at: new Date().toISOString(),   // ✔ NGÀY ĐĂNG
  updated_at: new Date().toISOString(),   // ✔ NGÀY CẬP NHẬT
};

console.log("PAYLOAD =", payload);

const { data, error } = await supabase
  .from("listings")
  .insert([payload])
  .select();

console.log("DATA =", data);
console.log("ERROR =", error);

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Đăng tin thất bại");
      return;
    }

    alert("Đăng tin thành công");

   router.push("/admin/listing-library");
  };

  const aiContentSections = aiContent
    ? [
        {
          label: "Nội dung chia sẻ",
          value: aiContent.primary_content,
        },
        {
          label: "Tiêu đề Chợ Tốt",
          value: aiContent.cho_tot_title,
        },
        {
          label: "Tiêu đề Facebook",
          value: aiContent.facebook_title,
        },
        {
          label: "Mô tả ngắn",
          value: aiContent.short_description,
        },
        {
          label: "Mô tả SEO",
          value: aiContent.seo_description,
        },
      ]
    : [];

  return (
  <div style={{ width: "100%", overflowX: "hidden" }}>
    <SiteNavbar />
    <div style={styles.page}>

      {/* FORM */}
      <div className="container" style={styles.container}>
        <div className="form" style={styles.form}>
          
          <h1>Đăng tin bất động sản</h1>

          {/* ZALO INPUT */}
          <textarea
            placeholder="Dán tin từ Zalo vào đây..."
            value={zaloText}
            onChange={(e) => setZaloText(e.target.value)}
            style={{
              width: "100%",
              height: 120,
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          />

          <button
            onClick={autoFillFromZalo}
            style={{
              width: "100%",
              marginBottom: 20,
              padding: 12,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            🤖 Tự điền từ Zalo
          </button>

          {/* INPUTS */}
          <input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />
          <input placeholder="Giá" value={price} onChange={(e) => setPrice(e.target.value)} style={styles.input} />
          <input placeholder="Quận" value={district} onChange={(e) => setDistrict(e.target.value)} style={styles.input} />
          <input placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} style={styles.input} />
          <input placeholder="Diện tích (m²)" value={area} onChange={(e) => setArea(e.target.value)} style={styles.input} />
          <input placeholder="Ngang" value={width} onChange={(e) => setWidth(e.target.value)} style={styles.input} />
          <input placeholder="Dài" value={length} onChange={(e) => setLength(e.target.value)} style={styles.input} />
          <input placeholder="Số tầng" value={floors} onChange={(e) => setFloors(e.target.value)} style={styles.input} />
          <input placeholder="Số điện thoại liên hệ" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={styles.input} />
          <input placeholder="Số phòng ngủ" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={styles.input} />
          <input placeholder="Số WC" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} style={styles.input} />

          {/* FURNITURE */}
          <select
            value={furniture}
            onChange={(e) => setFurniture(e.target.value)}
            style={styles.input}
          >
            <option>Trống</option>
            <option>Cơ bản</option>
            <option>Đầy đủ</option>
          </select>

          {/* DESCRIPTION */}
          <textarea
            placeholder="Mô tả"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
          />

          <button
            type="button"
            onClick={generateAiContent}
            disabled={aiContentLoading}
            style={{
              width: "100%",
              padding: 12,
              background: aiContentLoading ? "#94a3b8" : "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: aiContentLoading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {aiContentLoading ? "Đang tạo nội dung..." : "Tạo nội dung AI"}
          </button>

          {aiContentMessage && (
            <div
              style={{
                background: "#f5f3ff",
                color: "#5b21b6",
                border: "1px solid #ddd6fe",
                borderRadius: 8,
                padding: 10,
                fontSize: 14,
              }}
            >
              {aiContentMessage}
            </div>
          )}

          {aiContent && (
            <div style={styles.aiPanel}>
              {aiContentSections.map((item) => (
                <div key={item.label} style={styles.aiSection}>
                  <div style={styles.aiSectionHeader}>
                    <strong>{item.label}</strong>
                    <button
                      type="button"
                      onClick={() => copyAiContent(item.value)}
                      style={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={styles.aiOutput}>{item.value}</div>
                </div>
              ))}
              <button
                type="button"
                onClick={saveAiContentToLibrary}
                disabled={savingAiContent}
                style={{
                  width: "100%",
                  padding: 12,
                  background: savingAiContent ? "#94a3b8" : "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: savingAiContent ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {savingAiContent ? "Đang lưu..." : "Lưu vào kho tin đăng"}
              </button>
            </div>
          )}

          {/* UPLOAD */}
          <div>
            <p>📸 Upload hình ảnh</p>

            <input
              type="file"
              multiple
              onChange={(e) => uploadImages(e.target.files)}
            />

            {uploading && <p>Đang upload ảnh...</p>}
          </div>

          {/* IMAGE GRID */}
          <div className="gallery" style={styles.gallery}>
            {images.map((img, index) => (
              <DraggableImage
                key={img}
                img={img}
                index={index}
                removeImage={removeImage}
                onEnhance={openImageEnhance}
                onDragStart={handleImageDragStart}
                onDragEnter={handleImageDragEnter}
                onDragEnd={handleImageDragEnd}
                isDragging={draggedImageIndex === index}
              />
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

          {/* BUTTON */}
          <button
            className="btn"
            onClick={createPost}
            style={styles.button}
          >
            {loading ? "Đang đăng..." : "Đăng tin"}
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
    background:"#111827",
    color:"white",
    padding:"12px",
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    flexWrap:"wrap",
    gap:10,
  },

  backBtn:{
    background:"white",
    color:"#111827",
    border:"none",
    padding:"10px 12px",
    borderRadius:10,
    cursor:"pointer",
    fontWeight:"bold",
    fontSize:14,
  },

  container: {
    display: "flex",
    justifyContent: "center",
    padding: 12,
    width: "100%",
    overflowX: "hidden",
  },

  form: {
    background: "white",
    maxWidth: "100%",
    width: "100%",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    boxSizing: "border-box",
  },

  input: {
    width: "100%",
    padding: 16,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 16,
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    padding: 16,
    borderRadius: 10,
    border: "1px solid #ddd",
    minHeight: 120,
    fontSize: 16,
    boxSizing: "border-box",
  },

  aiPanel: {
    border: "1px solid #ddd6fe",
    borderRadius: 8,
    padding: 12,
    background: "#faf5ff",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  aiSection: {
    background: "white",
    border: "1px solid #e9d5ff",
    borderRadius: 8,
    padding: 12,
  },

  aiSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  copyButton: {
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  aiOutput: {
    color: "#111827",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    wordBreak: "break-word",
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

  gallery: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
  },

  imageBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 10,
    overflow: "hidden",
    background: "#f3f4f6",
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

  button: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "bold",
  },
};

export default function PostPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <PostContent />
    </RoleGate>
  );
}
