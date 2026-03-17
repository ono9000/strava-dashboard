# Phase 2 Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Madrid→Moscow geographic challenge with a universal yearly km milestone system, update the ProfileCard to show a top semi-circle arc with hover km info, and add a country→city sidebar to the route map.

**Architecture:** Four sequential tasks. Task 1 creates the new yearly challenge logic and deletes the old geographic challenge. Task 2 wires it into the dashboard. Task 3 updates ProfileCard. Task 4 rewrites RouteMap with sidebar.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, react-leaflet 4.2.1, Nominatim reverse geocoding (no API key)

---

## Chunk 1: Yearly challenge + dashboard wiring

### Task 1: Create yearly challenge lib, delete geographic challenge

**Files:**
- Create: `lib/yearlyChallenge.ts`
- Create: `lib/__tests__/yearlyChallenge.test.ts`
- Delete: `lib/challenges.ts`
- Delete: `lib/__tests__/challenges.test.ts`
- Delete: `components/ChallengeBar.tsx`

- [ ] **Step 1: Write the failing test first**

Create `lib/__tests__/yearlyChallenge.test.ts`:

```ts
import { getYearlyChallenge } from '../yearlyChallenge'

describe('getYearlyChallenge', () => {
  it('returns progress=0 and next=100 at 0 km', () => {
    const result = getYearlyChallenge(0)
    expect(result.progress).toBe(0)
    expect(result.nextMilestone).toBe(100)
    expect(result.prevMilestone).toBe(0)
    expect(result.allCompleted).toBe(false)
  })

  it('computes correct progress mid-segment', () => {
    // Between 100 and 250: at 175 km → progress = (175 - 100) / (250 - 100) = 0.5
    const result = getYearlyChallenge(175)
    expect(result.progress).toBeCloseTo(0.5, 2)
    expect(result.nextMilestone).toBe(250)
    expect(result.prevMilestone).toBe(100)
  })

  it('advances to next milestone when exactly at boundary', () => {
    // At exactly 100 km → should be at the 100→250 segment
    const result = getYearlyChallenge(100)
    expect(result.prevMilestone).toBe(100)
    expect(result.nextMilestone).toBe(250)
    expect(result.progress).toBe(0)
  })

  it('returns allCompleted=true at 3000+ km', () => {
    const result = getYearlyChallenge(3000)
    expect(result.allCompleted).toBe(true)
    expect(result.progress).toBe(1)
  })

  it('clamps progress to 1 above max milestone', () => {
    const result = getYearlyChallenge(5000)
    expect(result.allCompleted).toBe(true)
    expect(result.progress).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="lib/__tests__/yearlyChallenge"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/yearlyChallenge.ts`**

```ts
export interface YearlyChallengeState {
  ytdKm: number
  nextMilestone: number
  prevMilestone: number
  progress: number        // 0–1 within current segment
  icon: string
  allCompleted: boolean
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

export function getYearlyChallenge(ytdKm: number): YearlyChallengeState {
  const maxMilestone = YEARLY_MILESTONES[YEARLY_MILESTONES.length - 1]

  if (ytdKm >= maxMilestone.km) {
    return {
      ytdKm,
      nextMilestone: maxMilestone.km,
      prevMilestone: YEARLY_MILESTONES[YEARLY_MILESTONES.length - 2].km,
      progress: 1,
      icon: maxMilestone.icon,
      allCompleted: true,
    }
  }

  const nextIdx = YEARLY_MILESTONES.findIndex((m) => m.km > ytdKm)
  const next = YEARLY_MILESTONES[nextIdx]
  const prevKm = nextIdx === 0 ? 0 : YEARLY_MILESTONES[nextIdx - 1].km
  const progress = (ytdKm - prevKm) / (next.km - prevKm)

  return {
    ytdKm,
    nextMilestone: next.km,
    prevMilestone: prevKm,
    progress: Math.max(0, Math.min(1, progress)),
    icon: next.icon,
    allCompleted: false,
  }
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --testPathPattern="lib/__tests__/yearlyChallenge"
```

Expected: all 5 tests pass.

- [ ] **Step 5: Delete old geographic challenge files**

```bash
rm lib/challenges.ts lib/__tests__/challenges.test.ts components/ChallengeBar.tsx
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors for `challenges` imports — these will be fixed in Task 2. If the only errors reference `challenges.ts` or `ChallengeBar`, that's expected.

- [ ] **Step 7: Commit**

```bash
git add lib/yearlyChallenge.ts lib/__tests__/yearlyChallenge.test.ts
git rm lib/challenges.ts lib/__tests__/challenges.test.ts components/ChallengeBar.tsx
git commit -m "feat: replace geographic challenge with yearly km milestone system"
```

---

### Task 2: Update dashboard/page.tsx

**Files:**
- Modify: `app/dashboard/page.tsx`

Remove ChallengeBar and getChallengeState. Wire in getYearlyChallenge using `ytd_run_totals` (not `all_run_totals`).

- [ ] **Step 1: Update imports**

Remove from imports:
```tsx
import { getCurrentChallenge } from '@/lib/challenges'
import ChallengeBar from '@/components/ChallengeBar'
```

Add:
```tsx
import { getYearlyChallenge } from '@/lib/yearlyChallenge'
```

- [ ] **Step 2: Update data computation**

Find `const challenge = getCurrentChallenge(totalKm)` and replace with:
```tsx
const yearlyChallenge = getYearlyChallenge(stats.ytd_run_totals.distance / 1000)
```

Note: `stats.ytd_run_totals` is the year-to-date total, NOT `stats.all_run_totals`. Do not confuse with `totals` (which is `all_run_totals`).

- [ ] **Step 3: Update JSX**

Remove `<ChallengeBar challenge={challenge} />` from the JSX.

Update `<ProfileCard>` to pass `yearlyChallenge`:
```tsx
<ProfileCard
  athlete={athlete}
  primarySport={primarySport}
  athleteSince={athleteSince}
  yearlyChallenge={yearlyChallenge}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors in ProfileCard about wrong prop type — will be fixed in Task 3. If the only errors are in `ProfileCard.tsx`, that is expected.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: wire yearly challenge into dashboard, remove ChallengeBar"
```

---

## Chunk 2: ProfileCard top semi-circle + hover

### Task 3: Update ProfileCard

**Files:**
- Modify: `components/ProfileCard.tsx`

ProfileCard becomes a client component. The full-circle SVG is replaced with a top semi-circle path. The bottom label toggles between percentage and km on hover.

- [ ] **Step 1: Replace full contents of `components/ProfileCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'
import type { YearlyChallengeState } from '@/lib/yearlyChallenge'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
  yearlyChallenge: YearlyChallengeState
}

const RING_SIZE = 96
const RING_RADIUS = 44
const HALF_CIRC = Math.PI * RING_RADIUS  // ≈ 138.23

export default function ProfileCard({ athlete, primarySport, athleteSince, yearlyChallenge }: Props) {
  const [hovered, setHovered] = useState(false)

  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`
  const ringColor = yearlyChallenge.allCompleted ? '#FFD700' : '#FC4C02'

  // Top semi-circle path: M (cx-r),cy A r,r 0 0,0 (cx+r),cy
  // sweep-flag=0 → counterclockwise → top arc
  const cx = RING_SIZE / 2
  const cy = RING_SIZE / 2
  const arcPath = `M ${cx - RING_RADIUS},${cy} A ${RING_RADIUS},${RING_RADIUS} 0 0,0 ${cx + RING_RADIUS},${cy}`
  const progressDash = yearlyChallenge.progress * HALF_CIRC

  const label = yearlyChallenge.allCompleted
    ? '🏆 ¡Año completo!'
    : hovered
    ? `${Math.round(yearlyChallenge.ytdKm)} km / ${yearlyChallenge.nextMilestone} km`
    : `${yearlyChallenge.icon} ${Math.round(yearlyChallenge.progress * 100)}% → ${yearlyChallenge.nextMilestone} km`

  return (
    <div
      className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo with top semi-circle SVG ring */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        >
          {/* Background track */}
          <path
            d={arcPath}
            fill="none"
            stroke="#333"
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={ringColor}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${progressDash} ${HALF_CIRC}`}
            strokeDashoffset={0}
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

      {/* Yearly challenge label — toggles on hover */}
      <p
        className="text-sm font-bold transition-all duration-200"
        style={{ color: yearlyChallenge.allCompleted ? '#FFD700' : '#FC4C02' }}
      >
        {label}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all pass (ProfileCard has no unit tests, but existing tests must still pass).

- [ ] **Step 4: Smoke test in dev**

```bash
npm run dev
```

Open http://localhost:3000, log in, verify:
- Profile card shows top semi-circle arc (rainbow shape over photo)
- Bottom label shows `🌱 45% → 100 km` (or appropriate level)
- Hover → label changes to `45 km / 100 km`
- No full circle visible

- [ ] **Step 5: Commit**

```bash
git add components/ProfileCard.tsx
git commit -m "feat: top semi-circle arc and hover km info on ProfileCard"
```

---

## Chunk 3: RouteMap with sidebar

### Task 4: Rewrite RouteMap with country/city sidebar

**Files:**
- Modify: `components/RouteMap.tsx`
- Modify: `components/__tests__/RouteMap.test.tsx`

The RouteMap is rewritten to have a two-column layout. The right sidebar shows countries → cities derived from Nominatim reverse geocoding of each route's start point. Clicking zooms the map.

- [ ] **Step 1: Update the test file**

The existing tests test the old RouteMap. Update `components/__tests__/RouteMap.test.tsx` to test the new component structure:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
    if (!str) return []
    return [[40.4, -3.7], [41.4, -2.7]]
  },
}))

// Mock fetch for Nominatim
global.fetch = jest.fn().mockResolvedValue({
  json: async () => ({
    address: {
      city: 'Madrid',
      country: 'España',
      country_code: 'es',
    },
  }),
}) as jest.Mock

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
  beforeEach(() => jest.clearAllMocks())

  it('renders the map container when activities have polylines', () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('shows fallback when no activities have polylines', () => {
    render(<RouteMap activities={[makeActivity(''), makeActivity(null)]} />)
    expect(screen.getByText(/No hay rutas disponibles/i)).toBeInTheDocument()
  })

  it('shows loading state while geocoding', () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument()
  })

  it('shows city name after geocoding resolves', async () => {
    render(<RouteMap activities={[makeActivity('encoded_data')]} />)
    await waitFor(() => {
      expect(screen.getByText('Madrid')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="components/__tests__/RouteMap"
```

Expected: some tests fail (new structure not implemented yet).

- [ ] **Step 3: Rewrite `components/RouteMap.tsx`**

```tsx
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import polyline from '@mapbox/polyline'
import type { Map as LeafletMap, LatLngTuple } from 'leaflet'
import type { StravaSummaryActivity } from '@/types/strava'

interface Props {
  activities: StravaSummaryActivity[]
}

interface GeoResult {
  city: string
  country: string
  countryCode: string
}

interface CityNode {
  name: string
  routeIndices: number[]
}

interface CountryNode {
  name: string
  code: string
  cities: Map<string, CityNode>
}

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function roundCoord(n: number): number {
  return Math.round(n * 10) / 10  // 1 decimal place ≈ 11 km grid
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function MapController({
  mapRef,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  return null
}

function FitBounds({ routes }: { routes: LatLngTuple[][] }) {
  const map = useMap()
  useEffect(() => {
    const allPoints = routes.flat()
    if (allPoints.length === 0) return
    map.fitBounds(allPoints, { padding: [30, 30] })
  }, [map, routes])
  return null
}

export default function RouteMap({ activities }: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const [locationTree, setLocationTree] = useState<CountryNode[]>([])
  const [geocoding, setGeocoding] = useState(false)

  const routes: LatLngTuple[][] = activities
    .filter((a) => a.map?.summary_polyline)
    .map((a) => polyline.decode(a.map!.summary_polyline) as LatLngTuple[])
    .filter((r) => r.length > 0)

  const geocodeRoutes = useCallback(async () => {
    if (routes.length === 0) return
    setGeocoding(true)

    // Deduplicate: round start point to 1 decimal, max 20 unique
    const seen = new Map<string, number>()  // key → first route index
    for (let i = 0; i < routes.length; i++) {
      const [lat, lng] = routes[i][0]
      const key = `${roundCoord(lat)},${roundCoord(lng)}`
      if (!seen.has(key)) seen.set(key, i)
    }

    const uniquePoints = Array.from(seen.entries()).slice(0, 20)

    // Geocode each unique point
    const geoMap = new Map<string, GeoResult>()
    for (let i = 0; i < uniquePoints.length; i++) {
      const [key, ] = uniquePoints[i]
      const [lat, lng] = key.split(',').map(Number)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        )
        const data = await res.json()
        geoMap.set(key, {
          city:
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            'Desconocido',
          country: data.address?.country || 'Desconocido',
          countryCode: (data.address?.country_code || '??').toUpperCase(),
        })
      } catch {
        geoMap.set(key, { city: 'Desconocido', country: 'Desconocido', countryCode: '??' })
      }
      if (i < uniquePoints.length - 1) await delay(1100)
    }

    // Build country → city tree
    const countries = new Map<string, CountryNode>()
    for (let i = 0; i < routes.length; i++) {
      const [lat, lng] = routes[i][0]
      const key = `${roundCoord(lat)},${roundCoord(lng)}`
      const geo = geoMap.get(key) ?? { city: 'Desconocido', country: 'Desconocido', countryCode: '??' }

      if (!countries.has(geo.country)) {
        countries.set(geo.country, { name: geo.country, code: geo.countryCode, cities: new Map() })
      }
      const country = countries.get(geo.country)!
      if (!country.cities.has(geo.city)) {
        country.cities.set(geo.city, { name: geo.city, routeIndices: [] })
      }
      country.cities.get(geo.city)!.routeIndices.push(i)
    }

    setLocationTree(Array.from(countries.values()))
    setGeocoding(false)
  }, [routes])

  useEffect(() => {
    geocodeRoutes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (routes.length === 0) {
    return (
      <p className="text-white/40 text-sm text-center py-8">
        No hay rutas disponibles
      </p>
    )
  }

  const zoomTo = (indices: number[]) => {
    const points = indices.flatMap((i) => routes[i])
    if (points.length > 0) mapRef.current?.fitBounds(points, { padding: [20, 20] })
  }

  return (
    <div className="flex gap-3 h-96">
      {/* Map */}
      <div className="flex-1 rounded-2xl overflow-hidden">
        <MapContainer
          center={[40.4, -3.7]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapController mapRef={mapRef} />
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
      </div>

      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 overflow-y-auto">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Zonas
        </p>
        {geocoding ? (
          <p className="text-white/40 text-xs">Cargando ubicaciones…</p>
        ) : locationTree.length === 0 ? (
          <p className="text-white/40 text-xs">Sin datos de ubicación</p>
        ) : (
          locationTree.map((country) => {
            const allCountryIndices = Array.from(country.cities.values()).flatMap(
              (c) => c.routeIndices
            )
            const cities = Array.from(country.cities.values())
            return (
              <div key={country.name} className="mb-3">
                <button
                  onClick={() => zoomTo(allCountryIndices)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white w-full text-left mb-1"
                >
                  <span>{flagEmoji(country.code)}</span>
                  <span className="truncate">{country.name}</span>
                  <span className="ml-auto text-white/30 text-[10px] flex-shrink-0">
                    {allCountryIndices.length}
                  </span>
                </button>
                {cities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => zoomTo(city.routeIndices)}
                    className="flex items-center gap-1.5 w-full text-left text-xs text-white/50 hover:text-white/80 pl-5 py-0.5"
                  >
                    <span className="text-[10px]">📍</span>
                    <span className="truncate">{city.name}</span>
                    <span className="ml-auto text-white/20 flex-shrink-0">
                      {city.routeIndices.length}
                    </span>
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="components/__tests__/RouteMap"
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add components/RouteMap.tsx components/__tests__/RouteMap.test.tsx
git commit -m "feat: RouteMap with country/city sidebar and click-to-zoom"
```

---

## Final steps

- [ ] **Push to remote**

```bash
git push origin master
```

Vercel will auto-deploy. Verify at `https://strava-dashboard-brown.vercel.app`:
- Profile card: top semi-circle arc, hover shows km
- No "Reto Geográfico" section
- Map: two-column layout, sidebar loads countries/cities after geocoding
