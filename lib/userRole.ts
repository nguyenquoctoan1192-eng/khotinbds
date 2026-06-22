"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

export type UserRole = "admin" | "broker" | "customer";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const normalizeRole = (value: unknown): UserRole | null => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return role === "admin" || role === "broker" || role === "customer"
    ? role
    : null;
};

export const getUserRole = (user: User | null): UserRole => {
  const trustedRole = normalizeRole(user?.app_metadata?.role);

  if (trustedRole === "admin" || trustedRole === "broker") return trustedRole;

  const profileRole = normalizeRole(user?.user_metadata?.role);
  return profileRole === "broker" ? "broker" : "customer";
};

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("customer");
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;

    authClient.auth.getUser().then(({ data }) => {
      if (!active) return;
      setRole(getUserRole(data.user));
      setRoleLoading(false);
    });

    const { data: listener } = authClient.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setRole(getUserRole(session?.user || null));
      setRoleLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { role, roleLoading };
}
