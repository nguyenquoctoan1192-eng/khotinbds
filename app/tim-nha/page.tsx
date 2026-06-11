"use client";

import { useState } from "react";

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

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullname,
        phone,
        max_price: maxPrice ? Number(maxPrice) : null,
        preferred_districts: district ? [district] : [],
        bedrooms: bedrooms ? Number(bedrooms) : null,
        mode: "lead",
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      alert("TÃ¬m nhÃ  tháº¥t báº¡i");
      return;
    }

    setResults(json.matches || []);
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

      {results.map((item) => {
        const listing = item.listing || item;
        const breakdown = item.breakdown;
        const reasons = item.reasons || breakdown?.reasons || [];

        return (
        <div
          key={listing.id}
          style={{
            border:
              "1px solid #ddd",
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
          }}
        >
          <h3>{listing.title}</h3>

          <p>
            Score:
            {" "}
            {item.score}
          </p>

          {breakdown && (
            <p>
              Breakdown:
              {" "}
              District {breakdown.district_score}
              {" "}
              -
              {" "}
              Price {breakdown.price_score}
              {" "}
              -
              {" "}
              Area {breakdown.area_score}
              {" "}
              -
              {" "}
              Bedrooms {breakdown.bedroom_score}
            </p>
          )}

          {reasons.length > 0 && (
            <ul>
              {reasons.map((reason: string, index: number) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}

          <p>
            Giá:
            {" "}
            {Number(
              listing.price
            ).toLocaleString()}
          </p>

          <p>
            {listing.address}
          </p>

          <p>
            {listing.district}
          </p>

          {listing.images?.[0] && (
            <img
              src={listing.images[0]}
              width={250}
            />
          )}
        </div>
        );
      })}
    </div>
  );
}
