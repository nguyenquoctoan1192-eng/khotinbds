import { createClient, SupabaseClient } from "@supabase/supabase-js";
 
// Lazy-init: KHÔNG tạo client ngay lúc module được import (top-level),
// vì Next.js sẽ chạy dòng đó lúc build (prerender/collect page data).
// Nếu lúc build thiếu NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (vd build cho
// Preview environment mà biến chưa gán đủ), nó sẽ throw và sập cả build,
// dù route/trang đó chỉ thực sự cần supabase lúc có request/render thật.
//
// Proxy bên dưới hoãn việc gọi createClient() tới lần đầu tiên có ai đó
// thực sự dùng "supabase.something" (ví dụ supabase.from("profiles")),
// nên mọi chỗ đang import { supabase } from "@/lib/supabase" và gọi
// thẳng supabase.from(...) / supabase.auth... vẫn chạy y hệt như cũ,
// không cần sửa lại các file đó.
 
let _client: SupabaseClient | null = null;
 
function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 
    if (!url || !key) {
      throw new Error(
        "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
 
    _client = createClient(url, key);
  }
 
  return _client;
}
 
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
 
    // Nếu là method (vd .from, .rpc...), phải bind lại "this" về client
    // thật, nếu không gọi supabase.from(...) sẽ bị lỗi "this" undefined.
    if (typeof value === "function") {
      return value.bind(client);
    }
 
    return value;
  },
});
 