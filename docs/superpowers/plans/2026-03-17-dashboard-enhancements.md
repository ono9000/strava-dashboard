# Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visual improvements to the Strava Dashboard: a progress ring around the athlete photo, progress bars on locked badges, and a dark world map showing all activity routes.

**Architecture:** Three independent modifications — ProfileCard gets a centered layout with SVG arc, Achievements.Badge gets optional progress bar props, and a new RouteMap client component is added using react-leaflet with dynamic SSR-off import. Each can be built and tested in isolation.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React Leaflet 4, @mapbox/polyline, Jest + Testing Library (already configured)

---

## Chunk 1: Types + ProfileCard ring

### Task 1: Add `map` field to `StravaSummaryActivity`

**Files:**
- Modify: `types/strava.ts`
- Modify: `lib/__tests__/calculations.test.ts` (update `makeActivity` factory)

The Strava activities API returns a `map` object with `summary_polyline`. It is not in our type yet.

- [ ] **Step 1: Add the field to the type**

In `types/strava.ts`, add to `StravaSummaryActivity` (after `start_date_local`):

```ts
  map: {
    summary_polyline: string   // Google Encoded Polyline; empty string if private/no GPS
  } | null
```

Full updated interface:
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
  map: {
    summary_polyline: string
  } | null
}
```

- [ ] **Step 2: Update the `makeActivity` factory in tests**

In `lib/__tests__/calculations.test.ts`, the `makeActivity` helper needs `map: null` as a default so it still builds cleanly:

```ts
const makeActivity = (
  overrides: Partial<StravaSummaryActivity>
): StravaSummaryActivity => ({
  id: 1,
  name: 'Test Run',
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1600,
  total_elevation_gain: 50,
  sport_type: 'Run',
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T09:00:00+01:00',
  map: null,
  ...overrides,
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing tests**

```bash
npm test -- --testPathPattern="lib/__tests__"
```

Expected: all pass (no changes to logic).

- [ ] **Step 5: Commit**

```bash
git add types/strava.ts lib/__tests__/calculations.test.ts
git commit -m "feat: add map.summary_polyline to StravaSummaryActivity type"
```

---

### Task 2: Redesign ProfileCard with SVG progress ring

**Files:**
- Modify: `components/ProfileCard.tsx`

The current card is horizontal (photo left, text right). The new design is centered-vertical with an SVG arc ring overlaid on the photo showing challenge progress.

**Ring math:**
- Container: 96×96 px
- Circle center: (48, 48), radius: 44
- Circumference: `2 * π * 44 = 276.46`
- Progress arc: `stroke-dasharray=276.46`, `stroke-dashoffset = 276.46 * (1 - progress)`
- Starts from top: `transform="rotate(-90 48 48)"`
- Photo sits inside the ring: `top: 10px, left: 10px, width: 76px, height: 76px` (leaves ~6px gap from ring inner edge)

- [ ] **Step 1: Update ProfileCard props interface and imports**

Replace the full contents of `components/ProfileCard.tsx` with:

```tsx
import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'
import type { ChallengeState } from '@/lib/challenges'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
  challenge: ChallengeState
}

const RING_SIZE = 96
const RING_RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS  // 276.46

export default function ProfileCard({ athlete, primarySport, athleteSince, challenge }: Props) {
  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`
  const dashOffset = CIRCUMFERENCE * (1 - challenge.progress)
  const ringColor = challenge.allCompleted ? '#FFD700' : '#FC4C02'

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center gap-3">

      {/* Photo with SVG ring overlay */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="#333"
            strokeWidth={5}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={5}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            width: 76,
            height: 76,
          }}
        >
          <Image
            src={athlete.profile}
            alt={fullName}
            fill
            className="rounded-full object-cover"
            unoptimized
          />
        </div>
      </div>

      {/* Name and location */}
      <div>
        <h1 className="text-2xl font-bold text-white">{fullName}</h1>
        {location && <p className="text-white/60 text-sm mt-0.5">{location}</p>}
      </div>

      {/* Sport / year tags */}
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
          {primarySport}
        </span>
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
          Atleta desde {athleteSince}
        </span>
      </div>

      {/* Challenge progress label */}
      {challenge.allCompleted ? (
        <p className="text-sm font-bold" style={{ color: '#FFD700' }}>
          🏆 ¡Ruta completa!
        </p>
      ) : (
        <p className="text-sm font-bold" style={{ color: '#FC4C02' }}>
          {Math.round(challenge.progress * 100)}% → {challenge.current.destination}
        </p>
      )}

    </div>
  )
}
```

- [ ] **Step 2: Update dashboard/page.tsx to pass `challenge` to ProfileCard**

In `app/dashboard/page.tsx`, find the `<ProfileCard` JSX (currently at line 82) and add the `challenge` prop:

```tsx
<ProfileCard
  athlete={athlete}
  primarySport={primarySport}
  athleteSince={athleteSince}
  challenge={challenge}
/>
```

(`challenge` is already computed on line 54 as `const challenge = getCurrentChallenge(totalKm)`)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```

Open http://localhost:3000, log in, and verify:
- ProfileCard is centered, not horizontal
- Orange arc appears around the photo
- Percentage and destination shown below tags
- No layout breakage on mobile (resize to 375px width)

- [ ] **Step 5: Commit**

```bash
git add components/ProfileCard.tsx app/dashboard/page.tsx
git commit -m "feat: add SVG progress ring to ProfileCard"
```

---

## Chunk 2: Badge progress bars

### Task 3: Add progress bars to locked km badges

**Files:**
- Modify: `components/Achievements.tsx`

Only the four km-distance badges (100, 500, 1000, 5000 km) get progress bars. The other four badges (half marathon, marathon, best week, best month) are unchanged.

- [ ] **Step 1: Write a unit test for the badge progress calculation logic**

Create `components/__tests__/Achievements.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
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
  bestWeek: { totalKm: 0, totalActivities: 0, label: '' },
  bestMonth: { totalKm: 0, totalActivities: 0, label: '' },
}

describe('Achievements — badge progress', () => {
  it('shows "faltan X km" for a locked km badge', () => {
    // 150 km total — "Primeros 500 km" badge is locked, needs 350 more
    render(
      <Achievements
        totals={baseTotals}
        activities={[baseActivity]}
        bestMarks={bestMarks}
      />
    )
    expect(screen.getByText(/faltan 350 km/i)).toBeInTheDocument()
  })

  it('does not show "faltan" text for an unlocked badge', () => {
    // 150 km — "Primeros 100 km" is unlocked
    render(
      <Achievements
        totals={baseTotals}
        activities={[baseActivity]}
        bestMarks={bestMarks}
      />
    )
    // 100 km badge is unlocked — no "faltan" text for it
    const faltan100 = screen.queryByText(/faltan 0 km/i)
    expect(faltan100).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="components/__tests__/Achievements"
```

Expected: FAIL — `screen.getByText(/faltan 350 km/i)` throws because progress bars don't exist yet.

- [ ] **Step 3: Implement the changes in Achievements.tsx**

Replace the full contents of `components/Achievements.tsx`:

```tsx
import type { StravaActivityTotals, StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'

interface Props {
  totals: StravaActivityTotals
  activities: StravaSummaryActivity[]
  bestMarks: {
    bestWeek: PeriodBest
    bestMonth: PeriodBest
    [key: string]: unknown
  }
}

function Badge({
  label,
  icon,
  unlocked,
  threshold,
  currentKm,
}: {
  label: string
  icon: string
  unlocked: boolean
  threshold?: number
  currentKm?: number
}) {
  const showProgress =
    !unlocked &&
    threshold !== undefined &&
    currentKm !== undefined &&
    currentKm < threshold

  return (
    <div
      className={`bg-[#1a1a1a] border rounded-2xl p-3 flex flex-col items-center gap-2 text-center ${
        unlocked
          ? 'border-[#FC4C02]/30'
          : 'border-white/10 opacity-40 grayscale'
      }`}
    >
      <span className="text-2xl">{unlocked ? icon : '🔒'}</span>
      <span className="text-xs font-medium text-white leading-tight">{label}</span>
      {showProgress && (
        <div className="w-full space-y-1">
          <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FC4C02] rounded-full"
              style={{ width: `${Math.min((currentKm / threshold) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-white/40">
            faltan {Math.ceil(threshold - currentKm)} km
          </span>
        </div>
      )}
    </div>
  )
}

export default function Achievements({ totals, activities, bestMarks }: Props) {
  const totalKm   = totals.distance / 1000
  const hasHalf    = activities.some((a) => a.distance >= 20900)
  const hasMarathon = activities.some((a) => a.distance >= 42000)

  const badges = [
    { label: 'Primeros 100 km',       icon: '🌱', unlocked: totalKm >= 100,  threshold: 100 },
    { label: 'Primeros 500 km',       icon: '⚡', unlocked: totalKm >= 500,  threshold: 500 },
    { label: 'Primer 1.000 km',       icon: '🔥', unlocked: totalKm >= 1000, threshold: 1000 },
    { label: 'Primeros 5.000 km',     icon: '🚀', unlocked: totalKm >= 5000, threshold: 5000 },
    { label: 'Primera media maratón', icon: '🏅', unlocked: hasHalf },
    { label: 'Primer maratón',        icon: '🏆', unlocked: hasMarathon },
    { label: 'Semana récord',         icon: '📅', unlocked: bestMarks.bestWeek.totalKm > 0 },
    { label: 'Mes récord',            icon: '📆', unlocked: bestMarks.bestMonth.totalKm > 0 },
  ]

  const unlockedCount = badges.filter((b) => b.unlocked).length

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs text-white/40 uppercase tracking-wider">Logros</h2>
        <span className="text-xs text-white/40">{unlockedCount}/{badges.length}</span>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {badges.map((b) => (
          <Badge key={b.label} {...b} currentKm={totalKm} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
npm test -- --testPathPattern="components/__tests__/Achievements"
```

Expected: PASS — both tests green.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/Achievements.tsx components/__tests__/Achievements.test.tsx
git commit -m "feat: show progress bars on locked km badges"
```

---

## Chunk 3: Route map

### Task 4: Install Leaflet dependencies

**Files:**
- `package.json` (modified by npm)

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install react-leaflet leaflet @mapbox/polyline
```

- [ ] **Step 2: Install type definitions**

```bash
npm install --save-dev @types/leaflet
```

- [ ] **Step 3: Configure Next.js to transpile ESM-only packages**

`react-leaflet` v4+ ships as pure ESM. Without transpilation it breaks the Jest test runner. Edit `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['react-leaflet', '@react-leaflet/core', 'leaflet'],
}

export default nextConfig
```

- [ ] **Step 4: Configure Jest transform ignore patterns**

Edit `jest.config.ts`:

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(react-leaflet|@react-leaflet/core|leaflet)/).*',
  ],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (new types available).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.mjs jest.config.ts
git commit -m "chore: add react-leaflet, leaflet, @mapbox/polyline dependencies"
```

---

### Task 5: Create the RouteMap component

**Files:**
- Create: `components/RouteMap.tsx`
- Create: `components/__tests__/RouteMap.test.tsx`

`RouteMap` is a `'use client'` component. It decodes Strava's encoded polylines and renders them as orange Polylines on a dark CartoDB map. Imported with `{ ssr: false }` in the dashboard.

- [ ] **Step 1: Write a unit test for the polyline filtering logic**

Create `components/__tests__/RouteMap.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'

// Mock react-leaflet — the map itself is not testable in jsdom
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({ fitBounds: jest.fn() }),
}))

jest.mock('@mapbox/polyline', () => ({
  decode: (str: string) => {
    // Minimal stub: return two points for any non-empty string
    if (!str) return []
    return [[40.4, -3.7], [41.4, -2.7]]
  },
}))

import RouteMap from '../RouteMap'
import type { StravaSummaryActivity } from '@/types/strava'

const makeActivity = (polyline: string | null): StravaSummaryActivity => ({
  id: 1,
  name: 'Test',
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1600,
  total_elevation_gain: 50,
  sport_type: 'Run',
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T09:00:00+01:00',
  map: polyline !== null ? { summary_polyline: polyline } : null,
})

describe('RouteMap', () => {
  it('renders the map when activities have polylines', () => {
    const activities = [makeActivity('encoded_polyline_data')]
    render(<RouteMap activities={activities} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows fallback text when no activities have polylines', () => {
    const activities = [
      makeActivity(''),      // empty polyline (private activity)
      makeActivity(null),    // null map
    ]
    render(<RouteMap activities={activities} />)
    expect(screen.getByText(/No hay rutas disponibles/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="components/__tests__/RouteMap"
```

Expected: FAIL — `RouteMap` module not found.

- [ ] **Step 3: Create RouteMap.tsx**

Create `components/RouteMap.tsx`:

```tsx
'use client'

import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import polyline from '@mapbox/polyline'
import type { StravaSummaryActivity } from '@/types/strava'
import type { LatLngTuple } from 'leaflet'

interface Props {
  activities: StravaSummaryActivity[]
}

function FitBounds({ routes }: { routes: LatLngTuple[][] }) {
  const map = useMap()
  useEffect(() => {
    const allPoints = routes.flat()
    if (allPoints.length === 0) return
    map.fitBounds(allPoints)
  }, [map, routes])
  return null
}

export default function RouteMap({ activities }: Props) {
  const routes: LatLngTuple[][] = activities
    .filter((a) => a.map?.summary_polyline)
    .map((a) => polyline.decode(a.map!.summary_polyline) as LatLngTuple[])
    .filter((r) => r.length > 0)

  if (routes.length === 0) {
    return (
      <p className="text-white/40 text-sm text-center py-8">
        No hay rutas disponibles
      </p>
    )
  }

  return (
    <MapContainer
      center={[40.4, -3.7]}
      zoom={6}
      className="h-96 rounded-2xl overflow-hidden"
      zoomControl={true}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
      />
      <FitBounds routes={routes} />
      {routes.map((positions, i) => (
        <Polyline
          key={i}
          positions={positions}
          color="#FC4C02"
          weight={2}
          opacity={0.4}
        />
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 4: Run the test**

```bash
npm test -- --testPathPattern="components/__tests__/RouteMap"
```

Expected: PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/RouteMap.tsx components/__tests__/RouteMap.test.tsx
git commit -m "feat: add RouteMap component with Leaflet polylines"
```

---

### Task 6: Add Leaflet CSS and integrate RouteMap in dashboard

**Files:**
- Modify: `app/globals.css`
- Modify: `app/dashboard/page.tsx`

Leaflet requires its CSS loaded globally. The `RouteMap` component must be imported with `dynamic` + `ssr: false` because Leaflet accesses `window`.

- [ ] **Step 1: Add Leaflet CSS to globals.css**

In `app/globals.css`, add at the very top (before any Tailwind directives):

```css
@import 'leaflet/dist/leaflet.css';
```

- [ ] **Step 2: Add dynamic RouteMap import to dashboard/page.tsx**

At the top of `app/dashboard/page.tsx`, add after the existing imports:

```tsx
import dynamic from 'next/dynamic'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })
```

- [ ] **Step 3: Add RouteMap to the JSX**

In the return JSX of `DashboardPage`, add after `<FunFact funFacts={funFacts} />`:

```tsx
<section>
  <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
    Tus Rutas
  </h2>
  <RouteMap activities={activities} />
</section>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: build completes successfully with no errors. (Warnings about Leaflet icon paths can be ignored — we use Polylines, not markers.)

- [ ] **Step 6: Smoke test in browser**

```bash
npm run dev
```

Open http://localhost:3000, log in and verify:
- Map renders with dark tiles
- Orange routes visible where you have run/cycled
- Map auto-fits to your routes
- No console errors about SSR

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/dashboard/page.tsx
git commit -m "feat: integrate RouteMap into dashboard with Leaflet CSS"
```

---

## Final steps

- [ ] **Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Final build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Deploy**

```bash
git push origin main
```

Vercel will auto-deploy from `master`. Check the dashboard at `https://strava-dashboard-brown.vercel.app` once the deploy finishes.
