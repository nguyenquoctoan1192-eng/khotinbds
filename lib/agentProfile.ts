export const AGENT_AREAS = [
  "Quận 1",
  "Quận 2",
  "Quận 3",
  "Quận 4",
  "Quận 5",
  "Quận 6",
  "Quận 7",
  "Quận 8",
  "Quận 9",
  "Quận 10",
  "Quận 11",
  "Quận 12",
  "Bình Thạnh",
  "Phú Nhuận",
  "Tân Bình",
  "Gò Vấp",
  "Bình Tân",
  "Tân Phú",
  "Bình Chánh",
  "Thủ Đức",
  "Các khu vực khác",
] as const;

export const PROFILE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;

export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  suspended: "Tạm khóa",
};

export const isProfileStatus = (value: unknown): value is ProfileStatus =>
  typeof value === "string" &&
  PROFILE_STATUSES.includes(value as ProfileStatus);
