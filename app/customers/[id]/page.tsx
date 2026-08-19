"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RoleGate from "@/app/components/role-gate";

function CustomerDetailContent() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((res) => res.json())
      .then(setData);
  }, [id]);

  if (!data) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 800, margin: "20px auto" }}>
      <h2>{data.customer.fullname}</h2>

      <p>SĐT: {data.customer.phone}</p>
      <p>Score: {data.customer.lead_score}</p>
      <p>Status: {data.customer.status}</p>

      <hr />

      <h3>Chat History</h3>

      <div>
        {data.conversations.map((c: any) => (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <b>{c.sender}:</b> {c.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  return (
    <RoleGate allowedRoles={["admin", "agent"]}>
      <CustomerDetailContent />
    </RoleGate>
  );
}
