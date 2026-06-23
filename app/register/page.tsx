"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import SiteNavbar from "@/app/components/site-navbar";
import { AGENT_AREAS } from "@/lib/agentProfile";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setMessage(result.message || result.error || "Không thể đăng ký tài khoản.");
      setSuccess(response.ok && result.success);
      if (response.ok && result.success) form.reset();
    } catch {
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <SiteNavbar />
      <main className="auth-page__main">
        <form className="auth-card auth-card--wide" onSubmit={register}>
          <div>
            <h1>Đăng ký môi giới</h1>
            <p>Tham gia hệ thống để nhận khách hàng theo khu vực phụ trách.</p>
          </div>

          <div className="auth-grid">
            <label>
              Họ và tên <span>*</span>
              <input name="full_name" autoComplete="name" required />
            </label>
            <label>
              Số điện thoại <span>*</span>
              <input name="phone" type="tel" autoComplete="tel" required />
            </label>
            <label>
              Email <span>*</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Mật khẩu <span>*</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              Khu vực phụ trách chính <span>*</span>
              <select name="area" defaultValue="" required>
                <option value="" disabled>Chọn khu vực</option>
                {AGENT_AREAS.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </label>
            <label>
              Zalo <small>(không bắt buộc)</small>
              <input name="zalo" type="tel" />
            </label>
          </div>

          {message && (
            <div className={`auth-message auth-message--${success ? "success" : "error"}`}>
              {message}
            </div>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang đăng ký..." : "Đăng ký tài khoản"}
          </button>
          <p className="auth-card__footer">
            Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
