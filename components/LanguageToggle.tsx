'use client'

import { useLang } from '@/lib/i18n/client'
import type { Language } from '@/lib/i18n/types'

function ToggleButton({
  lang,
  selected,
  onClick,
}: {
  lang: Language
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
        selected
          ? 'bg-white/15 text-white'
          : 'bg-transparent text-white/50 hover:text-white/80 hover:bg-white/10',
      ].join(' ')}
      aria-pressed={selected}
    >
      {lang.toUpperCase()}
    </button>
  )
}

export default function LanguageToggle() {
  const { lang, setLang } = useLang()

  return (
    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
      <ToggleButton lang="es" selected={lang === 'es'} onClick={() => void setLang('es')} />
      <ToggleButton lang="en" selected={lang === 'en'} onClick={() => void setLang('en')} />
    </div>
  )
}

