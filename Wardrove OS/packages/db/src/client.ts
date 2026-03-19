import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { SupportedStorage } from '@supabase/supabase-js'

function getEnvVars() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: SUPABASE_URL and SUPABASE_ANON_KEY required'
    )
  }
  return { url, anonKey }
}

/** For Next.js client components */
export function createBrowserClient() {
  const { url, anonKey } = getEnvVars()
  return _createBrowserClient(url, anonKey)
}

/** For Next.js server components, API routes, and middleware */
export function createServerClient(cookies: CookieMethodsServer) {
  const { url, anonKey } = getEnvVars()
  return _createServerClient(url, anonKey, { cookies })
}

/** For Expo mobile — plain supabase-js client, accepts custom storage (e.g. expo-secure-store) */
export function createMobileClient(storage?: SupportedStorage) {
  const { url, anonKey } = getEnvVars()
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      ...(storage ? { storage } : {}),
    },
  })
}
