import "server-only";

import { createSupabaseServiceClient } from "./supabaseServer";

const supabase = createSupabaseServiceClient();

export async function getCustomers() {
  return supabase
    .from("customers")
    .select("*");
}

export async function getCustomerDetail(id: string) {
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { customer: null, conversations: [], error };
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: true });

  return {
    customer,
    conversations: conversations ?? [],
    error: null,
  };
}