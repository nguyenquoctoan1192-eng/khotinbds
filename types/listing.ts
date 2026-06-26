export interface Listing {
  id: string;

  title: string;

  address: string | null;

  district: string | null;

  street: string | null;

  price: number | null;

  area: number | null;

  bedrooms: number | null;

  structure: string | null;

  phone: string | null;

  status: string | null;

  images: string[];

  description: string | null;

  created_at?: string;

  updated_at?: string;
}