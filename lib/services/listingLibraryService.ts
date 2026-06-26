import "server-only";

import { createSupabaseServiceClient } from "./supabaseServer";

const supabase = createSupabaseServiceClient();

export function listingLibraryQuery() {
  return supabase.from("listing_library");
}

export async function getListingLibraryItem(id: string) {
  return listingLibraryQuery()
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
}