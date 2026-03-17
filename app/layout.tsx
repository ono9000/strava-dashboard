import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getLangFromCookies } from '@/lib/i18n/server'
import { LanguageProvider } from '@/lib/i18n/client'
import { messages } from '@/lib/i18n/messages'
import LanguageToggle from '@/components/LanguageToggle'

const inter = Inter({ subsets: ['latin'] })

export function generateMetadata(): Metadata {
  const lang = getLangFromCookies()
  const m = messages[lang]
  return {
    title: m.meta.title,
    description: m.meta.description,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLangFromCookies()
  const m = messages[lang]

  return (
    <html lang={lang}>
      <body className={`${inter.className} bg-[#0f0f0f] antialiased`}>
        <LanguageProvider initialLang={lang}>
          <header className="mx-auto max-w-5xl px-4 pt-5 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40 hidden sm:block">
                {m.meta.description}
              </span>
              <LanguageToggle />
            </div>
          </header>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
