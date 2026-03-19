import * as SecureStore from 'expo-secure-store'
import { createMobileClient } from '@wardrobe-os/db'
import type { SupportedStorage } from '@supabase/supabase-js'

const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createMobileClient(ExpoSecureStoreAdapter)
