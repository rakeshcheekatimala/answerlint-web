import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAdminConfig } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const { url, key } = requireSupabaseAdminConfig();

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
