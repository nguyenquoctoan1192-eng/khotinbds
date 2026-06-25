"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";
import { authClient } from "@/lib/userRole";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await authClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setMessage("Không gửi được email đặt lại mật khẩu. Vui lòng thử lại.");
      return;
    }

    setMessage("Đã gửi link đặt lại mật khẩu vào email của bạn.");
  };

  return (
    <div className="auth-page">
      <SiteNavbar />

      <main className="auth-page__main">
        <form onSubmit={submit} className="auth-card">
          <div>
            <h1>Quên mật khẩu</h1>
            <p>Nhập email tài khoản môi giới để nhận link đặt lại mật khẩu.</p>
          </div>

          <div className="auth-grid">
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
              />
            </label>
          </div>

          {message && <div className="auth-message">{message}</div>}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
          </button>

          <p className="auth-card__footer">
            <Link href="/login">Quay lại đăng nhập</Link>
          </p>
        </form>
      </main>
    </div>
  );
}