"use client";

import { useState } from "react";

type Props = {
  brokerOptions?: Array<{ id: string; label: string }>;
  onCreated?: () => void;
};

export default function CreateBotLicenseCard({
  brokerOptions = [],
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [licenseType, setLicenseType] =
    useState<"admin" | "broker">("admin");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [maxDevices, setMaxDevices] = useState(1);
  const [maxFacebookAccounts, setMaxFacebookAccounts] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createLicense() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          licenseType,
          ownerUserId:
            licenseType === "broker" ? ownerUserId : null,
          maxDevices,
          maxFacebookAccounts,
          expiresAt: expiresAt || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Không tạo được license");
      }

      setLicenseKey(data.licenseKey);
      onCreated?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tạo được license",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    if (!licenseKey) return;
    await navigator.clipboard.writeText(licenseKey);
  }

  if (licenseKey) {
    return (
      <section className="rounded-xl border bg-white p-5">
        <h3 className="text-lg font-semibold">
          License đã được tạo
        </h3>

        <p className="mt-2 text-sm text-amber-700">
          Hãy sao chép ngay. Full key chỉ hiển thị một lần.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={licenseKey}
            className="w-full rounded-lg border px-3 py-2 font-mono"
          />
          <button
            type="button"
            onClick={copyKey}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white"
          >
            Sao chép
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setLicenseKey("");
            setName("");
          }}
          className="mt-4 rounded-lg border px-4 py-2"
        >
          Tạo license khác
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <h3 className="text-lg font-semibold">Tạo license mới</h3>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm">Tên license</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border px-3 py-2"
            placeholder="Ví dụ: PC Admin hoặc Nguyễn Văn A"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Loại tài khoản</span>
          <select
            value={licenseType}
            onChange={(event) =>
              setLicenseType(
                event.target.value === "broker"
                  ? "broker"
                  : "admin",
              )
            }
            className="rounded-lg border px-3 py-2"
          >
            <option value="admin">Admin</option>
            <option value="broker">Môi giới</option>
          </select>
        </label>

        {licenseType === "broker" && (
          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm">Tài khoản môi giới</span>
            <select
              value={ownerUserId}
              onChange={(event) =>
                setOwnerUserId(event.target.value)
              }
              className="rounded-lg border px-3 py-2"
            >
              <option value="">Chọn môi giới</option>
              {brokerOptions.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="grid gap-1">
          <span className="text-sm">Số thiết bị tối đa</span>
          <input
            type="number"
            min={1}
            max={100}
            value={maxDevices}
            onChange={(event) =>
              setMaxDevices(Number(event.target.value) || 1)
            }
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">
            Số Facebook tối đa
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={maxFacebookAccounts}
            onChange={(event) =>
              setMaxFacebookAccounts(
                Number(event.target.value) || 1,
              )
            }
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm">
            Ngày hết hạn (không bắt buộc)
          </span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) =>
              setExpiresAt(event.target.value)
            }
            className="rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        disabled={
          loading ||
          !name.trim() ||
          (licenseType === "broker" && !ownerUserId)
        }
        onClick={createLicense}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Đang tạo..." : "Tạo license"}
      </button>
    </section>
  );
}
