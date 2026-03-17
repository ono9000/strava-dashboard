# Phase 3 Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features to the Strava Dashboard: geocoding precision fix, activity heatmap, monthly km chart, top performances cards, country coloring on the map, sport breakdown, and running partners.

**Architecture:** Pure calculation functions live in `lib/calculations.ts` and are tested; display components receive pre-computed data (or the full `activities` array) as props; server-side data fetching (kudos) and wiring happen in `app/dashboard/page.tsx`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, SVG (charts/heatmap), react-leaflet v4, world-atlas + topojson-client + i18n-iso-countries (country fill), Strava API v3.

---

## File Structure

| File | Role |
|---|---|
| `types/strava.ts` | Add `athlete_count?` + `SummaryAthlete` interface |
| `lib/strava.ts` | Add `getActivityKudos` |
| `lib/calculations.ts` | Add 4 new pure functions |
| `lib/__tests__/calculations.test.ts` | Tests for 4 new functions |
| `components/ActivityHeatmap.tsx` | `'use client'` — 52×7 SVG heatmap |
| `components/MonthlyChart.tsx` | Server Component — SVG bar chart |
| `components/TopPerformances.tsx` | Server Component — 3 highlight cards |
| `components/SportBreakdown.tsx` | Server Component — sport chips |
| `components/RunningPartners.tsx` | Server Component — partner cards |
| `components/RouteMap.tsx` | Fix `roundCoord` + add GeoJSON country layer |
| `app/dashboard/page.tsx` | Wire all new components + kudos fetch |

---

## Chunk 1: Foundation

### Task 1: Types + API

**Files:**
- Modify: `types/strava.ts`
- Modify: `lib/strava.ts`

No unit tests for HTTP functions. Build validation is the test.

- [ ] **Step 1: Add `athlete_count` and `SummaryAthlete` to `types/strava.ts`**

Open `types/strava.ts`. Add `athlete_count?` to `StravaSummaryActivity` and add the new `SummaryAthlete` interface:

```ts
export interface StravaSummaryActivity {
  id: number
  name: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  sport_type: string
  start_date: string
  start_date_local: string
  athlete_count?: number  // number of athletes; >1 means group run
  map: {
    summary_polyline: string
  } | null
}

// add after StravaTokenResponse:
export interface SummaryAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string  // photo URL
}
```

- [ ] **Step 2: Add `SummaryAthlete` import + `getActivityKudos` to `lib/strava.ts`**

Update the import block at the top of `lib/strava.ts`:

```ts
import type {
  StravaAthlete,
  StravaStats,
  StravaSummaryActivity,
  StravaSession,
  SummaryAthlete,
} from '@/types/strava'
```

Add after `getAllActivities`:

```ts
export async function getActivityKudos(
  token: string,
  activityId: number
): Promise<SummaryAthlete[]> {
  return stravaFetch<SummaryAthlete[]>(
    `/activities/${activityId}/kudos?per_page=200`,
    token
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/strava.ts lib/strava.ts
git commit -m "feat: add SummaryAthlete type and getActivityKudos"
```

---

### Task 2: Calculation functions + tests

**Files:**
- Modify: `lib/calculations.ts`
- Modify: `lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests for `getActivityHeatmap`**

Add to `lib/__tests__/calculations.test.ts`. **Replace** (do not append to) the existing import block at the top of the file with this complete merged version — it keeps all existing imports and adds 4 new ones:

```ts
import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
  getActivityHeatmap,
  getMonthlyKm,
  getTopPerformances,
  getSportBreakdown,
} from '../calculations'
import type { StravaSummaryActivity } from '@/types/strava'
```

The `import type { StravaSummaryActivity }` line is already in the file — keep it as-is.

Then add at the bottom of the file:

```ts
describe('getActivityHeatmap', () => {
  const TODAY = new Date('2026-03-17')  // Tuesday

  it('returns 52×7 grid of zeros for empty activities', () => {
    const grid = getActivityHeatmap([], TODAY)
    expect(grid).toHaveLength(52)
    grid.forEach((week) => {
      expect(week).toHaveLength(7)
      week.forEach((day) => expect(day.km).toBe(0))
    })
  })

  it('places a run on the correct cell', () => {
    const run = makeActivity({ distance: 10000, start_date_local: '2026-03-16T09:00:00' })
    const grid = getActivityHeatmap([run], TODAY)
    // With today=2026-03-17 (Tue), recentMonday=2026-03-16
    // grid[51][0] = Mon 2026-03-16
    expect(grid[51][0].date).toBe('2026-03-16')
    expect(grid[51][0].km).toBeCloseTo(10, 1)
  })

  it('sums multiple runs on the same day', () => {
    const a1 = makeActivity({ distance: 5000, start_date_local: '2026-03-16T08:00:00' })
    const a2 = makeActivity({ distance: 3000, start_date_local: '2026-03-16T18:00:00' })
    const grid = getActivityHeatmap([a1, a2], TODAY)
    expect(grid[51][0].km).toBeCloseTo(8, 1)
  })

  it('excludes non-Run activities', () => {
    const ride = makeActivity({ sport_type: 'Ride', distance: 50000, start_date_local: '2026-03-16T09:00:00' })
    const grid = getActivityHeatmap([ride], TODAY)
    expect(grid[51][0].km).toBe(0)
  })

  it('partial week: future days after today are zero', () => {
    // today = Tuesday 2026-03-17; grid[51] = Mon 16 through Sun 22
    // Wed 2026-03-18 is in the future → km = 0
    const futureRun = makeActivity({ distance: 8000, start_date_local: '2026-03-18T09:00:00' })
    const grid = getActivityHeatmap([futureRun], TODAY)
    // grid[51][0] = Mon Mar 16, grid[51][1] = Tue Mar 17, grid[51][2] = Wed Mar 18 (future)
    expect(grid[51][2].date).toBe('2026-03-18')
    expect(grid[51][2].km).toBe(0)
    // grid[51][3..6] are also future
    expect(grid[51][3].km).toBe(0)
  })
})

describe('getMonthlyKm', () => {
  const TODAY = new Date('2026-03-17')  // currentYear=2026, prevYear=2025

  it('returns 12 entries all zero for empty activities', () => {
    const data = getMonthlyKm([], TODAY)
    expect(data).toHaveLength(12)
    data.forEach((d) => {
      expect(d.currentYear).toBe(0)
      expect(d.prevYear).toBe(0)
    })
  })

  it('places a current-year run in the correct month', () => {
    const run = makeActivity({ distance: 15000, start_date_local: '2026-02-15T09:00:00' })
    const data = getMonthlyKm([run], TODAY)
    expect(data[1].currentYear).toBeCloseTo(15, 1)  // February = index 1
    expect(data[1].prevYear).toBe(0)
  })

  it('places a prev-year run in the correct month', () => {
    const run = makeActivity({ distance: 10000, start_date_local: '2025-06-10T09:00:00' })
    const data = getMonthlyKm([run], TODAY)
    expect(data[5].prevYear).toBeCloseTo(10, 1)  // June = index 5
    expect(data[5].currentYear).toBe(0)
  })

  it('excludes non-Run activities', () => {
    const ride = makeActivity({ sport_type: 'Ride', distance: 100000, start_date_local: '2026-02-15T09:00:00' })
    const data = getMonthlyKm([ride], TODAY)
    expect(data[1].currentYear).toBe(0)
  })
})

describe('getTopPerformances', () => {
  it('returns empty array for empty activities', () => {
    expect(getTopPerformances([])).toHaveLength(0)
  })

  it('returns longest run card', () => {
    const short = makeActivity({ id: 1, distance: 3000 })
    const long_ = makeActivity({ id: 2, distance: 21000 })
    const perfs = getTopPerformances([short, long_])
    const longest = perfs.find((p) => p.label === 'Carrera más larga')
    expect(longest).toBeDefined()
    expect(longest!.value).toBe('21.0 km')
  })

  it('omits pace card when no run is >= 5km', () => {
    const run = makeActivity({ distance: 3000, moving_time: 900 })
    const perfs = getTopPerformances([run])
    expect(perfs.find((p) => p.label === 'Mejor ritmo')).toBeUndefined()
  })

  it('returns pace card for the fastest run >= 5km by pace (not just speed)', () => {
    // run1: 5km in 25min = 5'00"/km
    // run2: 5km in 22min = 4'24"/km  ← faster
    const run1 = makeActivity({ id: 1, distance: 5000, moving_time: 1500 })
    const run2 = makeActivity({ id: 2, distance: 5000, moving_time: 1320 })
    const perfs = getTopPerformances([run1, run2])
    const pace = perfs.find((p) => p.label === 'Mejor ritmo')
    expect(pace).toBeDefined()
    expect(pace!.value).toBe("4'24\"/km")
  })

  it('returns elevation card', () => {
    const run = makeActivity({ total_elevation_gain: 500, distance: 10000 })
    const perfs = getTopPerformances([run])
    const elev = perfs.find((p) => p.label === 'Más desnivel')
    expect(elev).toBeDefined()
    expect(elev!.value).toBe('500 m')
  })
})

describe('getSportBreakdown', () => {
  it('returns empty array for empty activities', () => {
    expect(getSportBreakdown([])).toHaveLength(0)
  })

  it('returns empty array when all activities are Run', () => {
    const runs = [makeActivity({}), makeActivity({})]
    expect(getSportBreakdown(runs)).toHaveLength(0)
  })

  it('groups non-Run activities by sport_type and excludes Run', () => {
    const activities = [
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Basketball', moving_time: 5400 }),
    ]
    const result = getSportBreakdown(activities)
    expect(result).toHaveLength(2)
    expect(result[0].sportType).toBe('Tennis')
    expect(result[0].count).toBe(2)
    expect(result[0].icon).toBe('🎾')
    expect(result[1].sportType).toBe('Basketball')
  })

  it('sorts by count descending', () => {
    const activities = [
      makeActivity({ sport_type: 'Swim', moving_time: 1800 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
    ]
    const result = getSportBreakdown(activities)
    expect(result[0].sportType).toBe('Tennis')
    expect(result[0].count).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest lib/__tests__/calculations.test.ts --no-coverage 2>&1 | tail -20
```

Expected: the **entire test file fails to load** with an error like:
```
SyntaxError: The requested module '../calculations' does not provide an export named 'getActivityHeatmap'
```
This is correct TDD red state. The existing tests will also appear to fail (because the module fails to load before any test runs) — this is expected at this stage. Once the 4 new functions are exported from `calculations.ts`, both old and new tests will run normally.

- [ ] **Step 3: Implement `getActivityHeatmap` in `lib/calculations.ts`**

Add after `computeFunFacts`:

```ts
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
```

- [ ] **Step 4: Implement `getMonthlyKm` in `lib/calculations.ts`**

Add after `getActivityHeatmap`. Note: `MONTH_SHORT` below is a **new** module-level constant distinct from the existing `MONTH_NAMES_ES` (which contains full Spanish names like 'Enero'). Do not rename or import it from other files.

```ts
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
```

- [ ] **Step 5: Implement `getTopPerformances` in `lib/calculations.ts`**

Add after `getMonthlyKm` (reuse the existing `formatPace` import — it's in the same file):

```ts
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
```

- [ ] **Step 6: Implement `getSportBreakdown` in `lib/calculations.ts`**

Add after `getTopPerformances`:

```ts
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
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([sportType, { count, totalTime }]) => ({
      sportType,
      count,
      totalHours: totalTime / 3600,
      icon: SPORT_ICONS[sportType] ?? '🏅',
    }))
}
```

- [ ] **Step 7: Run tests and verify all pass**

```bash
npx jest lib/__tests__/calculations.test.ts --no-coverage 2>&1 | tail -30
```

Expected: all existing tests + new tests PASS. If any fail, fix the implementation.

- [ ] **Step 8: Commit**

```bash
git add lib/calculations.ts lib/__tests__/calculations.test.ts
git commit -m "feat: add heatmap, monthly, top-perf and sport-breakdown calculations"
```

---

## Chunk 2: Display Components

### Task 3: ActivityHeatmap component

**Files:**
- Create: `components/ActivityHeatmap.tsx`

- [ ] **Step 1: Create `components/ActivityHeatmap.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { getActivityHeatmap } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

const MONTH_SHORT_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function cellColor(km: number): string {
  if (km === 0) return '#1a1a1a'
  if (km <= 5) return '#FC4C0240'
  if (km <= 15) return '#FC4C0280'
  return '#FC4C02'
}

export default function ActivityHeatmap({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const grid = useMemo(() => getActivityHeatmap(activities), [activities])

  // Build month labels: show label at the first week whose Monday is in a new month
  const monthLabels: { label: string; col: number }[] = []
  for (let w = 0; w < 52; w++) {
    const d = new Date(grid[w][0].date)
    if (d.getDate() <= 7) {
      const label = MONTH_SHORT_ES[d.getMonth()]
      const last = monthLabels[monthLabels.length - 1]
      if (!last || last.label !== label) {
        monthLabels.push({ label, col: w })
      }
    }
  }

  const CELL = 11
  const GAP = 2
  const LEFT = 16
  const TOP = 20

  return (
    <div className="overflow-x-auto">
      <svg
        width={LEFT + 52 * (CELL + GAP)}
        height={TOP + 7 * (CELL + GAP) + 4}
        aria-label="Actividad de las últimas 52 semanas"
      >
        {/* Month labels */}
        {monthLabels.map(({ label, col }) => (
          <text
            key={`m-${label}-${col}`}
            x={LEFT + col * (CELL + GAP)}
            y={12}
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
          >
            {label}
          </text>
        ))}
        {/* Day labels (only odd rows to avoid crowding) */}
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((lbl, row) =>
          row % 2 === 1 ? (
            <text
              key={`d-${row}`}
              x={0}
              y={TOP + row * (CELL + GAP) + CELL - 1}
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
            >
              {lbl}
            </text>
          ) : null
        )}
        {/* Cells */}
        {grid.map((week, w) =>
          week.map((day, d) => {
            const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
            const tooltip =
              day.km > 0
                ? `${day.km.toFixed(1)} km — ${dateLabel}`
                : `Sin actividad — ${dateLabel}`
            return (
              <rect
                key={`${w}-${d}`}
                x={LEFT + w * (CELL + GAP)}
                y={TOP + d * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={cellColor(day.km)}
              >
                <title>{tooltip}</title>
              </rect>
            )
          })
        )}
      </svg>
    </div>
  )
}
```

Note on date parsing: `new Date(day.date + 'T12:00:00')` prevents timezone-offset midnight issues that would shift the displayed date by one day in some locales.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ActivityHeatmap.tsx
git commit -m "feat: add ActivityHeatmap component"
```

---

### Task 4: MonthlyChart component

**Files:**
- Create: `components/MonthlyChart.tsx`

- [ ] **Step 1: Create `components/MonthlyChart.tsx`**

```tsx
import { getMonthlyKm } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

export default function MonthlyChart({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const prevYear = currentYear - 1
  const data = getMonthlyKm(activities, today)

  const allValues = data.flatMap((d) => [d.currentYear, d.prevYear])
  const maxKm = Math.max(...allValues, 1)

  const VW = 600
  const VH = 180
  const PAD_L = 40
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 28
  const CHART_W = VW - PAD_L - PAD_R  // 544
  const CHART_H = VH - PAD_T - PAD_B  // 136

  const slotW = CHART_W / 12
  const pairW = slotW * 0.6
  const barW = (pairW - 2) / 2

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      aria-label={`Kilómetros por mes ${prevYear} y ${currentYear}`}
    >
      {/* Y-axis guide lines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD_T + CHART_H * (1 - frac)
        return (
          <g key={frac}>
            <line
              x1={PAD_L}
              y1={y}
              x2={VW - PAD_R}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 4}
              y={y + 3}
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
              textAnchor="end"
            >
              {Math.round(maxKm * frac)}
            </text>
          </g>
        )
      })}

      {/* Bars + labels */}
      {data.map((d, i) => {
        const pairX = PAD_L + i * slotW + (slotW - pairW) / 2
        const prevH = (d.prevYear / maxKm) * CHART_H
        const currH = (d.currentYear / maxKm) * CHART_H
        const labelX = PAD_L + i * slotW + slotW / 2
        return (
          <g key={i}>
            {d.prevYear > 0 && (
              <rect
                x={pairX}
                y={PAD_T + CHART_H - prevH}
                width={barW}
                height={prevH}
                fill="rgba(255,255,255,0.12)"
                rx={2}
              />
            )}
            {d.currentYear > 0 && (
              <rect
                x={pairX + barW + 2}
                y={PAD_T + CHART_H - currH}
                width={barW}
                height={currH}
                fill="#FC4C02"
                rx={2}
              />
            )}
            <text
              x={labelX}
              y={VH - 8}
              fontSize={10}
              fill="rgba(255,255,255,0.5)"
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <rect x={VW - PAD_R - 100} y={4} width={8} height={8} fill="rgba(255,255,255,0.12)" rx={1} />
      <text x={VW - PAD_R - 88} y={12} fontSize={9} fill="rgba(255,255,255,0.4)">
        {prevYear}
      </text>
      <rect x={VW - PAD_R - 55} y={4} width={8} height={8} fill="#FC4C02" rx={1} />
      <text x={VW - PAD_R - 43} y={12} fontSize={9} fill="rgba(255,255,255,0.4)">
        {currentYear}
      </text>
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MonthlyChart.tsx
git commit -m "feat: add MonthlyChart SVG component"
```

---

### Task 5: TopPerformances + SportBreakdown components

**Files:**
- Create: `components/TopPerformances.tsx`
- Create: `components/SportBreakdown.tsx`

- [ ] **Step 1: Create `components/TopPerformances.tsx`**

```tsx
import { getTopPerformances } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

export default function TopPerformances({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const perfs = getTopPerformances(activities)
  if (perfs.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {perfs.map((p) => (
        <div
          key={p.label}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-1"
        >
          <span className="text-2xl">{p.icon}</span>
          <span className="text-xs text-white/40 uppercase tracking-wider mt-1">
            {p.label}
          </span>
          <span className="text-xl font-bold text-[#FC4C02]">{p.value}</span>
          <span className="text-xs text-white/40">{p.sub}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/SportBreakdown.tsx`**

```tsx
import { getSportBreakdown } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

export default function SportBreakdown({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const sports = getSportBreakdown(activities)
  if (sports.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {sports.map((s) => (
        <div
          key={s.sportType}
          className="bg-[#1a1a1a] border border-white/10 rounded-full px-4 py-2 text-sm flex items-center gap-2"
        >
          <span>{s.icon}</span>
          <span className="text-white/80">{s.sportType}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/60">
            {s.count} {s.count === 1 ? 'vez' : 'veces'}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/40">{s.totalHours.toFixed(1)} h</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/TopPerformances.tsx components/SportBreakdown.tsx
git commit -m "feat: add TopPerformances and SportBreakdown components"
```

---

## Chunk 3: Integration

### Task 6: RunningPartners component

**Files:**
- Create: `components/RunningPartners.tsx`

- [ ] **Step 1: Create `components/RunningPartners.tsx`**

```tsx
import type { SummaryAthlete } from '@/types/strava'

interface RunningPartnersProps {
  partners: { athlete: SummaryAthlete; count: number }[]
}

export default function RunningPartners({ partners }: RunningPartnersProps) {
  if (partners.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {partners.map(({ athlete, count }) => (
        <div
          key={athlete.id}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={athlete.profile}
            alt={`${athlete.firstname} ${athlete.lastname}`}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
          <span className="text-sm font-semibold text-white">
            {athlete.firstname} {athlete.lastname}
          </span>
          <span className="text-xs text-white/40">
            {count} carrera{count === 1 ? '' : 's'} juntos
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/RunningPartners.tsx
git commit -m "feat: add RunningPartners component"
```

---

### Task 7: RouteMap enhancements

**Files:**
- Modify: `components/RouteMap.tsx`

**New dependencies — install before editing the component:**

- [ ] **Step 1: Install new dependencies**

```bash
npm install world-atlas topojson-client i18n-iso-countries
npm install -D @types/topojson-client
```

Verify they were added to `package.json`:

```bash
grep -E "world-atlas|topojson-client|i18n-iso-countries" package.json
```

Expected: all three packages appear.

- [ ] **Step 2: Fix geocoding precision in `components/RouteMap.tsx`**

Find line 39 in `components/RouteMap.tsx`:

```ts
// Before:
function roundCoord(n: number): number {
  return Math.round(n * 10) / 10
}
```

Replace with:

```ts
// After (2 decimal places ≈ 1km grid, prevents Shenzhen/HK merging):
function roundCoord(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 3: Add country-coloring imports to `components/RouteMap.tsx`**

At the top of the file, add after the existing imports:

```ts
import worldData from 'world-atlas/countries-110m.json'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { GeoJSON } from 'react-leaflet'
import isoCountries from 'i18n-iso-countries'
```

Also add `useMemo` to the React imports line (it's currently `useRef, useState, useEffect, useCallback`):

```ts
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
```

- [ ] **Step 4: Add `getVisitedNumericIds` helper function**

Add after the `flagEmoji` function (around line 36):

```ts
function getVisitedNumericIds(countryCodes: string[]): Set<string> {
  const ids = new Set<string>()
  for (const code of countryCodes) {
    const numeric = isoCountries.alpha2ToNumeric(code.toUpperCase())
    if (numeric) ids.add(numeric)
  }
  return ids
}
```

- [ ] **Step 5: Add `visitedGeoJSON` memoization**

Inside the `RouteMap` component function, after the `routes` definition (around line 71), add:

```ts
const visitedGeoJSON = useMemo(() => {
  if (locationTree.length === 0) return null
  const visitedIds = getVisitedNumericIds(locationTree.map((c) => c.code))
  const allCountries = feature(
    worldData as unknown as Topology,
    (worldData as any).objects.countries
  )
  return {
    ...allCountries,
    features: allCountries.features.filter(
      (f) => typeof f.id !== 'undefined' && visitedIds.has(String(f.id))
    ),
  }
}, [locationTree])
```

- [ ] **Step 6: Add `<GeoJSON>` layer inside `<MapContainer>`**

Inside the JSX returned by `RouteMap`, add the `<GeoJSON>` layer **before** the `<Polyline>` elements (so country fills render below route lines):

```tsx
{visitedGeoJSON && (
  <GeoJSON
    key={JSON.stringify(visitedGeoJSON.features.map((f) => f.id))}
    data={visitedGeoJSON as any}
    style={() => ({
      fillColor: '#FC4C02',
      fillOpacity: 0.15,
      color: 'transparent',
      weight: 0,
    })}
  />
)}
```

`as any` is used on the `data` prop because the `GeoJSON` identifier in scope is the react-leaflet component, not the `geojson` type namespace — so `as GeoJSON.FeatureCollection` would produce a TypeScript error. `as any` is the correct escape here; the runtime shape is valid GeoJSON and Leaflet will handle it correctly.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If there is a type error on the `<GeoJSON data={...}>` prop, change the cast to `as any`.

- [ ] **Step 8: Run all tests to confirm nothing broke**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all tests pass (RouteMap has no unit tests).

- [ ] **Step 9: Commit**

```bash
git add components/RouteMap.tsx package.json package-lock.json
git commit -m "feat: fix geocoding precision and add country coloring to RouteMap"
```

---

### Task 8: Dashboard wiring

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add imports to `app/dashboard/page.tsx`**

Replace the strava lib import block (currently ends with `StravaRateLimitError`) with:

```ts
import {
  getSession,
  getAthlete,
  getAthleteStats,
  getAllActivities,
  getActivityKudos,
  StravaRateLimitError,
} from '@/lib/strava'
```

Replace the calculations import block (currently ends with `computeFunFacts`) with:

```ts
import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
  getSportBreakdown,
} from '@/lib/calculations'
```

Add a new import line for the `SummaryAthlete` type:

```ts
import type { SummaryAthlete } from '@/types/strava'
```

Add new component imports after the existing component imports:

```ts
import ActivityHeatmap from '@/components/ActivityHeatmap'
import MonthlyChart from '@/components/MonthlyChart'
import TopPerformances from '@/components/TopPerformances'
import SportBreakdown from '@/components/SportBreakdown'
import RunningPartners from '@/components/RunningPartners'
```

- [ ] **Step 2: Add running partners computation + `hasSports` flag**

After the `getAllActivities` resolves (after the `const [athlete, stats, activities]` Promise.all), add:

```ts
// Running partners — gracefully degrades to [] if any kudos request fails
const groupRuns = activities
  .filter((a) => a.sport_type === 'Run' && (a.athlete_count ?? 1) > 1)
  .slice(0, 10)

let runningPartners: { athlete: SummaryAthlete; count: number }[] = []
try {
  const kudosLists = await Promise.all(
    groupRuns.map((a) => getActivityKudos(session.access_token, a.id))
  )
  const partnerMap = new Map<number, { athlete: SummaryAthlete; count: number }>()
  for (const kudosList of kudosLists) {
    for (const a of kudosList) {
      const entry = partnerMap.get(a.id)
      if (entry) entry.count++
      else partnerMap.set(a.id, { athlete: a, count: 1 })
    }
  }
  runningPartners = [...partnerMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
} catch {
  // silently degrade — section will be hidden
}

// Controls whether the "Otras actividades" section renders
const hasSports = getSportBreakdown(activities).length > 0
```

- [ ] **Step 3: Update the JSX in `app/dashboard/page.tsx`**

Replace the entire `return (...)` block with the new layout (preserving the existing structure and adding new sections):

```tsx
return (
  <main className="min-h-screen bg-[#0f0f0f] text-white">
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div className="flex justify-end">
        <a
          href="/api/auth/logout"
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Cerrar sesión
        </a>
      </div>
      <ProfileCard
        athlete={athlete}
        primarySport={primarySport}
        athleteSince={athleteSince}
        yearlyChallenge={yearlyChallenge}
      />
      <MetricsGrid metrics={metrics} />
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Actividad
        </h2>
        <ActivityHeatmap activities={activities} />
      </section>
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Kilómetros por mes
        </h2>
        <MonthlyChart activities={activities} />
      </section>
      <BestMarks bestMarks={bestMarks} />
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Mejores actuaciones
        </h2>
        <TopPerformances activities={activities} />
      </section>
      <Achievements totals={totals} activities={activities} bestMarks={bestMarks} />
      <FunFact funFacts={funFacts} />
      {hasSports && (
        <section>
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Otras actividades
          </h2>
          <SportBreakdown activities={activities} />
        </section>
      )}
      {runningPartners.length > 0 && (
        <section>
          <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Compañeros de carrera
          </h2>
          <RunningPartners partners={runningPartners} />
        </section>
      )}
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Tus Rutas
        </h2>
        <RouteMap activities={activities} />
      </section>
    </div>
  </main>
)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: wire all phase 3 components into dashboard"
```

---

## Final verification

- [ ] **Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests green.

- [ ] **Build check**

```bash
npx next build 2>&1 | tail -20
```

Expected: build succeeds with no errors.
