"use client";

import { useState } from "react";

type QueueControlProps = {
  onChanged: () => void | Promise<void>;
  setMessage?: (message: string) => void;
};

const baseButton: React.CSSProperties = {
  minHeight: 34,
  border: "1px solid #2563eb",
  borderRadius: 8,
  padding: "6px 11px",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

async function runQueueAction(input: {
  action: "reset" | "promote";
  listingId?: string;
}) {
  const response = await fetch("/api/social/queue-control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Không cập nhật được hàng chờ.");
  }

  return data;
}

export function ResetQueueButton({
  onChanged,
  setMessage,
}: QueueControlProps) {
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    if (
      !window.confirm(
        "Làm mới toàn bộ giờ đăng từ thời điểm hiện tại? Các tin sẽ cách nhau ngẫu nhiên 1–6 phút.",
      )
    ) return;

    setBusy(true);

    try {
      const data = await runQueueAction({ action: "reset" });
      setMessage?.(
        `Đã làm mới thời gian cho ${Number(data.queueCount || 0)} tin.`,
      );
      await onChanged();
    } catch (error) {
      setMessage?.(
        error instanceof Error ? error.message : "Không làm mới được thời gian.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      style={{ ...baseButton, background: "#0f766e", borderColor: "#0f766e" }}
      disabled={busy}
      onClick={() => void handleReset()}
    >
      {busy ? "Đang xếp lại..." : "↻ Reset thời gian"}
    </button>
  );
}

export function PromoteQueueButton({
  listingId,
  disabled,
  onChanged,
  setMessage,
}: QueueControlProps & {
  listingId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePromote() {
    setBusy(true);

    try {
      await runQueueAction({ action: "promote", listingId });
      setMessage?.("Đã đẩy tin lên đầu hàng chờ.");
      await onChanged();
    } catch (error) {
      setMessage?.(
        error instanceof Error ? error.message : "Không đẩy được tin.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      style={{
        ...baseButton,
        background: "#f59e0b",
        borderColor: "#f59e0b",
        color: "#111827",
        marginRight: 7,
      }}
      disabled={disabled || busy}
      onClick={() => void handlePromote()}
    >
      {busy ? "Đang đẩy..." : "↑ Đẩy tin"}
    </button>
  );
}

