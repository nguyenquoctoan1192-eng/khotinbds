import { normalizeVietnameseText } from "./text.ts";

const escalationKeywords = [
  "khieu nai",
  "buc minh",
  "noi nong",
  "hop dong",
  "phap ly",
  "so do",
  "tranh chap",
  "thuong luong",
  "dam phan",
  "30 phut",
  "gap trong",
  "xem nha ngay",
  "xem ngay",
  "xem gap",
];

export const escalationReply =
  "Dạ để đảm bảo chính xác nhất, em xin phép chuyển thông tin này cho anh/chị quản lý bên em liên hệ trực tiếp với mình nhé ạ.";

export function detectEscalation(message: string): boolean {
  const text = normalizeVietnameseText(message);

  return escalationKeywords.some((keyword) => text.includes(keyword));
}
