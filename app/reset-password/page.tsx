"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";
import { authClient } from "@/lib/userRole";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Mật khẩu nhập lại không khớp.");
      return;
    }

    setLoading(true);

    const { error } = await authClient.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessage("Không thể cập nhật mật khẩu. Link có thể đã hết hạn.");
      return;
    }

    setMessage("Đổi mật khẩu thành công. Bạn có thể đăng nhập lại.");
  };

  return (
    <div className="auth-page">
      <SiteNavbar />

      <main className="auth-page__main">
        <form onSubmit={submit} className="auth-card">
          <div>
            <h1>Đặt lại mật khẩu</h1>
            <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
          </div>

          <div className="auth-grid">
            <label>
              Mật khẩu mới
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label>
              Nhập lại mật khẩu
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          </div>

          {message && <div className="auth-message">{message}</div>}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
          </button>

          <p className="auth-card__footer">
            <Link href="/login">Quay lại đăng nhập</Link>
          </p>
        </form>
      </main>
    </div>
  );
}