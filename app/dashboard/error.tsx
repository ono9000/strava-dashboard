'use client'

import { useT } from '@/lib/i18n/client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const t = useT()
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xl font-bold">{t.common.errorTitle}</p>
        <button
          onClick={reset}
          className="mt-4 px-6 py-2 bg-[#FC4C02] rounded-full text-sm font-semibold"
        >
          {t.common.retry}
        </button>
        <div className="mt-2">
          <a href="/" className="text-white/40 text-sm hover:text-white/70">
            {t.common.backHome}
          </a>
        </div>
      </div>
    </main>
  )
}
