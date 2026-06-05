import { supabase } from "../lib/supabase"

export async function getListings() {

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.log(error)
    return []
  }

  return data || []
}