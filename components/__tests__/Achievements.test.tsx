import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/lib/i18n/client'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

import Achievements from '../Achievements'
import type { StravaActivityTotals, StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'

const baseTotals: StravaActivityTotals = {
  count: 10,
  distance: 150_000,   // 150 km
  moving_time: 54000,
  elapsed_time: 60000,
  elevation_gain: 500,
}

const baseActivity: StravaSummaryActivity = {
  id: 1,
  name: 'Run',
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1600,
  total_elevation_gain: 50,
  sport_type: 'Run',
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T09:00:00+01:00',
  map: null,
}

const bestMarks: { bestWeek: PeriodBest; bestMonth: PeriodBest; [key: string]: unknown } = {
  bestWeek: { totalKm: 0, label: '' },
  bestMonth: { totalKm: 0, label: '' },
}

describe('Achievements — badge progress', () => {
  it('shows "faltan X km" for a locked km badge', () => {
    // 150 km total — "Primeros 500 km" badge is locked, needs 350 more
    localStorage.setItem('lang', 'es')
    render(
      <LanguageProvider initialLang="es">
        <Achievements
          totals={baseTotals}
          activities={[baseActivity]}
          bestMarks={bestMarks}
        />
      </LanguageProvider>
    )
    expect(screen.getByText(/faltan 350 km/i)).toBeInTheDocument()
  })

  it('does not show "faltan" text for an unlocked badge', () => {
    // 150 km — "Primeros 100 km" is unlocked
    localStorage.setItem('lang', 'es')
    render(
      <LanguageProvider initialLang="es">
        <Achievements
          totals={baseTotals}
          activities={[baseActivity]}
          bestMarks={bestMarks}
        />
      </LanguageProvider>
    )
    // 100 km badge is unlocked — no "faltan" text for it
    const faltan100 = screen.queryByText(/faltan 0 km/i)
    expect(faltan100).not.toBeInTheDocument()
  })
})
