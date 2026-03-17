# Strava Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 portfolio dashboard that connects to Strava via OAuth and shows a user's lifetime running statistics in a visually striking dark-themed UI.

**Architecture:** Next.js 14 App Router with Server Components for data fetching. Strava OAuth hand-rolled with tokens stored in an httpOnly cookie. Middleware handles both route protection and transparent token refresh — no database required.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Vercel. Tests: Jest + React Testing Library.

---

## Chunk 1: Foundation

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `.env.local`, `.env.example`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Scaffold the app**

Run inside `C:\Users\onofr\StravaDashboard`:

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --yes
```

Expected: Creates `app/`, `public/`, `package.json`, `next.config.ts`, `tailwind.config.ts`, etc. Answer any interactive prompts with defaults.

- [ ] **Step 2: Install testing dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest ts-jest
```

- [ ] **Step 3: Create Jest config**

Create `jest.config.ts`:
```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create environment files**

Create `.env.local` (never commit this):
```
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
COOKIE_SECRET=replace_with_32_plus_char_random_string
```

Create `.env.example`:
```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
COOKIE_SECRET=
```

- [ ] **Step 5: Ensure .env.local is in .gitignore**

Open `.gitignore` and confirm `.env.local` is listed. Add it if missing:
```
.env.local
```

- [ ] **Step 6: Remove default Next.js boilerplate**

Replace `app/globals.css` with only Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Replace `app/page.tsx` with a temporary placeholder:
```tsx
export default function Home() {
  return <main>Placeholder</main>
}
```

- [ ] **Step 7: Verify project starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 with no errors.

- [ ] **Step 8: Commit**

```bash
git add app/ public/ package.json package-lock.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs .gitignore jest.config.ts jest.setup.ts .env.example eslint.config.mjs
git commit -m "chore: scaffold Next.js 14 project with TypeScript, Tailwind, Jest"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `types/strava.ts`

- [ ] **Step 1: Create types file**

Create `types/strava.ts`:
```ts
// Strava API response types — matches Strava v3 API

export interface StravaAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string          // URL to profile photo (large size)
  city: string | null
  country: string | null
  created_at: string       // ISO8601 date
}

export interface StravaActivityTotals {
  count: number
  distance: number         // meters
  moving_time: number      // seconds
  elapsed_time: number     // seconds
  elevation_gain: number   // meters
}

export interface StravaStats {
  all_run_totals: StravaActivityTotals
  ytd_run_totals: StravaActivityTotals
  recent_run_totals: StravaActivityTotals
  biggest_ride_distance: number
  biggest_climb_elevation_gain: number
}

export interface StravaSummaryActivity {
  id: number
  name: string
  distance: number         // meters
  moving_time: number      // seconds
  elapsed_time: number     // seconds
  total_elevation_gain: number  // meters
  sport_type: string       // 'Run', 'Ride', 'Walk', etc.
  start_date: string       // UTC ISO8601
  start_date_local: string // Local timezone ISO8601
}

// Session data stored in the httpOnly cookie
export interface StravaSession {
  access_token: string
  refresh_token: string
  expires_at: number       // Unix timestamp in seconds
  athlete_id: number
}

// Strava token endpoint response (exchange + refresh)
export interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: StravaAthlete
}
```

- [ ] **Step 2: Commit**

```bash
git add types/strava.ts
git commit -m "feat: add Strava TypeScript types"
```

---

### Task 3: Geographic challenge data

**Files:**
- Create: `lib/challenges.ts`
- Create: `lib/__tests__/challenges.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/challenges.test.ts`:
```ts
import { MILESTONES, getCurrentChallenge } from '../challenges'

describe('MILESTONES', () => {
  it('is sorted by distance ascending', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].km).toBeGreaterThan(MILESTONES[i - 1].km)
    }
  })

  it('has Madrid → Moscú as final milestone at 4900 km', () => {
    const last = MILESTONES[MILESTONES.length - 1]
    expect(last.destination).toBe('Moscú')
    expect(last.km).toBe(4900)
  })
})

describe('getCurrentChallenge', () => {
  it('returns first milestone when user has 0 km', () => {
    const result = getCurrentChallenge(0)
    expect(result.current.destination).toBe('Segovia')
    expect(result.progress).toBe(0)
    expect(result.completed).toHaveLength(0)
    expect(result.allCompleted).toBe(false)
  })

  it('marks milestone as completed when user exactly meets the distance', () => {
    const result = getCurrentChallenge(88)
    expect(result.completed).toHaveLength(1)
    expect(result.completed[0].destination).toBe('Segovia')
    expect(result.current.destination).toBe('Valencia')
  })

  it('computes correct progress within current segment', () => {
    // Between Segovia (88) and Valencia (356): range = 268 km
    // User at 200 km: (200 - 88) / (356 - 88) = 112 / 268 ≈ 0.418
    const result = getCurrentChallenge(200)
    expect(result.progress).toBeCloseTo(0.418, 2)
    expect(result.remainingKm).toBeCloseTo(156, 0)
  })

  it('returns allCompleted=true when user exceeds final milestone', () => {
    const result = getCurrentChallenge(5000)
    expect(result.allCompleted).toBe(true)
    expect(result.laps).toBeCloseTo(5000 / 4900, 1)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest lib/__tests__/challenges.test.ts
```

Expected: FAIL — "Cannot find module '../challenges'"

- [ ] **Step 3: Implement challenges.ts**

Create `lib/challenges.ts`:
```ts
export interface Milestone {
  destination: string
  km: number
}

export const MILESTONES: Milestone[] = [
  { destination: 'Segovia',   km: 88 },
  { destination: 'Valencia',  km: 356 },
  { destination: 'Barcelona', km: 621 },
  { destination: 'París',     km: 1276 },
  { destination: 'Londres',   km: 1706 },
  { destination: 'Roma',      km: 1950 },
  { destination: 'Berlín',    km: 2320 },
  { destination: 'Estambul',  km: 3432 },
  { destination: 'Moscú',     km: 4900 },
]

export interface ChallengeState {
  completed: Milestone[]
  current: Milestone
  progress: number       // 0–1, progress within the current segment
  remainingKm: number
  allCompleted: boolean
  laps: number           // only meaningful when allCompleted is true
}

export function getCurrentChallenge(userKm: number): ChallengeState {
  const lastMilestone = MILESTONES[MILESTONES.length - 1]

  if (userKm >= lastMilestone.km) {
    return {
      completed: MILESTONES,
      current: lastMilestone,
      progress: 1,
      remainingKm: 0,
      allCompleted: true,
      laps: userKm / lastMilestone.km,
    }
  }

  const currentIndex = MILESTONES.findIndex((m) => userKm < m.km)
  const current = MILESTONES[currentIndex]
  const prevKm = currentIndex === 0 ? 0 : MILESTONES[currentIndex - 1].km
  const completed = MILESTONES.slice(0, currentIndex)
  const progress = (userKm - prevKm) / (current.km - prevKm)
  const remainingKm = current.km - userKm

  return {
    completed,
    current,
    progress,
    remainingKm,
    allCompleted: false,
    laps: 0,
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest lib/__tests__/challenges.test.ts
```

Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/challenges.ts lib/__tests__/challenges.test.ts
git commit -m "feat: add geographic challenge milestones and getCurrentChallenge()"
```

---

### Task 4: Stats calculations library

**Files:**
- Create: `lib/calculations.ts`
- Create: `lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/calculations.test.ts`:
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
} from '../calculations'
import type { StravaSummaryActivity } from '@/types/strava'

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
  ...overrides,
})

describe('formatPace', () => {
  it('formats seconds and meters to min/km string', () => {
    // 1500s for 5000m = 300 s/km = 5'00"/km
    expect(formatPace(1500, 5000)).toBe("5'00\"/km")
  })

  it('returns — when distance is 0', () => {
    expect(formatPace(1000, 0)).toBe('—')
  })
})

describe('formatTime', () => {
  it('formats seconds to Xh Ym for times over 1 hour', () => {
    expect(formatTime(3661)).toBe('1h 1m')
  })

  it('formats minutes only for times under 1 hour', () => {
    expect(formatTime(1800)).toBe('30m')
  })
})

describe('formatElevation', () => {
  it('formats meters below 1000 as meters', () => {
    expect(formatElevation(850)).toBe('850 m')
  })

  it('formats 1000+ meters as km with 1 decimal', () => {
    expect(formatElevation(12500)).toBe('12.5 km')
  })
})

describe('getPrimarySport', () => {
  it('returns the most frequent sport_type', () => {
    const activities = [
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Ride' }),
    ]
    expect(getPrimarySport(activities)).toBe('Run')
  })

  it('returns — for empty array', () => {
    expect(getPrimarySport([])).toBe('—')
  })
})

describe('getBestForDistance', () => {
  it('finds activity with lowest moving_time in distance range', () => {
    const activities = [
      makeActivity({ id: 1, distance: 5050, moving_time: 1600 }),
      makeActivity({ id: 2, distance: 5010, moving_time: 1450 }),
      makeActivity({ id: 3, distance: 4700, moving_time: 1400 }), // outside range
    ]
    const best = getBestForDistance(activities, 4800, 5200)
    expect(best?.id).toBe(2)
  })

  it('returns null when no activity falls in range', () => {
    expect(getBestForDistance([], 4800, 5200)).toBeNull()
  })
})

describe('getBestWeek', () => {
  it('returns the ISO week with highest summed distance', () => {
    const activities = [
      // Week 3, 2024 (Jan 15): 5 km
      makeActivity({ id: 1, distance: 5000, start_date_local: '2024-01-15T09:00:00' }),
      // Week 3, 2024 (Jan 17): 6 km — same week total = 11 km
      makeActivity({ id: 2, distance: 6000, start_date_local: '2024-01-17T09:00:00' }),
      // Week 4, 2024 (Jan 22): 8 km
      makeActivity({ id: 3, distance: 8000, start_date_local: '2024-01-22T09:00:00' }),
    ]
    const best = getBestWeek(activities)
    expect(best.totalKm).toBeCloseTo(11, 1)
    expect(best.label).toContain('2024')
  })

  it('returns totalKm=0 for empty array', () => {
    expect(getBestWeek([]).totalKm).toBe(0)
  })
})

describe('getBestMonth', () => {
  it('returns the calendar month with highest summed distance', () => {
    const activities = [
      makeActivity({ id: 1, distance: 5000, start_date_local: '2024-01-15T09:00:00' }),
      makeActivity({ id: 2, distance: 6000, start_date_local: '2024-01-20T09:00:00' }),
      makeActivity({ id: 3, distance: 8000, start_date_local: '2024-02-10T09:00:00' }),
    ]
    const best = getBestMonth(activities)
    expect(best.totalKm).toBeCloseTo(11, 1)
    expect(best.label).toBe('Enero 2024')
  })
})

describe('computeFunFacts', () => {
  it('computes all four equivalences', () => {
    const facts = computeFunFacts(780, 3718)
    expect(facts.caminoLaps).toBeCloseTo(1, 1)
    expect(facts.teideLaps).toBeCloseTo(1, 1)
    expect(facts.marathons).toBeCloseTo(780 / 42.195, 1)
    expect(facts.retiroLaps).toBe(Math.round(780 / 3.2))
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest lib/__tests__/calculations.test.ts
```

Expected: FAIL — "Cannot find module '../calculations'"

- [ ] **Step 3: Implement calculations.ts**

Create `lib/calculations.ts`:
```ts
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
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest lib/__tests__/calculations.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/calculations.ts lib/__tests__/calculations.test.ts
git commit -m "feat: add stats calculation utilities with tests"
```

---

## Chunk 2: Authentication

### Task 5: Middleware — route protection + token refresh

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware**

Create `middleware.ts` at the project root:
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { StravaSession, StravaTokenResponse } from '@/types/strava'

const COOKIE_NAME = 'strava_session'
const TOKEN_URL = 'https://www.strava.com/oauth/token'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME)

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let session: StravaSession
  try {
    const parsed = JSON.parse(sessionCookie.value)
    // Validate required fields — guard against malformed-but-valid-JSON cookies
    if (
      typeof parsed?.access_token !== 'string' ||
      typeof parsed?.refresh_token !== 'string' ||
      typeof parsed?.expires_at !== 'number' ||
      typeof parsed?.athlete_id !== 'number'
    ) {
      throw new Error('Invalid session shape')
    }
    session = parsed as StravaSession
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url))
    res.cookies.delete(COOKIE_NAME) // COOKIE_NAME = 'strava_session'
    return res
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (session.expires_at > nowSec) {
    return NextResponse.next()
  }

  // Token expired — attempt refresh
  try {
    const refreshRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.refresh_token,
      }),
    })

    if (!refreshRes.ok) throw new Error('Refresh failed')

    const data = (await refreshRes.json()) as StravaTokenResponse
    const updatedSession: StravaSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: session.athlete_id,
    }

    const response = NextResponse.next()
    response.cookies.set(COOKIE_NAME, JSON.stringify(updatedSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url))
    res.cookies.delete(COOKIE_NAME) // COOKIE_NAME = 'strava_session'
    return res
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware with route protection and token refresh"
```

---

### Task 6: OAuth initiation route

**Files:**
- Create: `app/api/auth/strava/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/auth/strava/route.ts`:
```ts
import { NextResponse } from 'next/server'

export function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.STRAVA_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Strava configuration' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()

  const stravaUrl = new URL('https://www.strava.com/oauth/authorize')
  stravaUrl.searchParams.set('client_id', clientId)
  stravaUrl.searchParams.set('redirect_uri', redirectUri)
  stravaUrl.searchParams.set('response_type', 'code')
  stravaUrl.searchParams.set('approval_prompt', 'auto')
  // Note: searchParams.set() auto-URL-encodes the comma → %2C, which Strava accepts correctly
  stravaUrl.searchParams.set('scope', 'read,activity:read_all')
  stravaUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(stravaUrl.toString())
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })
  return response
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/strava/route.ts
git commit -m "feat: add Strava OAuth initiation route with CSRF state"
```

---

### Task 7: OAuth callback route

**Files:**
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/auth/callback/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import type { StravaSession, StravaTokenResponse } from '@/types/strava'

const TOKEN_URL = 'https://www.strava.com/oauth/token'
const COOKIE_NAME = 'strava_session'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // User cancelled authorization
  if (searchParams.get('error')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const stateCookie = request.cookies.get('oauth_state')?.value

  // CSRF validation: state must be present and match
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`)
    }

    const data = (await tokenRes.json()) as StravaTokenResponse

    // Strava includes athlete on authorization_code exchange but not on refresh.
    // If absent here, the exchange itself failed or returned an unexpected payload.
    if (!data.athlete?.id) {
      throw new Error('No athlete in token response — redirect to /')
    }

    const session: StravaSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete.id,
    }

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set(COOKIE_NAME, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    response.cookies.delete('oauth_state')
    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
```

- [ ] **Step 2: Smoke test the full OAuth flow**

1. Ensure `.env.local` has real Strava credentials and `npm run dev` is running
2. Visit http://localhost:3000/api/auth/strava — verify redirect to Strava authorization page
3. Authorize on Strava — verify redirect back to http://localhost:3000/dashboard
4. Open browser DevTools → Application → Cookies → verify `strava_session` cookie exists and is httpOnly
5. Visit http://localhost:3000/api/auth/logout — verify cookie is cleared and redirect to `/`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/callback/route.ts
git commit -m "feat: add OAuth callback route with CSRF validation and token exchange"
```

---

### Task 8: Logout route

**Files:**
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/auth/logout/route.ts`:
```ts
import { NextResponse } from 'next/server'

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.delete('strava_session')
  return response
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/logout/route.ts
git commit -m "feat: add logout route"
```

---

## Chunk 3: Data Layer & Dashboard

### Task 9: Strava API client

**Files:**
- Create: `lib/strava.ts`

- [ ] **Step 1: Create strava.ts**

Create `lib/strava.ts`:
```ts
import { cookies } from 'next/headers'
import type {
  StravaAthlete,
  StravaStats,
  StravaSummaryActivity,
  StravaSession,
} from '@/types/strava'

const BASE = 'https://www.strava.com/api/v3'
const COOKIE_NAME = 'strava_session'

export function getSession(): StravaSession | null {
  const cookie = cookies().get(COOKIE_NAME)
  if (!cookie?.value) return null
  try {
    const parsed = JSON.parse(cookie.value)
    // Validate required fields before trusting the cookie
    if (
      typeof parsed?.access_token !== 'string' ||
      typeof parsed?.refresh_token !== 'string' ||
      typeof parsed?.expires_at !== 'number' ||
      typeof parsed?.athlete_id !== 'number'
    ) {
      return null
    }
    return parsed as StravaSession
  } catch {
    return null
  }
}

export class StravaRateLimitError extends Error {
  constructor() {
    super('Strava rate limit exceeded')
    this.name = 'StravaRateLimitError'
  }
}

async function stravaFetch<T>(endpoint: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 }, // always fresh, no Next.js caching
  })

  if (res.status === 429) throw new StravaRateLimitError()
  if (!res.ok) throw new Error(`Strava API error: ${res.status} ${endpoint}`)

  return res.json() as Promise<T>
}

export async function getAthlete(token: string): Promise<StravaAthlete> {
  return stravaFetch<StravaAthlete>('/athlete', token)
}

export async function getAthleteStats(
  token: string,
  athleteId: number
): Promise<StravaStats> {
  return stravaFetch<StravaStats>(`/athletes/${athleteId}/stats`, token)
}

export async function getAllActivities(
  token: string
): Promise<StravaSummaryActivity[]> {
  const allActivities: StravaSummaryActivity[] = []
  const MAX_PAGES = 3

  for (let page = 1; page <= MAX_PAGES; page++) {
    const activities = await stravaFetch<StravaSummaryActivity[]>(
      `/athlete/activities?per_page=200&page=${page}`,
      token
    )
    allActivities.push(...activities)
    if (activities.length < 200) break
  }

  return allActivities
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/strava.ts
git commit -m "feat: add Strava API client with pagination and rate limit handling"
```

---

### Task 10: Dashboard page — data fetching and layout

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/error.tsx`

- [ ] **Step 1: Create the dashboard Server Component**

Create `app/dashboard/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import {
  getSession,
  getAthlete,
  getAthleteStats,
  getAllActivities,
  StravaRateLimitError,
} from '@/lib/strava'
import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
} from '@/lib/calculations'
import { getCurrentChallenge } from '@/lib/challenges'
import ProfileCard from '@/components/ProfileCard'
import MetricsGrid from '@/components/MetricsGrid'
import BestMarks from '@/components/BestMarks'
import ChallengeBar from '@/components/ChallengeBar'
import Achievements from '@/components/Achievements'
import FunFact from '@/components/FunFact'

export default async function DashboardPage() {
  const session = getSession()
  if (!session) redirect('/')

  try {
    const [athlete, stats, activities] = await Promise.all([
      getAthlete(session.access_token),
      getAthleteStats(session.access_token, session.athlete_id),
      getAllActivities(session.access_token),
    ])

    const totals = stats.all_run_totals
    const totalKm = totals.distance / 1000

    const bestMarks = {
      best5k:       getBestForDistance(activities, 4800, 5200),
      best10k:      getBestForDistance(activities, 9800, 10300),
      bestHalf:     getBestForDistance(activities, 20900, 21500),
      bestMarathon: getBestForDistance(activities, 42000, 43000),
      longest: activities.reduce(
        (best, a) => (a.distance > (best?.distance ?? 0) ? a : best),
        null as (typeof activities)[0] | null
      ),
      bestWeek:  getBestWeek(activities),
      bestMonth: getBestMonth(activities),
    }

    const challenge = getCurrentChallenge(totalKm)
    const funFacts  = computeFunFacts(totalKm, totals.elevation_gain)

    const metrics = {
      totalKm:        totalKm.toFixed(1),
      totalActivities: totals.count,
      totalTime:       formatTime(totals.moving_time),
      elevation:       formatElevation(totals.elevation_gain),
      avgPace:         formatPace(totals.moving_time, totals.distance),
      avgDistance:     totals.count > 0
        ? `${(totalKm / totals.count).toFixed(1)} km`
        : '—',
    }

    const primarySport = getPrimarySport(activities)
    const athleteSince = new Date(athlete.created_at).getFullYear().toString()

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
          />
          <MetricsGrid metrics={metrics} />
          <BestMarks bestMarks={bestMarks} />
          <ChallengeBar challenge={challenge} />
          <Achievements totals={totals} activities={activities} bestMarks={bestMarks} />
          <FunFact funFacts={funFacts} />
        </div>
      </main>
    )
  } catch (error) {
    if (error instanceof StravaRateLimitError) {
      return (
        <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-xl font-bold">Strava está ocupado.</p>
            <p className="text-white/60">Intenta de nuevo en unos minutos.</p>
            <a
              href="/dashboard"
              className="inline-block mt-4 px-6 py-2 bg-[#FC4C02] rounded-full text-sm font-semibold"
            >
              Reintentar
            </a>
          </div>
        </main>
      )
    }
    throw error
  }
}
```

- [ ] **Step 2: Create error boundary**

Create `app/dashboard/error.tsx`:
```tsx
'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-xl font-bold">Algo salió mal.</p>
        <button
          onClick={reset}
          className="mt-4 px-6 py-2 bg-[#FC4C02] rounded-full text-sm font-semibold"
        >
          Reintentar
        </button>
        <div className="mt-2">
          <a href="/" className="text-white/40 text-sm hover:text-white/70">
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/error.tsx
git commit -m "feat: add dashboard Server Component with parallel data fetching"
```

---

## Chunk 4: UI Components

### Task 11: ProfileCard

**Files:**
- Create: `components/ProfileCard.tsx`

- [ ] **Step 1: Create component**

Create `components/ProfileCard.tsx`:
```tsx
import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
}

export default function ProfileCard({ athlete, primarySport, athleteSince }: Props) {
  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`

  return (
    <div className="flex items-center gap-6 bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
      <div className="relative w-20 h-20 flex-shrink-0">
        <Image
          src={athlete.profile}
          alt={fullName}
          fill
          className="rounded-full object-cover"
          unoptimized
        />
      </div>
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-bold text-white truncate">{fullName}</h1>
        {location && (
          <p className="text-white/60 text-sm">{location}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
            {primarySport}
          </span>
          <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
            Atleta desde {athleteSince}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ProfileCard.tsx
git commit -m "feat: add ProfileCard component"
```

---

### Task 12: MetricsGrid

**Files:**
- Create: `components/MetricsGrid.tsx`

- [ ] **Step 1: Create component**

Create `components/MetricsGrid.tsx`:
```tsx
interface Metrics {
  totalKm: string
  totalActivities: number
  totalTime: string
  elevation: string
  avgPace: string
  avgDistance: string
}

interface Props {
  metrics: Metrics
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className="text-4xl font-bold text-white leading-none mt-1">{value}</span>
    </div>
  )
}

export default function MetricsGrid({ metrics }: Props) {
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Métricas de Running
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Kilómetros totales"   value={`${metrics.totalKm} km`} />
        <MetricCard label="Actividades"           value={metrics.totalActivities} />
        <MetricCard label="Tiempo entrenado"      value={metrics.totalTime} />
        <MetricCard label="Desnivel acumulado"    value={metrics.elevation} />
        <MetricCard label="Ritmo medio"           value={metrics.avgPace} />
        <MetricCard label="Distancia media"       value={metrics.avgDistance} />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/MetricsGrid.tsx
git commit -m "feat: add MetricsGrid component"
```

---

### Task 13: BestMarks

**Files:**
- Create: `components/BestMarks.tsx`

- [ ] **Step 1: Create component**

Create `components/BestMarks.tsx`:
```tsx
import type { StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'
import { formatPace } from '@/lib/calculations'

interface BestMarksData {
  best5k:       StravaSummaryActivity | null
  best10k:      StravaSummaryActivity | null
  bestHalf:     StravaSummaryActivity | null
  bestMarathon: StravaSummaryActivity | null
  longest:      StravaSummaryActivity | null
  bestWeek:     PeriodBest
  bestMonth:    PeriodBest
}

interface Props {
  bestMarks: BestMarksData
}

function BestCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  const noData = value === 'Sin datos'
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider truncate">{label}</span>
      <span className={`text-xl font-bold ${noData ? 'text-white/30' : 'text-[#FC4C02]'}`}>
        {value}
      </span>
      {sublabel && (
        <span className="text-xs text-white/30 truncate">{sublabel}</span>
      )}
    </div>
  )
}

function activityPace(a: StravaSummaryActivity | null): string {
  if (!a) return 'Sin datos'
  return formatPace(a.moving_time, a.distance)
}

export default function BestMarks({ bestMarks }: Props) {
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Mejores Marcas
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BestCard
          label="5K"
          value={activityPace(bestMarks.best5k)}
          sublabel={bestMarks.best5k ? `${(bestMarks.best5k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="10K"
          value={activityPace(bestMarks.best10k)}
          sublabel={bestMarks.best10k ? `${(bestMarks.best10k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Media Maratón"
          value={activityPace(bestMarks.bestHalf)}
          sublabel={bestMarks.bestHalf ? `${(bestMarks.bestHalf.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Maratón"
          value={activityPace(bestMarks.bestMarathon)}
          sublabel={bestMarks.bestMarathon ? `${(bestMarks.bestMarathon.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Actividad más larga"
          value={bestMarks.longest ? `${(bestMarks.longest.distance / 1000).toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.longest?.name}
        />
        <BestCard
          label="Semana récord"
          value={bestMarks.bestWeek.totalKm > 0 ? `${bestMarks.bestWeek.totalKm.toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.bestWeek.label || undefined}
        />
        <BestCard
          label="Mes récord"
          value={bestMarks.bestMonth.totalKm > 0 ? `${bestMarks.bestMonth.totalKm.toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.bestMonth.label || undefined}
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/BestMarks.tsx
git commit -m "feat: add BestMarks component"
```

---

### Task 14: ChallengeBar

**Files:**
- Create: `components/ChallengeBar.tsx`

- [ ] **Step 1: Create component**

Create `components/ChallengeBar.tsx`:
```tsx
import type { ChallengeState } from '@/lib/challenges'

interface Props {
  challenge: ChallengeState
}

export default function ChallengeBar({ challenge }: Props) {
  if (challenge.allCompleted) {
    return (
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Reto Geográfico
        </h2>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 text-center space-y-3">
          <div className="text-5xl">🏆</div>
          <p className="text-white font-bold text-lg">
            ¡Has completado toda la ruta Madrid → Moscú!
          </p>
          <p className="text-white/60 text-sm">
            Has recorrido el equivalente a{' '}
            <span className="text-[#FC4C02] font-bold">
              {challenge.laps.toFixed(1)} vueltas completas
            </span>
          </p>
        </div>
      </section>
    )
  }

  const progressPercent = Math.round(challenge.progress * 100)
  const coveredKm = (challenge.current.km - challenge.remainingKm).toFixed(0)

  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Reto Geográfico
      </h2>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 space-y-4">
        {challenge.completed.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {challenge.completed.map((m) => (
              <span
                key={m.destination}
                className="text-xs bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/30 rounded-full px-3 py-1"
              >
                ✓ {m.destination}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold text-lg">
              Madrid → {challenge.current.destination}
            </span>
            <span className="text-[#FC4C02] font-bold text-lg">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FC4C02] rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>{coveredKm} km recorridos en este tramo</span>
            <span>Te faltan {Math.round(challenge.remainingKm)} km</span>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ChallengeBar.tsx
git commit -m "feat: add ChallengeBar component with animated progress bar"
```

---

### Task 15: Achievements

**Files:**
- Create: `components/Achievements.tsx`

- [ ] **Step 1: Create component**

Create `components/Achievements.tsx`:
```tsx
import type { StravaActivityTotals, StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'

// Props include the full bestMarks object — only bestWeek and bestMonth are used here.
// The broader type keeps the call site in dashboard/page.tsx clean (no destructuring needed).
interface Props {
  totals: StravaActivityTotals
  activities: StravaSummaryActivity[]
  bestMarks: {
    bestWeek: PeriodBest
    bestMonth: PeriodBest
    [key: string]: unknown
  }
}

function Badge({ label, icon, unlocked }: { label: string; icon: string; unlocked: boolean }) {
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
    </div>
  )
}

export default function Achievements({ totals, activities, bestMarks }: Props) {
  const totalKm   = totals.distance / 1000
  const hasHalf    = activities.some((a) => a.distance >= 20900)
  const hasMarathon = activities.some((a) => a.distance >= 42000)

  const badges = [
    { label: 'Primeros 100 km',       icon: '🌱', unlocked: totalKm >= 100 },
    { label: 'Primeros 500 km',       icon: '⚡', unlocked: totalKm >= 500 },
    { label: 'Primer 1.000 km',       icon: '🔥', unlocked: totalKm >= 1000 },
    { label: 'Primeros 5.000 km',     icon: '🚀', unlocked: totalKm >= 5000 },
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
          <Badge key={b.label} {...b} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Achievements.tsx
git commit -m "feat: add Achievements badge grid component"
```

---

### Task 16: FunFact

**Files:**
- Create: `components/FunFact.tsx`

- [ ] **Step 1: Create component**

Create `components/FunFact.tsx`:
```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { FunFacts } from '@/lib/calculations'

interface Props {
  funFacts: FunFacts
}

// Defined outside the component so the array reference is stable
// and startInterval's closure doesn't re-capture on every render
const FACT_COUNT = 4

export default function FunFact({ funFacts }: Props) {
  const facts = [
    {
      icon: '🚶',
      text: 'Has recorrido el equivalente a',
      highlight: `${funFacts.caminoLaps} veces el Camino de Santiago`,
    },
    {
      icon: '🌋',
      text: 'Has subido el equivalente a',
      highlight: `${funFacts.teideLaps} veces el Teide`,
    },
    {
      icon: '🏃',
      text: 'Has completado el equivalente a',
      highlight: `${funFacts.marathons} maratones`,
    },
    {
      icon: '🌳',
      text: 'Has dado',
      highlight: `${funFacts.retiroLaps} vueltas al Parque del Retiro`,
    },
  ]

  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startInterval = () => {
    intervalRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % FACT_COUNT)
        setVisible(true)
      }, 300)
    }, 5000)
  }

  useEffect(() => {
    startInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startInterval])

  const handleMouseEnter = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const handleMouseLeave = () => {
    startInterval()
  }

  const current = facts[index]

  return (
    <section className="pb-10">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Dato Curioso
      </h2>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`flex items-center gap-4 transition-opacity duration-300 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-4xl flex-shrink-0">{current.icon}</span>
          <div>
            <p className="text-white/60 text-sm">{current.text}</p>
            <p className="text-white font-bold text-xl">{current.highlight}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-5">
          {facts.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-[#FC4C02]' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/FunFact.tsx
git commit -m "feat: add FunFact rotating card component"
```

---

## Chunk 5: Polish & Deploy

### Task 17: Configure Tailwind and root layout

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update Tailwind config**

Replace `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        strava: '#FC4C02',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Update root layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Strava Dashboard',
  description: 'Tu historial deportivo de un vistazo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#0f0f0f] antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts app/layout.tsx
git commit -m "chore: configure Tailwind and root layout with Inter font"
```

---

### Task 18: Landing page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Build landing page**

Replace `app/page.tsx`:
```tsx
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-[#FC4C02] rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#FC4C02]/20">
            <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Strava Dashboard</h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Toda tu historia deportiva de un vistazo.
            <br />
            Tus mejores marcas, tus logros, tu reto.
          </p>
        </div>

        <a
          href="/api/auth/strava"
          className="flex items-center justify-center gap-3 w-full py-4 bg-[#FC4C02] hover:bg-[#E63D00] rounded-2xl font-semibold text-white text-lg transition-colors duration-200 shadow-lg shadow-[#FC4C02]/20"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Conectar con Strava
        </a>

        <p className="text-white/30 text-xs">
          Solo lectura. Nunca publicamos en tu cuenta.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add landing page with Strava connect CTA"
```

---

### Task 19: Dashboard loading skeleton

**Files:**
- Create: `app/dashboard/loading.tsx`

- [ ] **Step 1: Create skeleton**

Create `app/dashboard/loading.tsx`:
```tsx
function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[#1a1a1a] border border-white/10 rounded-2xl animate-pulse ${className}`} />
  )
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {/* Profile */}
        <SkeletonCard className="h-28" />
        {/* Metrics 2×3 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)}
        </div>
        {/* Best marks — 7 cards (5K, 10K, Half, Marathon, Longest, Best Week, Best Month) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} className="h-20" />)}
        </div>
        {/* Challenge bar */}
        <SkeletonCard className="h-36" />
        {/* Achievements */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} className="h-20" />)}
        </div>
        {/* Fun fact */}
        <SkeletonCard className="h-28" />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/loading.tsx
git commit -m "feat: add dashboard loading skeleton"
```

---

### Task 20: Verify full local flow

- [ ] **Step 1: Fill in .env.local with real credentials**

Open `.env.local` and replace placeholder values with your actual Strava Client ID and Client Secret from strava.com/settings/api.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 with no errors.

- [ ] **Step 3: Test full OAuth flow**

1. Open http://localhost:3000 — verify landing page looks correct
2. Click "Conectar con Strava" — verify redirect to Strava
3. Authorize on Strava — verify redirect back to /dashboard
4. Verify dashboard shows your real data across all 6 blocks
5. Click "Cerrar sesión" — verify redirect to landing page

- [ ] **Step 4: Run all tests**

```bash
npx jest --verbose
```

Expected: All tests pass.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: ESLint check**

```bash
npm run lint
```

Expected: No errors or warnings.

---

### Task 21: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Vercel project**

1. Go to vercel.com → Add New Project
2. Import your GitHub repository
3. Framework: Next.js (auto-detected)
4. Click Deploy (it will fail on first deploy without env vars — that's expected)

- [ ] **Step 3: Add environment variables in Vercel**

In Vercel project → Settings → Environment Variables, add all four:
```
STRAVA_CLIENT_ID         → your client id
STRAVA_CLIENT_SECRET     → your client secret
STRAVA_REDIRECT_URI      → https://<your-app>.vercel.app/api/auth/callback
COOKIE_SECRET            → a random 32+ character string
```

- [ ] **Step 4: Update Strava app settings**

In strava.com/settings/api, update "Authorization Callback Domain" to `<your-app>.vercel.app` (without https://).

- [ ] **Step 5: Redeploy**

In Vercel dashboard → Deployments → click the three dots on the latest → Redeploy.

- [ ] **Step 6: Test production**

Open your Vercel URL and complete the full OAuth flow end to end.

- [ ] **Step 7: Final commit**

```bash
# Check status first to make sure .env.local is not staged
git status
git add app/ components/ lib/ types/ middleware.ts docs/
git commit -m "chore: production-ready — all features implemented and deployed"
```
