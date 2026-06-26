export interface Customer {
  id: string;

  fullname: string;

  phone: string;

  email?: string | null;

  note?: string | null;

  status?: string | null;

  lead_score?: number | null;

  created_at?: string;
}