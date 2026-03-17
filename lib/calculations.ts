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

export interface HeatmapDay {
  date: string  // 'YYYY-MM-DD'
  km: number
}

export function getActivityHeatmap(
  activities: StravaSummaryActivity[],
  today?: Date
): HeatmapDay[][] {
  const now = today ?? new Date()

  // Build date → km map (runs only)
  const dayMap = new Map<string, number>()
  for (const a of activities) {
    if (a.sport_type !== 'Run') continue
    const d = new Date(a.start_date_local)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dayMap.set(key, (dayMap.get(key) ?? 0) + a.distance / 1000)
  }

  // Most recent Monday ≤ today
  const dow = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = dow === 0 ? 6 : dow - 1
  const recentMonday = new Date(now)
  recentMonday.setDate(now.getDate() - daysToMonday)
  recentMonday.setHours(0, 0, 0, 0)

  // Start of the 52-week window (51 weeks before recentMonday)
  const startMonday = new Date(recentMonday)
  startMonday.setDate(recentMonday.getDate() - 51 * 7)

  // today at midnight for future-day comparison
  const todayMidnight = new Date(now)
  todayMidnight.setHours(0, 0, 0, 0)

  const grid: HeatmapDay[][] = []
  for (let week = 0; week < 52; week++) {
    const weekDays: HeatmapDay[] = []
    for (let day = 0; day < 7; day++) {
      const date = new Date(startMonday)
      date.setDate(startMonday.getDate() + week * 7 + day)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const km = date > todayMidnight ? 0 : (dayMap.get(dateStr) ?? 0)
      weekDays.push({ date: dateStr, km })
    }
    grid.push(weekDays)
  }
  return grid
}

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface MonthlyKmData {
  month: number        // 0–11
  label: string
  currentYear: number  // km
  prevYear: number     // km
}

export function getMonthlyKm(
  activities: StravaSummaryActivity[],
  today?: Date
): MonthlyKmData[] {
  const now = today ?? new Date()
  const currentYear = now.getFullYear()
  const prevYear = currentYear - 1

  const current = new Array<number>(12).fill(0)
  const prev = new Array<number>(12).fill(0)

  for (const a of activities) {
    if (a.sport_type !== 'Run') continue
    const d = new Date(a.start_date_local)
    const year = d.getFullYear()
    const month = d.getMonth()
    if (year === currentYear) current[month] += a.distance / 1000
    else if (year === prevYear) prev[month] += a.distance / 1000
  }

  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    label: MONTH_SHORT[i],
    currentYear: current[i],
    prevYear: prev[i],
  }))
}

export interface TopPerf {
  icon: string
  label: string
  value: string
  sub: string
}

function fmtActivityDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getTopPerformances(activities: StravaSummaryActivity[]): TopPerf[] {
  const runs = activities.filter((a) => a.sport_type === 'Run')
  if (runs.length === 0) return []

  const result: TopPerf[] = []

  // Longest run
  const longest = runs.reduce((best, a) => (a.distance > best.distance ? a : best))
  result.push({
    icon: '📏',
    label: 'Carrera más larga',
    value: `${(longest.distance / 1000).toFixed(1)} km`,
    sub: `${longest.name} · ${fmtActivityDate(longest.start_date_local)}`,
  })

  // Best pace — fastest average pace among runs ≥ 5 km
  const longRuns = runs.filter((a) => a.distance >= 5000)
  if (longRuns.length > 0) {
    const fastest = longRuns.reduce((best, a) =>
      a.moving_time / a.distance < best.moving_time / best.distance ? a : best
    )
    result.push({
      icon: '⚡',
      label: 'Mejor ritmo',
      value: formatPace(fastest.moving_time, fastest.distance),
      sub: `${(fastest.distance / 1000).toFixed(1)} km · ${fmtActivityDate(fastest.start_date_local)}`,
    })
  }

  // Most elevation
  const mostElev = runs.reduce((best, a) =>
    a.total_elevation_gain > best.total_elevation_gain ? a : best
  )
  result.push({
    icon: '⛰️',
    label: 'Más desnivel',
    value: `${Math.round(mostElev.total_elevation_gain)} m`,
    sub: `${(mostElev.distance / 1000).toFixed(1)} km · ${fmtActivityDate(mostElev.start_date_local)}`,
  })

  return result
}

const SPORT_ICONS: Record<string, string> = {
  Ride: '🚴', Walk: '🚶', Hike: '🥾', Swim: '🏊',
  Tennis: '🎾', Basketball: '🏀', WeightTraining: '🏋️',
  Yoga: '🧘', VirtualRide: '🚴', EBikeRide: '⚡',
  Soccer: '⚽', Rowing: '🚣', Crossfit: '💪',
  Elliptical: '🔄', StairStepper: '🏃', RockClimbing: '🧗',
}

export interface SportSummary {
  sportType: string
  count: number
  totalHours: number
  icon: string
}

export function getSportBreakdown(activities: StravaSummaryActivity[]): SportSummary[] {
  const map = new Map<string, { count: number; totalTime: number }>()
  for (const a of activities) {
    if (a.sport_type === 'Run') continue
    const entry = map.get(a.sport_type)
    if (entry) {
      entry.count++
      entry.totalTime += a.moving_time
    } else {
      map.set(a.sport_type, { count: 1, totalTime: a.moving_time })
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([sportType, { count, totalTime }]) => ({
      sportType,
      count,
      totalHours: totalTime / 3600,
      icon: SPORT_ICONS[sportType] ?? '🏅',
    }))
}
