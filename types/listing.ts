export interface Listing {
  id: string;

  title?: string | null;
  address?: string | null;
  location?: string | null;
  district?: string | null;
  street?: string | null;

  price?: number | string | null;
  area?: number | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  floors?: number | string | null;

  structure?: string | null;
  phone?: string | null;
  contact_phone?: string | null;

  commission?: string | number | null;
  hh?: string | number | null;
  internal_note?: string | null;

  status?: string | null;
  images?: string[] | null;

  description?: string | null;
  content?: string | null;
  note?: string | null;
  notes?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: unknown;
}