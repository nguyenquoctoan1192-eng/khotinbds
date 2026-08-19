"use client";

import { useEffect, useState } from "react";

type Props = { botToken: string };

export default function BrokerSettingsCard({ botToken }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/bot/profile", { headers: { authorization: `Bearer ${botToken}` } })
      .then((r) => r.json())
      .then((data) => {
        setDisplayName(data?.profile?.display_name || "");
        setPhone(data?.profile?.default_contact_phone || "");
      })
      .catch(() => setMessage("Không tải được thông tin môi giới"));
  }, [botToken]);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/bot/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${botToken}` },
      body: JSON.stringify({ displayName, defaultContactPhone: phone }),
    });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? "Đã lưu số điện thoại mặc định" : data?.error || "Không lưu được");
  }

  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, background: "#fff" }}>
      <h3 style={{ margin: 0 }}>Thông tin môi giới</h3>
      <p style={{ color: "#6b7280" }}>Mọi bài Facebook của Bot sẽ dùng số này, trừ khi tin có số liên hệ riêng.</p>
      <div style={{ display: "grid", gap: 12 }}>
        <label>Tên môi giới<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }} /></label>
        <label>Số điện thoại liên hệ mặc định<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0908 123 456" style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }} /></label>
        <button onClick={save} disabled={saving} style={{ width: "fit-content", padding: "10px 16px" }}>{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
        {message ? <div>{message}</div> : null}
      </div>
    </section>
  );
}

