"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";


import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

function SortableImage({
  img,
  index,
  removeImage,
  moveImage,
  imageCount,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: img,
  });

  const style = {
    transform:
      CSS.Transform.toString(
        transform
      ),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "relative",
        ...style,
      }}
    >
      <img
        src={img}
        style={{
          width: "100%",
          aspectRatio: "4/3",
          objectFit: "cover",
          borderRadius: 10,
        }}
        {...attributes}
        {...listeners}
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

      <div
        style={{
          position: "absolute",
          left: 6,
          bottom: 6,
          display: "flex",
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => moveImage(index, index - 1)}
          disabled={index === 0}
          style={{
            background: index === 0 ? "#9ca3af" : "#111827",
            color: "white",
            border: "none",
            borderRadius: 6,
            width: 30,
            height: 26,
            cursor: index === 0 ? "default" : "pointer",
          }}
          title="Đưa ảnh lên trước"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => moveImage(index, index + 1)}
          disabled={index === imageCount - 1}
          style={{
            background: index === imageCount - 1 ? "#9ca3af" : "#111827",
            color: "white",
            border: "none",
            borderRadius: 6,
            width: 30,
            height: 26,
            cursor: index === imageCount - 1 ? "default" : "pointer",
          }}
          title="Đưa ảnh xuống sau"
        >
          →
        </button>
      </div>
    </div>
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function PostPage() {
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

  const handleDragEnd = (
  event: any
) => {
  const { active, over } =
    event;

  if (
    !over ||
    active.id === over.id
  )
    return;

  setImages((items) => {
    const oldIndex =
      items.indexOf(
        active.id
      );

    const newIndex =
      items.indexOf(over.id);

    return arrayMove(
      items,
      oldIndex,
      newIndex
    );
  });
};  

  const [uploading, setUploading] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

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

const autoFillFromZalo = () => {
  const text = (zaloText || "").trim();
  if (!text) return;

  const priceMatch = text.match(
  /(?:^|\s)(\d+(?:\.\d+)?)\s*tr\b/i
);

const priceValue = priceMatch
  ? Math.round(
      parseFloat(priceMatch[1]) *
        1000000
    )
  : 0;

console.log("PRICE VALUE:", priceValue);

console.log(
  "PRICE MATCH =",
  priceMatch
);

  
  console.log("ZALO TEXT:", text);
  
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const firstLine = lines[0] || "";

  // ======================
  // HELPERS
  // ======================
  const parsePrice = (t: string) => {
  const cleaned = t
    .toLowerCase()
    .replace(/,/g, " ");

  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*tr\b/);

  if (!m) return 0;

  const value = parseFloat(m[1]);

  // chặn trường hợp rác bất thường
  if (value > 10000) return 0;

  return Math.round(value * 1000000);
};

  const parsePhone = (t: string) => {
    const m = t.match(/0\d{9}/);
    return m ? m[0] : "";
  };

  const normalizeDistrict = (t: string) => {
    const m = t.match(/q\.?\s*(\d+)/i);
    if (m) return `Quận ${m[1]}`;

    if (/thủ\s*đức/i.test(t)) return "Quận Thủ Đức";
    if (/bình\s*thạnh/i.test(t)) return "Quận Bình Thạnh";
    if (/gò\s*vấp/i.test(t)) return "Quận Gò Vấp";
    if (/tân\s*bình/i.test(t)) return "Quận Tân Bình";
    if (/q\.?\s*phú\s*nhuận/i.test(t) ||/phú\s*nhuận/i.test(t)) return "Quận Phú Nhuận";
    if (/tân\s*phú/i.test(t)) return "Quận Tân Phú";
    if (/bình\s*chánh/i.test(t)) return "Quận Bình Chánh";
    return "";
  };

  const detectPrefix = (line: string, t: string) => {
    if (/hxh/i.test(t)) return "HXH";
    if (/hxt/i.test(t)) return "HXT";
    if (/\//.test(line)) return "Hẻm";
    return "MT";
  };

  const parseSize = (t: string) => {
    const m = t.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!m) return { w: 0, l: 0 };
    return { w: Number(m[1]), l: Number(m[2]) };
  };

  const parseWC = (t: string) => {
    const m = t.match(/(\d+)\s*wc/i);
    return m ? Number(m[1]) : 0;
  };

  const parseBedrooms = (t: string) => {
    const m = t.match(/(\d+)\s*pn/i);
    return m ? Number(m[1]) : 0;
  };

  const parseStructure = (t: string) => {
    let basement = (t.match(/hầm/gi) || []).length ? 1 : 0;
    let terrace = /st/i.test(t) ? 1 : 0;

    let floorsCount = 0;

    const tMatch = t.match(/(\d*)t\s*\+?\s*(\d+)l/i);
    if (tMatch) {
      floorsCount = Number(tMatch[2]);
      return { basement, floorsCount, terrace };
    }

    const htMatch = t.match(/h\s*\+\s*t\s*\+\s*(\d+)l/i);
    if (htMatch) {
      floorsCount = Number(htMatch[1]);
      basement = 1;
      return { basement, floorsCount, terrace };
    }

    const lMatch = t.match(/(\d+)\s*l/i);
    if (lMatch) floorsCount = Number(lMatch[1]);

    return { basement, floorsCount, terrace };
  };

  // ======================
  // PRICE
  // ======================
  setPrice(String(priceValue));
console.log("SET PRICE:", String(priceValue));

  // ======================
  // PHONE
  // ======================
  const phone = parsePhone(text);
  if (phone) setContactPhone(phone);

  // ======================
  // DISTRICT
  // ======================
  const district = normalizeDistrict(text);
  if (district) setDistrict(district);

  // ======================
  // ADDRESS
  // ======================
  setAddress(firstLine);

  // ======================
  // TITLE
  // ======================
  const prefix = detectPrefix(firstLine, text);
  const addressNoNumber = firstLine.replace(/^\d+[\-\/]?\d*\s*/, "");
  setTitle(`${prefix} ${addressNoNumber}`);

  // ======================
  // SIZE
  // ======================
  const { w, l } = parseSize(text);
  if (w) setWidth(String(w));
  if (l) setLength(String(l));

  const baseArea = w && l ? w * l : 0;

  // ======================
  // WC + PN
  // ======================
  const wc = parseWC(text);
  const pn = parseBedrooms(text);

  if (wc) setBathrooms(String(wc));
  if (pn) setBedrooms(String(pn));

  // ======================
  // FLOORS
  // ======================
  const { basement, floorsCount, terrace } = parseStructure(text);

  const totalFloors = floorsCount + terrace;
  if (totalFloors) setFloors(String(totalFloors));

  // ======================
  // AREA
  // ======================
  let area = 0;

  const dtsd = text.match(/dtsd\s*(\d+)/i);
  const cn = text.match(/cn\s*(\d+)/i);

  if (dtsd) {
    area = Number(dtsd[1]);
  } else if (cn) {
    area = Number(cn[1]);
  } else if (baseArea) {
    const multiplier = basement + 1 + floorsCount + terrace;
    area = baseArea * multiplier;
  }

  if (area) setArea(String(area));

  // ======================
  // DESCRIPTION
  // ======================
  setDescription(lines.slice(1).join(" "));

  alert("Đã tự điền xong");
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

    router.push("/");
  };

  return (
  <div style={{ width: "100%", overflowX: "hidden" }}>
    
    <div style={styles.page}>

      {/* NAVBAR */}
      <div style={styles.nav}>
        <h2
          style={{ cursor: "pointer" }}
          onClick={() => router.push("/")}
        >
          🏠 BDS
        </h2>

        <button
          style={styles.backBtn}
          onClick={() => router.push("/")}
        >
          ← Trang chủ
        </button>
      </div>

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
              <SortableImage
                key={img}
                img={img}
                index={index}
                removeImage={removeImage}
                moveImage={moveImage}
                imageCount={images.length}
              />
            ))}
          </div>

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

  gallery: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10,
  },

  imageBox: {
    position: "relative",
  },

  image: {
    width: "100%",
    aspectRatio: "4/3",
    objectFit: "cover",
    borderRadius: 10,
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

