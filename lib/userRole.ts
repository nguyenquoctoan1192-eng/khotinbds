"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { normalizeProfileRole, type UserRole } from "@/lib/roles";
import type { ProfileStatus } from "@/lib/agentProfile";

export type { UserRole } from "@/lib/roles";

export const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export { normalizeProfileRole } from "@/lib/roles";

export const syncServerSession = async (
  accessToken?: string,
  signal?: AbortSignal
) => {
  return fetch("/api/auth/session", {
    method: accessToken ? "POST" : "DELETE",
    headers: accessToken ? { "Content-Type": "application/json" } : undefined,
    body: accessToken ? JSON.stringify({ accessToken }) : undefined,
    signal,
  });
};

export const getUserRole = async (user: User | null): Promise<UserRole> => {
  if (!user) return "customer";

  const { data, error } = await authClient
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Không tải được profile phân quyền:", error);
    return "customer";
  }

  if ((data.status as ProfileStatus) !== "approved") return "customer";
  return normalizeProfileRole(data.role);
};

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("customer");
  const [roleLoading, setRoleLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    const loadRole = async (user: User | null) => {
      if (active) setIsAuthenticated(Boolean(user));
      const nextRole = await getUserRole(user);
      if (!active) return;
      setRole(nextRole);
      setRoleLoading(false);
    };

    authClient.auth.getUser().then(({ data }) => loadRole(data.user));

    const { data: listener } = authClient.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") void syncServerSession();
      if (event === "TOKEN_REFRESHED" && session?.access_token) {
        void syncServerSession(session.access_token);
      }
      void loadRole(session?.user || null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { role, roleLoading, isAuthenticated };
}
