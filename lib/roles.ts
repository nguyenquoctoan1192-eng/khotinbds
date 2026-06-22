export type UserRole = "admin" | "broker" | "customer";

export const normalizeProfileRole = (value: unknown): UserRole => {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (role === "admin") return "admin";
  if (role === "agent" || role === "broker") return "broker";
  return "customer";
};
