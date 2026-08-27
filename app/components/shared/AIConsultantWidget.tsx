"use client";

import { useEffect, useRef, useState } from "react";
import type { RentalConsultationState } from "@/lib/rentalConsultation";

/* =========================================================
   TYPES — copy nguyên từ ListingsHome.tsx để giữ đúng shape dữ liệu
========================================================= */

type PublicChatProfile = {
  name: string | null;
  phone: string | null;
  purpose: string | null;
  business_type: string | null;
  business: string | null;
  location: string | null;
  primary_location: string | null;
  alternative_locations: string[];
  budget: string | null;
  area: string | null;
  structure: string | null;
  frontage: string | null;
  move_in_time: string | null;
};

type PropertySuggestion = {
  area_label: string;
  structure_label: string;
  price_label: string;
  comment_label?: string;
};

type PublicChatMessage = {
  role: "assistant" | "user";
  content: string;
  reply_parts?: string[];
  suggestion_followup_parts?: string[];
  property_suggestions?: PropertySuggestion[];
};

const emptyPublicChatProfile = (): PublicChatProfile => ({
  name: null,
  phone: null,
  purpose: null,
  business_type: null,
  business: null,
  location: null,
  primary_location: null,
  alternative_locations: [],
  budget: null,
  area: null,
  structure: null,
  frontage: null,
  move_in_time: null,
});

/* =========================================================
   PROPS
========================================================= */

type AIConsultantWidgetProps = {
  /**
   * Đặt true nếu trang cũng có nút "cuộn lên đầu trang" nổi góc phải
   * dưới (như trang chủ) — widget sẽ tự nâng nút bấm "💬 Tư vấn" lên
   * cao hơn để không đè lên nút đó.
   */
  liftForScrollButton?: boolean;

  /**
   * Ẩn nút bấm nổi "💬 Tư vấn" mặc định — dùng khi trang đã có sẵn
   * nút riêng (vd nút "Chat" trong trang chi tiết tin) và muốn tự
   * điều khiển việc mở/đóng qua `open`/`onOpenChange`.
   */
  hideTrigger?: boolean;

  /**
   * Điều khiển đóng/mở từ bên ngoài (controlled). Nếu không truyền,
   * widget tự quản lý trạng thái đóng/mở nội bộ (uncontrolled) —
   * đúng như hành vi gốc ở trang chủ.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AIConsultantWidget({
  liftForScrollButton = false,
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
}: AIConsultantWidgetProps) {
  const aiChatContainerRef = useRef<HTMLDivElement | null>(null);

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const showAiChat = isControlled ? Boolean(controlledOpen) : internalOpen;

  const setShowAiChat = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };

  const [aiChatMessages, setAiChatMessages] = useState<PublicChatMessage[]>([
    {
      role: "assistant",
      content: "",
      reply_parts: [
        "Em chào anh/chị.",
        "Em là Linh bên BDS.",
        "Anh/chị đang cần thuê để ở hay kinh doanh ạ?",
      ],
    },
  ]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatProfile, setAiChatProfile] = useState<PublicChatProfile>(
    emptyPublicChatProfile()
  );
  const [rentalConsultState, setRentalConsultState] =
    useState<RentalConsultationState | null>(null);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatError, setAiChatError] = useState("");
  const [aiChatLeadCreated, setAiChatLeadCreated] = useState(false);

  const aiPropertySuggestionsKey = aiChatMessages
    .map(
      (message) =>
        `${message.property_suggestions?.length || 0}:${
          message.suggestion_followup_parts?.length || 0
        }`
    )
    .join("|");

  const scrollChatToBottom = () => {
    const el = aiChatContainerRef.current;

    if (!el) {
      return;
    }

    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (!showAiChat || !aiChatContainerRef.current) {
      return;
    }

    scrollChatToBottom();
    const timer = window.setTimeout(scrollChatToBottom, 80);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiChatMessages, aiChatLoading, aiPropertySuggestionsKey, showAiChat]);

  const sendAiChatMessage = async () => {
    const message = aiChatInput.trim();

    if (!message || aiChatLoading) {
      return;
    }

    const nextMessages: PublicChatMessage[] = [
      ...aiChatMessages,
      { role: "user", content: message },
    ];

    setAiChatMessages(nextMessages);
    setAiChatInput("");
    setAiChatLoading(true);
    setAiChatError("");

    try {
      const res = await fetch("/api/rental-consultant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          state: rentalConsultState,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Không xử lý được yêu cầu.");
      }

      setRentalConsultState(json.state || null);

      setAiChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: json.reply || "Dạ em nhận được tin nhắn của anh/chị rồi ạ.",
          reply_parts: Array.isArray(json.reply_parts)
            ? json.reply_parts
            : undefined,
          suggestion_followup_parts: Array.isArray(
            json.suggestion_followup_parts
          )
            ? json.suggestion_followup_parts
            : undefined,
          property_suggestions: Array.isArray(json.property_suggestions)
            ? json.property_suggestions
            : undefined,
        },
      ]);

      if (json.profile) {
        setAiChatProfile((current) => ({
          ...current,
          ...json.profile,
        }));
      }

      if (json.leadCreated) {
        setAiChatLeadCreated(true);
      }
    } catch (err) {
      console.error("rental consultant chat request failed", err);
      setAiChatError("");
      setAiChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Dạ em nhận được tin nhắn của anh/chị rồi. Anh/chị nhắn lại giúp em nhu cầu thuê khu vực nào để em tư vấn sát hơn nha.",
        },
      ]);
    } finally {
      setAiChatLoading(false);
    }
  };

  return (
    <>
      {!hideTrigger && !showAiChat && (
        <button
          type="button"
          onClick={() => setShowAiChat(true)}
          style={{
            position: "fixed",
            right: 20,
            bottom: liftForScrollButton ? 88 : 20,
            zIndex: 10001,
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "13px 18px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
          }}
        >
          💬 Tư vấn
        </button>
      )}

      {showAiChat && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            width: "min(94vw, 380px)",
            maxHeight: "min(82vh, 620px)",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
            zIndex: 10002,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#111827",
              color: "#fff",
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <strong>Tư vấn AI</strong>
            <button
              type="button"
              onClick={() => setShowAiChat(false)}
              aria-label="Đóng chat"
              style={{
                background: "transparent",
                color: "#fff",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div
            ref={aiChatContainerRef}
            style={{
              padding: 12,
              overflowY: "auto",
              display: "grid",
              gap: 10,
              minHeight: 0,
              flex: 1,
              maxHeight: "min(60vh, 460px)",
            }}
          >
            {aiChatMessages.map((message, index) => {
              const isUser = message.role === "user";
              const suggestions = message.property_suggestions || [];
              const followupParts = message.suggestion_followup_parts || [];
              const bubbleParts =
                !isUser && message.reply_parts?.length
                  ? message.reply_parts
                  : [message.content];

              return (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    justifySelf: isUser ? "end" : "start",
                    maxWidth: "88%",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {bubbleParts.map((part, partIndex) => (
                    <div
                      key={`${message.role}-${index}-${partIndex}`}
                      style={{
                        background: isUser ? "#2563eb" : "#f3f4f6",
                        color: isUser ? "#fff" : "#111827",
                        borderRadius: 10,
                        padding: "9px 11px",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {part}
                    </div>
                  ))}
                  {!isUser && suggestions.length > 0 && (
                    <div style={{ display: "grid", gap: 8 }}>
                      {suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                        <div
                          key={`${suggestion.area_label}-${suggestionIndex}`}
                          style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 11px",
                            color: "#111827",
                            lineHeight: 1.5,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            {suggestion.area_label}
                          </div>
                          <div>Diện tích: {suggestion.structure_label}</div>
                          <div>Giá: {suggestion.price_label}</div>
                          {suggestion.comment_label && (
                            <div style={{ marginTop: 6, color: "#4b5563" }}>
                              {suggestion.comment_label}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isUser &&
                    followupParts.length > 0 &&
                    followupParts.map((part, followupIndex) => (
                      <div
                        key={`${message.role}-${index}-followup-${followupIndex}`}
                        style={{
                          background: "#f3f4f6",
                          color: "#111827",
                          borderRadius: 10,
                          padding: "9px 11px",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {part}
                      </div>
                    ))}
                </div>
              );
            })}
            {aiChatLoading && (
              <div
                style={{
                  justifySelf: "start",
                  background: "#f3f4f6",
                  borderRadius: 10,
                  padding: "9px 11px",
                  color: "#6b7280",
                }}
              >
                Đang tư vấn...
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", padding: 12 }}>
            {aiChatError && (
              <div style={{ color: "#991b1b", marginBottom: 8, fontWeight: 700 }}>
                {aiChatError}
              </div>
            )}
            <textarea
              placeholder="Nhập tin nhắn..."
              value={aiChatInput}
              onChange={(event) => setAiChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendAiChatMessage();
                }
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 62,
                maxHeight: 120,
                resize: "vertical",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                padding: 10,
                lineHeight: 1.4,
              }}
            />
            <button
              type="button"
              onClick={sendAiChatMessage}
              disabled={aiChatLoading || !aiChatInput.trim()}
              style={{
                width: "100%",
                marginTop: 8,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                fontWeight: 700,
                cursor:
                  aiChatLoading || !aiChatInput.trim() ? "default" : "pointer",
                opacity: aiChatLoading || !aiChatInput.trim() ? 0.65 : 1,
              }}
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
