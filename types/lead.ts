export type LeadStatus =
  | "Khách mới"
  | "Đang chăm sóc"
  | "Đã gửi nhà"
  | "Đã đi xem"
  | "Đang đàm phán"
  | "Đã chốt"
  | "Hủy"
  | string;

export interface Lead {
  id: string;
  fullname?: string | null;
  phone?: string | null;
  preferred_districts?: unknown;
  note?: string | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  min_area?: number | string | null;
  bedrooms?: number | string | null;
  status?: LeadStatus | null;
  lead_score?: number | null;
  lead_temperature?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: unknown;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: string;
  content: string;
  created_at?: string | null;

  [key: string]: unknown;
}