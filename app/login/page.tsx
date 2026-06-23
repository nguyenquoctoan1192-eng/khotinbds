"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNavbar from "@/app/components/site-navbar";
import { authClient, syncServerSession } from "@/lib/userRole";
import { normalizeProfileRole } from "@/lib/roles";

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Tài khoản của bạn đang chờ Admin xét duyệt.",
  rejected: "Tài khoản của bạn chưa được phê duyệt.",
  suspended: "Tài khoản của bạn đang bị tạm khóa.",
};

const LOGIN_TIMEOUT_MS = 8_000;
const LOGIN_TIMEOUT_MESSAGE =
  "Đăng nhập quá thời gian 8 giây. Vui lòng kiểm tra kết nối và thử lại.";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const controller = new AbortController();
    let timedOut = false;

    const clearLoginSession = async () => {
      await Promise.allSettled([authClient.auth.signOut(), syncServerSession()]);
    };

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
      setLoading(false);
      setMessage(LOGIN_TIMEOUT_MESSAGE);
      void clearLoginSession();
    }, LOGIN_TIMEOUT_MS);

    try {
      const { data: authData, error: authError } =
        await authClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (timedOut) {
        await clearLoginSession();
        return;
      }

      if (authError || !authData.user || !authData.session?.access_token) {
        setMessage("Email hoặc mật khẩu không đúng.");
        return;
      }

      const sessionPromise = syncServerSession(
        authData.session.access_token,
        controller.signal
      )
        .then((response) => ({ response, error: null as unknown }))
        .catch((error: unknown) => ({ response: null, error }));

      const profileResult = await authClient
        .from("profiles")
        .select("role, status")
        .eq("id", authData.user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      if (timedOut) {
        await sessionPromise;
        await clearLoginSession();
        return;
      }

      const { data: profile, error: profileError } = profileResult;

      if (profileError || !profile) {
        controller.abort();
        await sessionPromise;
        await clearLoginSession();
        setMessage("Không thể tải hồ sơ tài khoản. Vui lòng liên hệ Admin.");
        return;
      }

      const role = normalizeProfileRole(profile.role);
      const status = String(profile.status || "").trim();

      if (role !== "admin" && role !== "agent") {
        controller.abort();
        await sessionPromise;
        await clearLoginSession();
        setMessage("Tài khoản chưa được phân quyền. Vui lòng liên hệ Admin.");
        return;
      }

      if (status !== "approved") {
        controller.abort();
        await sessionPromise;
        await clearLoginSession();
        setMessage(
          STATUS_MESSAGES[status] || "Tài khoản của bạn chưa được phê duyệt."
        );
        return;
      }

      const sessionResult = await sessionPromise;

      if (timedOut) {
        await clearLoginSession();
        return;
      }

      if (sessionResult.error || !sessionResult.response?.ok) {
        await clearLoginSession();
        setMessage("Không thể tạo phiên đăng nhập. Vui lòng thử lại.");
        return;
      }

      if (role === "admin") {
        router.replace("/admin");
        router.refresh();
        return;
      }

      if (role === "agent") {
        router.replace("/agent");
        router.refresh();
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      if (timedOut) return;
      console.error("Đăng nhập thất bại:", error);
      await clearLoginSession();
      setMessage("Không thể đăng nhập. Vui lòng thử lại.");
    } finally {
      window.clearTimeout(timeoutId);
      if (!timedOut) setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <SiteNavbar />

      <main style={styles.main}>
        <form onSubmit={login} style={styles.form}>
          <div>
            <h1 style={styles.title}>Đăng nhập</h1>
            <p style={styles.subtitle}>Dành cho quản trị viên và môi giới.</p>
          </div>

          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </label>

          {message && <div style={styles.error}>{message}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <p style={styles.registerHint}>
            Chưa có tài khoản? <Link href="/register">Đăng ký môi giới</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f4f6" },
  main: {
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  form: {
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    background: "white",
    borderRadius: 16,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.1)",
    padding: 28,
  },
  title: { margin: 0, fontSize: 28 },
  subtitle: { margin: "6px 0 0", color: "#64748b" },
  label: { display: "flex", flexDirection: "column", gap: 7, fontWeight: 700 },
  input: { border: "1px solid #cbd5e1", borderRadius: 9, padding: 12 },
  error: {
    border: "1px solid #fecaca",
    borderRadius: 9,
    background: "#fef2f2",
    color: "#991b1b",
    padding: 11,
  },
  button: {
    border: "none",
    borderRadius: 9,
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    padding: 13,
  },
  registerHint: { margin: 0, textAlign: "center", color: "#64748b" },
};