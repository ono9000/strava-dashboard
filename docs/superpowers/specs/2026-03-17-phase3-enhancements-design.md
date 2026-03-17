# Phase 3 Enhancements — Design Spec

## Overview

Seven additions to the Strava Dashboard:

1. **Geocoding precision fix** — `roundCoord` from 1 to 2 decimal places (~1km grid)
2. **Activity Heatmap** — GitHub-style 52×7 calendar showing daily km
3. **Monthly km chart** — SVG bar chart, current year + previous year ghost bars
4. **Top Performances** — 3 highlight cards: longest run, best pace, most elevation
5. **Country coloring on map** — orange fill on visited countries via world-atlas GeoJSON
6. **Sport breakdown** — non-running activities grouped by type with count + duration
7. **Running partners** — top 3 athletes detected via group runs + kudos proxy

---

## Supporting changes (required by multiple features)

### `types/strava.ts`

Add `athlete_count` to `StravaSummaryActivity`:

```ts
export interface StravaSummaryActivity {
  // ... existing fields ...
  athlete_count?: number  // number of athletes in the activity; >1 means group run
}
```

Add new interface:

```ts
export interface SummaryAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string  // photo URL
}
```

### `lib/strava.ts`

Add `SummaryAthlete` to the existing import block at the top of the file:

```ts
import type {
  StravaAthlete,
  StravaStats,
  StravaSummaryActivity,
  StravaSession,
  SummaryAthlete,   // ← add this
} from '@/types/strava'
```

Add new function after `getAllActivities`. Use `per_page=200` to avoid the default 30-item pagination cap:

```ts
export async function getActivityKudos(
  token: string,
  activityId: number
): Promise<SummaryAthlete[]> {
  return stravaFetch<SummaryAthlete[]>(`/activities/${activityId}/kudos?per_page=200`, token)
}
```

---

## A. Geocoding precision fix

### File: `components/RouteMap.tsx`

Change `roundCoord` from 1 decimal (~11 km grid) to 2 decimals (~1 km grid):

```ts
// Before:
function roundCoord(n: number): number { return Math.round(n * 10) / 10 }

// After:
function roundCoord(n: number): number { return Math.round(n * 100) / 100 }
```

This prevents nearby cities (e.g. Shenzhen and Hong Kong) from being merged into the same geocoding bucket.

---

## B. Activity Heatmap

### New file: `components/ActivityHeatmap.tsx`

`'use client'` component receiving `activities: StravaSummaryActivity[]`. Needs `'use client'` because it renders SVG cells with `title` tooltips that require DOM interaction and potentially `useState` for tooltip state if enhanced later. No `dynamic()` import needed — no Leaflet, no `window`-only API.

### Data function: `getActivityHeatmap` in `lib/calculations.ts`

```ts
export interface HeatmapDay {
  date: string  // 'YYYY-MM-DD'
  km: number
}

// Returns 52 weeks × 7 days (most-recent week last).
// Each inner array is Mon–Sun.
export function getActivityHeatmap(
  activities: StravaSummaryActivity[],
  today?: Date
): HeatmapDay[][]
```

Logic:
- Only `sport_type === 'Run'` activities.
- Build `Map<string, number>` of `'YYYY-MM-DD' → km` by parsing `start_date_local`.
- `today` defaults to `new Date()`. Find most recent Monday ≤ today; go back 51 more weeks for 52 total.
- Produce a `HeatmapDay[52][7]` grid: outer index 0 = oldest week (leftmost column), outer index 51 = most recent week; within each week, inner index 0 = Monday, inner index 6 = Sunday.
- Days in the future (last partial week, where date > today) get `km: 0`.

### Rendering

- 52 columns × 7 rows of 11×11 px cells with 2 px gap.
- Color levels based on km:

  | km | color |
  |---|---|
  | 0 | `#1a1a1a` |
  | 0 < km ≤ 5 | `#FC4C0240` |
  | 5 < km ≤ 15 | `#FC4C0280` |
  | km > 15 | `#FC4C02` |

- Month labels above grid (abbreviated: Ene, Feb, ...). Show month name at the column where the first day of that month falls.
- Day labels on left: L, M, X, J, V, S, D (Mon–Sun in Spanish).
- `title` attribute on each cell for native browser tooltip: `"12 km — 15 ene 2026"` or `"Sin actividad — 15 ene 2026"`.
- No hover state beyond native tooltip (keep it simple).

---

## C. Monthly km chart

### New file: `components/MonthlyChart.tsx`

Pure Server Component receiving `activities: StravaSummaryActivity[]` — no hooks, no event handlers, no `'use client'`. No `dynamic()` import needed.

### Data function: `getMonthlyKm` in `lib/calculations.ts`

```ts
export interface MonthlyKmData {
  month: number        // 0–11
  label: string        // 'Ene', 'Feb', ...
  currentYear: number  // km
  prevYear: number     // km
}

export function getMonthlyKm(
  activities: StravaSummaryActivity[],
  today?: Date
): MonthlyKmData[]  // 12 entries, Jan–Dec
```

Logic:
- Only `sport_type === 'Run'` activities.
- `today` defaults to `new Date()`. `currentYear = today.getFullYear()`, `prevYear = currentYear - 1`.
- For each of the 12 months, sum distance from activities matching that year+month.
- Return array of 12 `MonthlyKmData` objects.

Month abbreviations (Spanish):
```ts
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
```

### Rendering

Pure SVG, no chart library.

- Chart area: 600×180 px viewBox, `preserveAspectRatio="xMidYMid meet"`, `width="100%"`.
- Padding: left 40 px (Y labels), bottom 28 px (X labels), top 16 px, right 16 px.
Bar x-position formulas (chartWidth = 544 = 600 − 40 left − 16 right):
```
slotWidth     = 544 / 12                              // ≈ 45.3 px per month slot
pairWidth     = slotWidth * 0.6                       // ≈ 27.2 px total for prev+current pair
barWidth      = (pairWidth - 2) / 2                   // ≈ 12.6 px each bar (2 px gap between them)
pairX(i)      = 40 + i * slotWidth + (slotWidth - pairWidth) / 2   // centered in slot
prevBarX(i)   = pairX(i)
currentBarX(i)= pairX(i) + barWidth + 2
labelX(i)     = 40 + i * slotWidth + slotWidth / 2   // centered under slot
```

- **Previous year bars**: `fill="#ffffff20"` (ghost, behind).
- **Current year bars**: `fill="#FC4C02"`.
- Bar height: `barHeight(km) = (km / maxKm) * chartHeight`, where `chartHeight = 180 - 16 - 28 = 136 px`. SVG bars start at the bottom: `y = 16 + chartHeight - barHeight`, height = `barHeight`.
- Y-axis: 4 horizontal guide lines at 25%, 50%, 75%, 100% of max km, label in `white/30 text-[10px]`.
- X-axis labels: month abbreviations, `white/50 text-[11px]`, at `y = 180 - 8`, `textAnchor="middle"`.
- Legend: small colored square + text `{currentYear}` and `{prevYear}`, top-right corner of SVG.
- Months with no data: bar height = 0 (no bar rendered, skip the `<rect>`).
- Max km: `Math.max(...all values, 1)` (avoid division by zero).

---

## D. Top Performances

### New file: `components/TopPerformances.tsx`

Server component (no client interactivity needed). Receives:

```ts
interface TopPerformancesProps {
  activities: StravaSummaryActivity[]
}
```

### Data function: `getTopPerformances` in `lib/calculations.ts`

```ts
export interface TopPerf {
  icon: string
  label: string
  value: string
  sub: string
}

export function getTopPerformances(activities: StravaSummaryActivity[]): TopPerf[]
```

Returns 3 `TopPerf` items (or fewer if data unavailable):

1. **Longest run** — finds the Run with greatest `distance`:
   - `icon: '📏'`, `label: 'Carrera más larga'`
   - `value: '${(distance/1000).toFixed(1)} km'`
   - `sub: '${name} · ${date formatted as "D MMM YYYY"}'`

2. **Best pace** — fastest average pace among Run activities ≥ 5 km:
   - `icon: '⚡'`, `label: 'Mejor ritmo'`
   - `value: formatPace(moving_time, distance)` (reuse existing function)
   - `sub: '${(distance/1000).toFixed(1)} km · ${date}'`
   - If no activity ≥ 5 km, omit this card.

3. **Most elevation** — Run with highest `total_elevation_gain`:
   - `icon: '⛰️'`, `label: 'Más desnivel'`
   - `value: '${Math.round(elevation_gain)} m'`
   - `sub: '${(distance/1000).toFixed(1)} km · ${date}'`

Date formatting helper (local, not exported):
```ts
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
```

### Rendering

Three cards in a 3-column responsive grid (`grid-cols-1 sm:grid-cols-3`). Each card:

```
┌──────────────────────────┐
│  ⚡                       │
│  Mejor ritmo              │
│  4'32"/km                 │  ← value, large, #FC4C02
│  10.2 km · 3 mar 2025    │  ← sub, small, white/40
└──────────────────────────┘
```

Card style: `bg-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-1`.

---

## E. Country coloring on RouteMap

### New dependencies

```
npm install world-atlas topojson-client i18n-iso-countries
npm install -D @types/topojson-client
```

Note: `@types/world-atlas` does not exist on npm — `world-atlas` is a JSON-only data package covered by TypeScript's `resolveJsonModule`. `@types/topojson-client` re-exports `topojson-specification` types so no separate install is needed.

### File: `components/RouteMap.tsx`

Add a GeoJSON layer that fills visited countries with a translucent orange.

**Imports to add:**

```ts
import worldData from 'world-atlas/countries-110m.json'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { GeoJSON } from 'react-leaflet'
import isoCountries from 'i18n-iso-countries'
```

**Helper:**

`world-atlas` feature IDs are strings (e.g. `"724"` for Spain). `alpha2ToNumeric` returns a string. Store as `Set<string>` and compare with `String(f.id)`:

```ts
function getVisitedNumericIds(countryCodes: string[]): Set<string> {
  const ids = new Set<string>()
  for (const code of countryCodes) {
    const numeric = isoCountries.alpha2ToNumeric(code.toUpperCase())
    if (numeric) ids.add(numeric)  // numeric is already a string e.g. "724"
  }
  return ids
}
```

**GeoJSON computation** (inside component, memo-ized with `useMemo`):

The state variable in `RouteMap` is `locationTree: CountryNode[]` (not `countries`):

```ts
const visitedGeoJSON = useMemo(() => {
  if (locationTree.length === 0) return null
  const visitedIds = getVisitedNumericIds(locationTree.map(c => c.code))
  const allCountries = feature(
    worldData as unknown as Topology,
    (worldData as any).objects.countries
  )
  return {
    ...allCountries,
    features: allCountries.features.filter(f =>
      typeof f.id !== 'undefined' && visitedIds.has(String(f.id))
    ),
  }
}, [locationTree])
```

**GeoJSON layer** (placed before Polylines, so it renders underneath routes):

```tsx
{visitedGeoJSON && (
  <GeoJSON
    key={JSON.stringify(visitedGeoJSON.features.map(f => f.id))}
    data={visitedGeoJSON}
    style={() => ({
      fillColor: '#FC4C02',
      fillOpacity: 0.15,
      color: 'transparent',
      weight: 0,
    })}
  />
)}
```

**REQUIRED: `key` prop must not be removed.** React-leaflet v4's `<GeoJSON>` does not update when the `data` prop changes. The `key` forces a remount whenever `locationTree` changes (i.e. after geocoding completes). Without it, no country will ever be highlighted after the initial empty render.

---

## F. Sport Breakdown

### New file: `components/SportBreakdown.tsx`

Server component. Receives `activities: StravaSummaryActivity[]`.

### Data function: `getSportBreakdown` in `lib/calculations.ts`

```ts
export interface SportSummary {
  sportType: string
  count: number
  totalHours: number  // moving_time / 3600
  icon: string
}

export function getSportBreakdown(activities: StravaSummaryActivity[]): SportSummary[]
```

Logic:
- Exclude `sport_type === 'Run'` activities.
- Group by `sport_type`, sum count and `moving_time`.
- Sort by count descending.
- Map icon:

```ts
const SPORT_ICONS: Record<string, string> = {
  Ride: '🚴', Walk: '🚶', Hike: '🥾', Swim: '🏊',
  Tennis: '🎾', Basketball: '🏀', WeightTraining: '🏋️',
  Yoga: '🧘', VirtualRide: '🚴', EBikeRide: '⚡',
  Soccer: '⚽', Rowing: '🚣', Crossfit: '💪',
  Elliptical: '🔄', StairStepper: '🏃', RockClimbing: '🧗',
}
const DEFAULT_ICON = '🏅'
```

- Return all sports (no cap).

### Rendering

Horizontal wrapping list of sport chips. Each chip:

```
🎾  Tennis  · 12 veces  · 8.4 h
```

Style: `bg-[#1a1a1a] rounded-full px-4 py-2 text-sm flex items-center gap-2`.

If `getSportBreakdown` returns empty array, render nothing (section is omitted in `page.tsx`).

---

## G. Running Partners

### New file: `components/RunningPartners.tsx`

Server component. Receives:

```ts
interface RunningPartnersProps {
  partners: { athlete: SummaryAthlete; count: number }[]
}
```

### Server-side data fetching in `app/dashboard/page.tsx`

The kudos fetching is wrapped in its own `try/catch` so a rate-limit error on any single kudos request degrades gracefully (section hidden) rather than crashing the entire dashboard:

```ts
// After getAllActivities resolves:
const groupRuns = activities
  .filter(a => a.sport_type === 'Run' && (a.athlete_count ?? 1) > 1)
  .slice(0, 10)  // limit to 10 most recent to avoid rate limit

let runningPartners: { athlete: SummaryAthlete; count: number }[] = []
try {
  const kudosLists = await Promise.all(
    groupRuns.map(a => getActivityKudos(session.access_token, a.id))
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
  // silently degrade; running partners section will be hidden
}
```

The `getActivityKudos` calls run in parallel via `Promise.all` — up to 10 concurrent requests. Strava's rate limit is 100 requests per 15 minutes; combined with the 3 existing parallel fetches (athlete, stats, activities), the total per page load is at most 13, well within limits.

### Rendering

Three cards (or fewer) in a row:

```
┌────────────────────┐
│  [photo]           │
│  Ana García        │
│  3 carreras juntos │
└────────────────────┘
```

- Photo: 48×48 circular, `object-cover`.
- Name: `firstname + ' ' + lastname`, `text-sm font-semibold`.
- Count: `${count} carrera${count === 1 ? '' : 's'} juntos`, `text-white/40 text-xs`.
- If `partners.length === 0`, render nothing (section omitted in page).

---

## Dashboard layout (`app/dashboard/page.tsx`)

New order of sections:

```
ProfileCard
MetricsGrid
ActivityHeatmap     ← new: "Actividad"
MonthlyChart        ← new: "Kilómetros por mes"
BestMarks
TopPerformances     ← new: "Mejores actuaciones"
Achievements
FunFact
SportBreakdown      ← new: "Otras actividades" (only if data)
RunningPartners     ← new: "Compañeros de carrera" (only if data)
RouteMap            ← existing, now with country coloring
```

`MonthlyChart`, `TopPerformances`, `SportBreakdown`, `RunningPartners` are pure Server Components — no `dynamic()` import needed.

`ActivityHeatmap` uses `'use client'` (may use hooks) but has no browser-only APIs, so it can also be imported directly without `dynamic()` — no Leaflet, no `window`.

None of these new components require `{ ssr: false }`. Only `RouteMap` requires `dynamic(..., { ssr: false })` (already in place).

---

## Tests

### `lib/__tests__/calculations.test.ts` — additions

**`getActivityHeatmap`:**
- Empty activities → 52×7 grid all zeros.
- Single run on a known date → correct cell has that km value.
- Multiple runs on same day → values are summed.
- Non-Run activity (Ride) → not counted.
- Partial-week boundary: given `today = new Date('2026-03-17')` (a Tuesday), `grid[51][0]` (Mon 2026-03-16) should have the km for a run on that day; `grid[51][1]` (Tue 2026-03-17) should have the km for a run on that day; `grid[51][2]` through `grid[51][6]` should be 0 (future days).

**`getMonthlyKm`:**
- Empty activities → all 12 months at 0.
- Run in current year month 2 → `currentYear` for index 2 equals that km.
- Run in previous year month 2 → `prevYear` for index 2 equals that km.
- Non-Run excluded.

**`getTopPerformances`:**
- Empty activities → empty array.
- One run → returns 1 or 2 cards (no 5km+ → no pace card).
- Run < 5km excluded from pace card.
- Returns longest by distance, not moving_time.

**`getSportBreakdown`:**
- Empty activities → empty array.
- Run-only activities → empty array (all excluded).
- Mixed activities → runs excluded, rest grouped correctly, sorted by count desc.

---

## New dependencies summary

```
npm install world-atlas topojson-client i18n-iso-countries
npm install -D @types/topojson-client
```

`world-atlas` is a data-only package (~95 KB JSON), no `@types` needed. `topojson-client` is tiny (~5 KB). `i18n-iso-countries` is ~20 KB. `@types/topojson-client` brings in `topojson-specification` types transitively.

---

## Files changed

| File | Change |
|---|---|
| `types/strava.ts` | Add `athlete_count?` to `StravaSummaryActivity`, add `SummaryAthlete` |
| `lib/strava.ts` | Add `getActivityKudos` |
| `lib/calculations.ts` | Add `getActivityHeatmap`, `getMonthlyKm`, `getTopPerformances`, `getSportBreakdown` |
| `lib/__tests__/calculations.test.ts` | Add tests for 4 new functions |
| `components/RouteMap.tsx` | Fix `roundCoord` precision, add country coloring GeoJSON layer |
| `components/ActivityHeatmap.tsx` | Create |
| `components/MonthlyChart.tsx` | Create |
| `components/TopPerformances.tsx` | Create |
| `components/SportBreakdown.tsx` | Create |
| `components/RunningPartners.tsx` | Create |
| `app/dashboard/page.tsx` | Wire all new components, compute runningPartners server-side |

---

## Out of scope

- No caching of geocoding or kudos results (all in-memory, re-fetches on each page load)
- No user settings or toggles
- No changes to auth, middleware, BestMarks, Achievements, FunFact, MetricsGrid
- No Strava webhook integration
- Running partners feature gracefully degrades if no group runs are found (section hidden)
