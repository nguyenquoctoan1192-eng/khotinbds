import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccess } from "@/lib/access";
import { AGENT_AREAS, isProfileStatus } from "@/lib/agentProfile";

// Type tối thiểu cho bảng profiles, đủ để .update()/.select() không bị suy ra "never".
// Nếu sau này cần đầy đủ, có thể thay bằng Database generate từ supabase CLI.
type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  zalo: string | null;
  email: string | null;
  area: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type MinimalDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
      };
    };
  };
};

let _supabase: ReturnType<typeof createClient<MinimalDatabase>> | null = null;

function getSupabaseAdmin() {
  if (!_supabase) {
    _supabase = createClient<MinimalDatabase>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ... phần còn lại của file giữ nguyên, không cần sửa gì thêm ...