# Phase 2 Enhancements — Design Spec

## Overview

Three changes:

1. **Replace geographic challenge with yearly milestone system** — universal km/year progress ladder
2. **ProfileCard top semi-circle + hover** — arc at top of photo, hover reveals exact km
3. **RouteMap sidebar** — country → city hierarchy with click-to-zoom, built via Nominatim reverse geocoding

---

## A. Yearly Challenge (replaces geographic challenge)

### Files deleted
- `lib/challenges.ts`
- `lib/__tests__/challenges.test.ts`
- `components/ChallengeBar.tsx`

### New file: `lib/yearlyChallenge.ts`

```ts
export interface YearlyChallengeState {
  ytdKm: number
  nextMilestone: number   // km target to reach
  prevMilestone: number   // previous milestone (0 if none)
  progress: number        // 0–1 within current segment
  icon: string
  allCompleted: boolean   // hit 3000 km/year
}

const YEARLY_MILESTONES = [
  { km: 100,  icon: '🌱' },
  { km: 250,  icon: '🌿' },
  { km: 500,  icon: '⚡' },
  { km: 750,  icon: '🔥' },
  { km: 1000, icon: '💪' },
  { km: 1500, icon: '🚀' },
  { km: 2000, icon: '⭐' },
  { km: 3000, icon: '🏆' },
]

export function getYearlyChallenge(ytdKm: number): YearlyChallengeState
```

Logic:
- Find first milestone where `km > ytdKm`
- `progress = (ytdKm - prevMilestone.km) / (nextMilestone.km - prevMilestone.km)`
- If `ytdKm >= 3000`: `allCompleted = true`, progress = 1

### `lib/__tests__/yearlyChallenge.test.ts`

Tests: progress=0 at 0km, correct progress mid-segment, allCompleted at 3000km+.

### `app/dashboard/page.tsx`

- Remove: `ChallengeBar` import/usage, `getCurrentChallenge` import
- Add: `import { getYearlyChallenge } from '@/lib/yearlyChallenge'`
- `const yearlyChallenge = getYearlyChallenge(stats.ytd_run_totals.distance / 1000)`
- Pass `yearlyChallenge` to `<ProfileCard>`

---

## B. ProfileCard: top semi-circle + hover

### Props change

Replace `challenge: ChallengeState` with `yearlyChallenge: YearlyChallengeState`.

### Semi-circle (top arc)

Change SVG from two full `<circle>` elements to two `<path>` elements drawing the **top half** of the circle:

```
Path: M (cx-r),cy  A r,r 0 0,0  (cx+r),cy
```

With `RING_SIZE=96`, `RING_RADIUS=44`, `cx=cy=48`:
```
M 4,48  A 44,44 0 0,0  92,48
```

This arc goes **counterclockwise** (upward) from the left midpoint to the right midpoint — the top semi-circle.

Progress fill (left → right):
- `strokeDasharray={`${yearlyChallenge.progress * HALF_CIRC} ${HALF_CIRC}`}`
- `strokeDashoffset={0}`
- `HALF_CIRC = Math.PI * RING_RADIUS` (≈ 138.23)

Color: `#FC4C02` normal, `#FFD700` when `allCompleted`.

### Hover behavior

`ProfileCard` becomes `'use client'`. Add `useState<boolean>(false)` for `hovered`.

The bottom label:
- **Normal**: `{icon} {Math.round(progress * 100)}% → {nextMilestone} km`
- **Hovered**: `{ytdKm.toFixed(0)} km / {nextMilestone} km`

Both in `#FC4C02` (gold when allCompleted).

On the card `<div>`: `onMouseEnter={() => setHovered(true)}` + `onMouseLeave={() => setHovered(false)}`.

---

## C. RouteMap sidebar

### Layout

Two columns inside the existing `<section>` wrapper:

```
┌──────────────────────────────┬─────────────────────┐
│   MapContainer (flex-1)      │ Sidebar (w-56)       │
│   dark CartoDB tiles         │ 🇪🇸 España           │
│   routes as orange polylines │   📍 Madrid  (12)   │
│                              │   📍 Valencia  (3)  │
│                              │ 🇨🇳 China            │
│                              │   📍 Shanghái  (2)  │
└──────────────────────────────┴─────────────────────┘
```

### Geocoding logic

For each route, use the **first decoded coordinate** as the representative point.

Deduplicate: round lat/lng to **1 decimal place** (≈11km grid) to avoid redundant API calls.

For each unique rounded coordinate, call Nominatim:
```
GET https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}
```

Note: browsers block setting `User-Agent` as a fetch header (forbidden header name), so the browser's default UA is sent. Nominatim's ToS requires a descriptive UA but won't block a personal dashboard making 10–20 calls. Accepted risk for this scope.

Extract: `address.city || address.town || address.village || address.municipality` for city, `address.country` and `address.country_code` for country.

Rate limit: 1 request per 1100ms (Nominatim policy). Max 20 unique points (safety cap).

### Country flag emoji

```ts
function flagEmoji(code: string): string {
  return code.toUpperCase().split('').map(
    c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
  ).join('')
}
// 'ES' → '🇪🇸', 'CN' → '🇨🇳'
```

### Data structure

```ts
interface CityNode {
  name: string
  routeIndices: number[]   // indices into the decoded routes array
}
interface CountryNode {
  name: string
  code: string
  cities: CityNode[]
}
```

### Map controller

A child component inside `MapContainer` that captures the map instance and writes it into a `MutableRefObject` passed as a plain prop:

```tsx
function MapController({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}
```

The parent creates `const mapRef = useRef<LeafletMap | null>(null)` and passes it to `MapController`. Sidebar click handlers use `mapRef.current?.fitBounds(...)`. No `forwardRef` needed — the ref is passed as a regular prop.

### Click to zoom

Clicking a country: `fitBounds` of all routes in that country.
Clicking a city: `fitBounds` of all routes in that city.
`fitBounds` is called with `{ padding: [20, 20] }`.

### Loading state

While geocoding: sidebar shows `Cargando ubicaciones...` (spinner or animated dots). Once complete, renders the hierarchy.

### FitBounds on mount

On initial render, `fitBounds` all routes with `{ padding: [30, 30] }` for a comfortable view (fixes the "too much zoom" complaint).

---

## Files changed

| File | Change |
|---|---|
| `lib/challenges.ts` | Delete |
| `lib/__tests__/challenges.test.ts` | Delete |
| `components/ChallengeBar.tsx` | Delete |
| `lib/yearlyChallenge.ts` | Create |
| `lib/__tests__/yearlyChallenge.test.ts` | Create |
| `components/ProfileCard.tsx` | Modify — top semi-circle, hover, yearly challenge prop |
| `components/RouteMap.tsx` | Modify — two-column layout, sidebar, geocoding |
| `app/dashboard/page.tsx` | Modify — remove ChallengeBar, pass yearlyChallenge |

---

## Out of scope

- No changes to MetricsGrid, BestMarks, Achievements, FunFact
- No new API routes
- No persistence of geocoding results (in-memory only, re-geocodes on each page load)
