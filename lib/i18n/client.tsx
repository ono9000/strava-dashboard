'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLanguage, type Language } from './types'
import { messages, type Messages } from './messages'

type LanguageContextValue = {
  lang: Language
  messages: Messages
  setLang: (lang: Language) => Promise<void>
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectBrowserLang(): Language {
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  const base = nav.split('-')[0]?.toLowerCase()
  return base === 'en' ? 'en' : 'es'
}

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Language
  children: React.ReactNode
}) {
  const router = useRouter()
  const [lang, setLangState] = useState<Language>(initialLang)

  const setLang = useCallback(
    async (next: Language) => {
      setLangState(next)
      try {
        localStorage.setItem('lang', next)
      } catch {
        // ignore
      }

      await fetch('/api/i18n/lang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: next }),
      })

      router.refresh()
    },
    [router]
  )

  // If server didn't have cookie yet, bootstrap from localStorage / browser lang.
  useEffect(() => {
    if (lang !== initialLang) return

    let stored: string | null = null
    try {
      stored = localStorage.getItem('lang')
    } catch {
      stored = null
    }

    const candidate = isLanguage(stored) ? stored : detectBrowserLang()
    if (candidate !== lang) {
      void setLang(candidate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, messages: messages[lang], setLang }),
    [lang, setLang]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within <LanguageProvider>')
  return ctx
}

export function useT(): Messages {
  return useLang().messages
}

