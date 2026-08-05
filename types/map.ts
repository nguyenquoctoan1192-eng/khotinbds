import type { Listing } from "@/types/listing";

export type MapViewMode = "list" | "map" | "split";

export type MapPriceRange =
  | ""
  | "under20"
  | "20to40"
  | "40to80"
  | "over80"
  | "negotiable";

export type MapFrontageType = "frontage" | "car_alley" | "alley";

export type MapFilterState = {
  district: string;
  priceRange: MapPriceRange;
  minArea: string;
  bedrooms: string;
  frontageTypes: MapFrontageType[];
  newestOnly: boolean;
  business: string;
  minMatchScore: string;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapListingMeta = {
  score?: number | string | null;
  breakdown?: {
    district_score?: number;
    price_score?: number;
    area_score?: number;
    bedroom_score?: number;
    business_score?: number;
    matching_score?: number;
    final_score?: number;
    total_score?: number;
    reasons?: string[];
  };
  reasons?: string[];
};

export type PropertyMapListing = {
  id: string;
  listing: Listing;
  item: Listing & MapListingMeta;
  publicTitle: string;
  imageUrl: string;
  priceLabel: string;
  priceValue: number | null;
  areaLabel: string;
  areaValue: number | null;
  structureLabel: string;
  bedroomsLabel: string;
  bedroomsValue: number | null;
  districtLabel: string;
  streetLabel: string;
  frontageLabel: string;
  latitude: number;
  longitude: number;
  approximateLocation: boolean;
  matchScore: number | null;
  matchReasons: string[];
  updatedAt: string | null;
};
