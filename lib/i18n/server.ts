import { cookies } from 'next/headers'
import { DEFAULT_LANG, isLanguage, LANG_COOKIE, type Language } from './types'
import { messages, type Messages } from './messages'

export function getLangFromCookies(): Language {
  const v = cookies().get(LANG_COOKIE)?.value
  return isLanguage(v) ? v : DEFAULT_LANG
}

export function getServerMessages(lang?: Language): Messages {
  const resolved = lang ?? getLangFromCookies()
  return messages[resolved]
}

