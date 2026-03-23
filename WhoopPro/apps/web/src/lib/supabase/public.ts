import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export function getSupabasePublicClient() {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
