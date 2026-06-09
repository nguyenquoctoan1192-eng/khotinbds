"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function FindHomePage() {
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");

  const [district, setDistrict] = useState("");

  const [maxPrice, setMaxPrice] = useState("");

  const [bedrooms, setBedrooms] = useState("");

  const [results, setResults] = useState<any[]>([]);

  const searchHomes = async () => {
    if (!phone) {
      alert("Nhập số điện thoại");
      return;
    }

    await supabase
      .from("leads")
      .insert([
        {
          fullname,
          phone,
          district,
          max_price: Number(maxPrice),
          bedrooms: Number(bedrooms),
        },
      ]);

    let query = supabase
      .from("listings")
      .select("*");

    if (district) {
      query = query.eq(
        "district",
        district
      );
    }

    if (maxPrice) {
      query = query.lte(
        "price",
        Number(maxPrice)
      );
    }

    if (bedrooms) {
      query = query.gte(
        "bedrooms",
        Number(bedrooms)
      );
    }

    const { data } = await query;

const scored =
  (data || []).map(
    (house) => {
      let score = 0;

      if (
        district &&
        house.district ===
          district
      ) {
        score += 40;
      }

      if (
        Number(house.price) <=
        Number(maxPrice)
      ) {
        score += 40;
      }

      if (
        Number(
          house.bedrooms
        ) >=
        Number(bedrooms)
      ) {
        score += 20;
      }

      return {
        ...house,
        score,
      };
    }
  );

scored.sort(
  (a, b) =>
    b.score - a.score
);

setResults(
  scored.slice(0, 10)
);

   
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: 20,
      }}
    >
      <h1>Tìm nhà phù hợp</h1>

      <input
        placeholder="Họ tên"
        value={fullname}
        onChange={(e) =>
          setFullname(
            e.target.value
          )
        }
      />

      <input
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) =>
          setPhone(
            e.target.value
          )
        }
      />

      <input
        placeholder="Quận"
        value={district}
        onChange={(e) =>
          setDistrict(
            e.target.value
          )
        }
      />

      <input
        placeholder="Ngân sách tối đa"
        value={maxPrice}
        onChange={(e) =>
          setMaxPrice(
            e.target.value
          )
        }
      />

      <input
        placeholder="Số phòng ngủ"
        value={bedrooms}
        onChange={(e) =>
          setBedrooms(
            e.target.value
          )
        }
      />

      <button
        onClick={searchHomes}
      >
        Tìm nhà
      </button>

      <hr />

      {results.map((item) => (
        <div
          key={item.id}
          style={{
            border:
              "1px solid #ddd",
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
          }}
        >
          <h3>{item.title}</h3>

          <p>
            Giá:
            {" "}
            {Number(
              item.price
            ).toLocaleString()}
          </p>

          <p>
            {item.address}
          </p>

          <p>
            {item.district}
          </p>

          {item.images?.[0] && (
            <img
              src={item.images[0]}
              width={250}
            />
          )}
        </div>
      ))}
    </div>
  );
}