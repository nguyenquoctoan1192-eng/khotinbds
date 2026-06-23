export type UserRole = "admin" | "agent" | "customer";

export const normalizeProfileRole = (value: unknown): UserRole => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (role === "admin") return "admin";
  if (role === "agent" || role === "broker") return "agent";
  return "customer";
};
