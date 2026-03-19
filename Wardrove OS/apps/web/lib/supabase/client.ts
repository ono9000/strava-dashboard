'use client'
import { createBrowserClient } from '@wardrobe-os/db'

let client: ReturnType<typeof createBrowserClient> | null = null

/** Singleton browser client — reuse across the component tree */
export function getSupabaseBrowserClient() {
  if (!client) client = createBrowserClient()
  return client
}
