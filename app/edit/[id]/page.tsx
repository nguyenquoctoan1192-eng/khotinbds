"use client";

import {
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

const supabase = createClient(
  process.env
    .NEXT_PUBLIC_SUPABASE_URL || "",
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function EditPage() {
  const router = useRouter();

  const params = useParams();

  console.log("PARAMS =", params);
  console.log("ID =", params.id);

  const [loading, setLoading] =
    useState(false);

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

  // LOAD DATA
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } =
      await supabase
        .from("listings")
        .select("*")
        .eq("id", params.id)
        .single();

        
        

    console.log("FETCH DATA =", data);
  console.log("FETCH ERROR =", error);  

    if (error) {
      console.error(error);
      return;
    }

    setTitle(data.title || "");

    setPrice(
      String(data.price || "")
    );

    setDistrict(
      data.district || ""
    );

    setAddress(
  data.address || ""
);

setArea(
  String(data.area || "")
);

setWidth(
  String(data.width || "")
);

setLength(
  String(data.length || "")
);

setFloors(
  String(data.floors || "")
);

setFurniture(
  data.furniture || "Trống"
);

setContactPhone(
  data.contact_phone || ""
);

setAmenities(
  data.amenities || []
);

    setBedrooms(
      String(data.bedrooms || "")
    );

    setBathrooms(
      String(data.bathrooms || "")
    );

    setDescription(
      data.description || ""
    );

    setImages(data.images || []);
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
  };

  console.log("ID =", params.id);
  console.log("PAYLOAD =", payload);

  const { data, error } = await supabase
    .from("listings")
    .update(payload)
    .eq("id", params.id)
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
            {images.map(
              (img, index) => (
                <div
                  key={index}
                  style={
                    styles.imageBox
                  }
                >
                  <img
                    src={img}
                    style={
                      styles.image
                    }
                  />

                  <button
                    onClick={() =>
                      removeImage(
                        index
                      )
                    }
                    style={
                      styles.removeBtn
                    }
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>

          {/* BUTTON */}
          <button
            onClick={updatePost}
            style={styles.button}
          >
            {loading
              ? "Đang cập nhật..."
              : "💾 Cập nhật tin"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
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
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  imageBox: {
    position: "relative",
  },

  image: {
    width: 140,
    height: 100,
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
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: 16,
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 16,
  },
};