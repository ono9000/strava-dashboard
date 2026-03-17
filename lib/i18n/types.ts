export const LANG_COOKIE = 'lang' as const

export type Language = 'es' | 'en'

export const DEFAULT_LANG: Language = 'es'

export function isLanguage(v: unknown): v is Language {
  return v === 'es' || v === 'en'
}

