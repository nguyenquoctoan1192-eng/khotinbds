"use client";

import { useState } from "react";

export default function CopilotPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");

  const send = async () => {
    if (!input) return;

    const msg = input;
    setInput("");

    setMessages((p) => [...p, { role: "user", text: msg }]);

    const res = await fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        customerId: "demo",
      }),
    });

    const data = await res.json();

    setMessages((p) => [
      ...p,
      { role: "ai", text: data.suggestReply },
    ]);
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h2>Copilot (No AI Mode)</h2>

      <div style={{ height: 400, overflow: "auto", border: "1px solid #ddd", padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.role}:</b> {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}

