"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Customer = {
  id: string;
  fullname: string;
  phone: string;
  lead_score: number;
  status: string;
  created_at: string;
};

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then(setData);
  }, []);

  const filtered = data.filter((c) =>
    (c.fullname || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const getColor = (score: number) => {
    if (score >= 80) return "red";
    if (score >= 50) return "orange";
    return "gray";
  };

  return (
    <div style={{ maxWidth: 1000, margin: "20px auto" }}>
      <h1>CRM Dashboard</h1>

      <input
        placeholder="Search khách hàng..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Tên</th>
            <th>SĐT</th>
            <th>Score</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.fullname}</td>
              <td>{c.phone}</td>
              <td style={{ color: getColor(c.lead_score) }}>
                {c.lead_score}
              </td>
              <td>{c.status}</td>
              <td>
                <Link href={`/customers/${c.id}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}