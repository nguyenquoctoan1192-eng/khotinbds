"use client";

import { useState } from "react";

export default function CopilotPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input) return;

    const userMessage = input;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMessage },
    ]);

    const res = await fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        customerId: "demo",
      }),
    });

    const data = await res.json();

    setMessages((prev) => [
      ...prev,
      { role: "ai", text: data.suggestReply },
    ]);
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h2>AI Copilot</h2>

      <div style={{ height: 400, overflowY: "auto", border: "1px solid #ddd", padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: 8 }}>
            <b>{m.role}:</b> {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}