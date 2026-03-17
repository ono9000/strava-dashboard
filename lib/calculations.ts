import type { StravaSummaryActivity } from '@/types/strava'

export function formatPace(movingTimeSec: number, distanceMeters: number): string {
  if (distanceMeters === 0) return '—'
  const secPerKm = (movingTimeSec / distanceMeters) * 1000
  const minutes = Math.floor(secPerKm / 60)
  const seconds = Math.round(secPerKm % 60)
  return `${minutes}'${String(seconds).padStart(2, '0')}"/km`
}

export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function formatElevation(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function getPrimarySport(activities: StravaSummaryActivity[]): string {
  if (activities.length === 0) return '—'
  const counts: Record<string, number> = {}
  for (const a of activities) {
    counts[a.sport_type] = (counts[a.sport_type] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function getBestForDistance(
  activities: StravaSummaryActivity[],
  minMeters: number,
  maxMeters: number
): StravaSummaryActivity | null {
  const candidates = activities.filter(
    (a) => a.distance >= minMeters && a.distance <= maxMeters
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, a) =>
    a.moving_time < best.moving_time ? a : best
  )
}

function getISOWeekKey(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr)
  const day = d.getDay() || 7 // Sunday = 7
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + (4 - day))
  const year = thursday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(
    ((thursday.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7
  )
  return {
    key: `${year}-W${String(weekNum).padStart(2, '0')}`,
    label: `Semana ${weekNum}, ${year}`,
  }
}

export interface PeriodBest {
  totalKm: number
  label: string
}

export function getBestWeek(activities: StravaSummaryActivity[]): PeriodBest {
  if (activities.length === 0) return { totalKm: 0, label: '' }
  const byWeek: Record<string, { totalM: number; label: string }> = {}
  for (const a of activities) {
    const { key, label } = getISOWeekKey(a.start_date_local)
    if (!byWeek[key]) byWeek[key] = { totalM: 0, label }
    byWeek[key].totalM += a.distance
  }
  const best = Object.values(byWeek).reduce((b, w) =>
    w.totalM > b.totalM ? w : b
  )
  return { totalKm: best.totalM / 1000, label: best.label }
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function getBestMonth(activities: StravaSummaryActivity[]): PeriodBest {
  if (activities.length === 0) return { totalKm: 0, label: '' }
  const byMonth: Record<string, { totalM: number; label: string }> = {}
  for (const a of activities) {
    const d = new Date(a.start_date_local)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = `${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`
    if (!byMonth[key]) byMonth[key] = { totalM: 0, label }
    byMonth[key].totalM += a.distance
  }
  const best = Object.values(byMonth).reduce((b, m) =>
    m.totalM > b.totalM ? m : b
  )
  return { totalKm: best.totalM / 1000, label: best.label }
}

export interface FunFacts {
  caminoLaps: number
  teideLaps: number
  marathons: number
  retiroLaps: number
}

export function computeFunFacts(totalKm: number, totalElevationM: number): FunFacts {
  return {
    caminoLaps: Math.round((totalKm / 780) * 10) / 10,
    teideLaps: Math.round((totalElevationM / 3718) * 10) / 10,
    marathons: Math.round((totalKm / 42.195) * 10) / 10,
    retiroLaps: Math.round(totalKm / 3.2),
  }
}
