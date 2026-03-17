# Strava Dashboard — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

A single-page web dashboard connected to Strava via OAuth. Users log in with their Strava account and see, at a glance, the most important and visually striking highlights of their entire athletic history. The emphasis is on motivation and visual storytelling — not data analysis.

Target: portfolio project demonstrating OAuth, Next.js App Router, TypeScript, and clean UI.

---

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vercel** (deployment)
- No database — data fetched fresh from Strava API on each visit

---

## Routes

| Route | Description |
|---|---|
| `/` | Landing page with "Connect with Strava" button |
| `/dashboard` | Main dashboard (protected via `middleware.ts`) |
| `/api/auth/strava` | Initiates OAuth: generates `state`, stores in short-lived cookie, redirects to Strava |
| `/api/auth/callback` | Validates `state`, exchanges code for tokens, sets session cookie, redirects to `/dashboard` |
| `/api/auth/logout` | Clears session cookie, redirects to `/` |

---

## Folder Structure

```
/app
  /page.tsx                  → Landing page
  /dashboard/
    /page.tsx                → Dashboard (Server Component, uses Suspense)
    /loading.tsx             → Skeleton loading state
  /api/auth/
    /strava/route.ts         → OAuth initiation + state generation
    /callback/route.ts       → OAuth callback + token exchange
    /logout/route.ts         → Logout
/components
  /ProfileCard.tsx           → Athlete profile block
  /MetricsGrid.tsx           → Global stats grid
  /BestMarks.tsx             → Personal bests
  /ChallengeBar.tsx          → Visual geographic challenge
  /Achievements.tsx          → Unlocked badges
  /FunFact.tsx               → Rotating equivalences (Client Component)
/lib
  /strava.ts                 → Strava API client (typed)
  /challenges.ts             → Geographic challenge data
  /calculations.ts           → Stats aggregation logic
/types
  /strava.ts                 → TypeScript types for Strava API responses
/middleware.ts               → Protects /dashboard — redirects to / if no session cookie
```

---

## Strava API Calls

| Endpoint | Used For |
|---|---|
| `GET /athlete` | Profile: name, photo, city, country, `created_at` (account creation date) |
| `GET /athletes/{id}/stats` | Totals: distance, time, elevation, activity count (all_time run totals) |
| `GET /athlete/activities?per_page=200&page=N` | Activities list for best marks and best week/month. Capped at 3 pages (600 activities max). |

**Scopes required:** `read,activity:read_all`

**Note on personal bests:** The `/athlete/activities` endpoint returns summary activity objects. `best_efforts` is only available on detailed activity objects and requires one API call per activity — not feasible at scale. Instead, best marks are computed from summary fields using `moving_time` (excludes pauses, more meaningful for pace): for each distance category, find the activity with that approximate distance and the lowest `moving_time`. This gives "fastest run of approximately X distance" which is accurate enough for a portfolio demo.

**Pagination:** Fetch pages 1–3 (up to 600 activities). Stop early if a page returns fewer than 200 results. This is sufficient for any active Strava user and avoids rate limit issues.

**Rate limits:** Strava allows 600 requests/15min. This app makes at most ~5 calls per dashboard load (athlete + stats + up to 3 pages of activities). Well within limits.

---

## Authentication Flow

```
1. User clicks "Connect with Strava"
2. /api/auth/strava:
   - Generates a random state string (crypto.randomUUID())
   - Stores state in a short-lived cookie (httpOnly, Secure, SameSite=Lax, max-age=300)
   - Redirects to Strava OAuth URL with client_id, redirect_uri, scope, state
3. User authorizes on Strava (or cancels)
4. Strava redirects to /api/auth/callback?code=XXX&state=YYY
   OR /api/auth/callback?error=access_denied (if user cancelled)
5. /api/auth/callback:
   - If query param `error` is present → redirect to / immediately (user cancelled)
   - If state cookie is absent or does not match query param `state` → redirect to / (do not exchange the code)
   - Validates state matches the stored state cookie (CSRF protection)
   - Exchanges code for access_token + refresh_token via Strava token endpoint
   - Stores tokens in session cookie (see Cookie Spec below)
   - Clears the state cookie
   - Redirects to /dashboard
6. middleware.ts checks for session cookie presence on /dashboard routes
7. dashboard/page.tsx calls lib/strava.ts → getValidToken() before any API call
8. getValidToken() checks expires_at; if expired, calls Strava refresh endpoint and
   updates the session cookie via next/headers cookies().set(); on failure clears cookie
   and throws a redirect to /
9. Server Component uses the valid token to call Strava API, renders data server-side
```

**Token refresh:** Handled entirely in `middleware.ts` (see Dashboard Protection section). By the time `dashboard/page.tsx` runs, the token is guaranteed fresh. `getValidToken()` in `lib/strava.ts` simply reads and returns `access_token` from the cookie — no refresh logic. `athlete_id` stored in the session cookie is used directly for `GET /athletes/{id}/stats`.

---

## Cookie Spec

**Session cookie name:** `strava_session`

**Structure:** JSON blob containing:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "athlete_id": 12345
}
```

**Attributes:**
- `httpOnly: true` — not accessible from client-side JS
- `secure: true` — HTTPS only (Vercel always uses HTTPS; skip in local dev)
- `sameSite: "lax"` — prevents most CSRF
- `path: "/"` — accessible across all routes
- `maxAge: 60 * 60 * 24 * 30` — 30 days

**Note:** No encryption of cookie contents for this portfolio project. For production, use a signed/encrypted cookie with `COOKIE_SECRET`.

---

## Dashboard Protection & Token Refresh

`middleware.ts` handles both session protection and token refresh for all `/dashboard` routes:

```
1. If strava_session cookie is absent → redirect to /
2. Parse the session cookie (JSON)
3. If expires_at is in the future → pass through (NextResponse.next())
4. If expires_at is in the past:
   a. POST to Strava token refresh endpoint with refresh_token
   b. On success: build NextResponse.next() with updated Set-Cookie header (new tokens)
   c. On failure (any error): build NextResponse.redirect('/') and clear the cookie
```

**Why middleware:** Next.js 14 App Router does not allow `cookies().set()` inside Server Components — only Route Handlers and Server Actions can mutate cookies. Middleware responses (NextResponse) CAN set cookies via `response.cookies.set(...)`. Moving refresh here keeps `dashboard/page.tsx` simple: it reads the cookie and knows the token is always valid when it runs.

**`getValidToken()` in lib/strava.ts:** reads the session cookie via `cookies()` from `next/headers`. Since middleware guarantees the token is fresh before the Server Component runs, `getValidToken()` only needs to read and return the `access_token` — no refresh logic needed here.

---

## Dashboard Blocks

### Block 1 — Athlete Profile
- Circular profile photo (from `GET /athlete` → `profile` field)
- Full name (`firstname + lastname`)
- City + Country (from `city`, `country` fields)
- Primary sport: derived from most frequent `sport_type` in the activities list
- "Atleta desde [date]": uses `created_at` from `GET /athlete` (account creation date)

### Block 2 — Running Metrics (2×3 card grid)
Source: `GET /athletes/{id}/stats` → `all_run_totals`

**Note:** These metrics cover running activities only (as returned by `all_run_totals`). This is intentional — the dashboard is running-focused. The section title uses "Running" to set user expectations correctly.

- Total kilometers (`distance / 1000`, formatted with 1 decimal)
- Total activities (`count`)
- Total training time (formatted as "Xh Ym")
- Accumulated elevation gain (`elevation_gain`, formatted in meters/km)
- Average global pace (`total_time / total_distance`, formatted as "X'Y''/km". Show `"—"` if `total_distance = 0`)
- Average distance per activity (`total_distance / count`, formatted in km. Show `"—"` if `count = 0`)

### Block 3 — Personal Bests (horizontal cards)
Computed from the activities list (summary objects):

All time comparisons use `moving_time` (excludes pauses). Date grouping uses `start_date_local` (athlete's local timezone).

- **Best 5K:** activity with `distance` between 4,800m–5,200m and lowest `moving_time`
- **Best 10K:** activity with `distance` between 9,800m–10,300m and lowest `moving_time`
- **Best half marathon:** activity with `distance` between 20,900m–21,500m and lowest `moving_time`
- **Best marathon:** activity with `distance` between 42,000m–43,000m and lowest `moving_time`
- **Longest activity:** activity with highest `distance`
- **Best week:** ISO week (Monday–Sunday) with highest summed `distance`. Current incomplete week is eligible.
- **Best month:** calendar month with highest summed `distance`. Current incomplete month is eligible.

If no activity exists for a given distance, that card shows "Sin datos aún".

### Block 4 — Current Challenge (most visual)
Geographic progress bar: total lifetime km (from stats) mapped to symbolic distances from Madrid.

**Milestone list:**

| Destination | Distance (km) |
|---|---|
| Madrid → Segovia | 88 |
| Madrid → Valencia | 356 |
| Madrid → Barcelona | 621 |
| Madrid → París | 1,276 |
| Madrid → Londres | 1,706 |
| Madrid → Roma | 1,950 |
| Madrid → Berlín | 2,320 |
| Madrid → Estambul | 3,432 |
| Madrid → Moscú | 4,900 |

**Rendering logic:**
- Completed milestones: shown as ✓ checkpoints in a horizontal timeline
- Current milestone (first not yet completed): full-width animated progress bar. Progress formula: `(user_km - prev_milestone_km) / (current_milestone_km - prev_milestone_km) * 100%` where `prev_milestone_km` is 0 for the first milestone. Shows remaining km and motivational text.
- If all milestones completed: show a trophy state with text "Has completado toda la ruta Madrid → Moscú. Has recorrido equivalente a X vueltas completas." (user_km / 4900, 1 decimal)

### Block 5 — Unlocked Achievements (badge grid)
Threshold-based badges derived from metrics:

| Badge | Condition |
|---|---|
| Primeros 100 km | total_km >= 100 |
| Primeros 500 km | total_km >= 500 |
| Primer 1.000 km | total_km >= 1000 |
| Primeros 5.000 km | total_km >= 5000 |
| Primera media maratón | has activity >= 20,900m |
| Primer maratón | has activity >= 42,000m |
| Semana récord | best_week_km exists |
| Mes récord | best_month_km exists |

Locked badges are shown greyed out with a lock icon.

### Block 6 — Fun Fact (rotating card)
A Client Component that rotates through equivalences every 5 seconds (auto-play, no user interaction required, pauses on hover).

Equivalences computed at render time:
- Vueltas al Camino de Santiago: `total_km / 780` (1 decimal)
- Ascensos equivalentes al Teide: `total_elevation_m / 3718` (1 decimal)
- Maratones acumuladas: `total_km / 42.195` (1 decimal)
- Vueltas al Parque del Retiro: `total_km / 3.2` (rounded)

---

## Visual Style

| Property | Value |
|---|---|
| Background | `#0f0f0f` (page) / `#1a1a1a` (cards) |
| Accent color | `#FC4C02` (Strava orange) |
| Typography | Inter (Tailwind default) |
| Metric numbers | `text-4xl` / `text-5xl`, bold, white |
| Card borders | `border border-white/10` |
| Layout | Single vertical scroll, max-width container, no horizontal scroll |
| Progress bars | Orange fill (`#FC4C02`) on dark track (`#2a2a2a`) |
| Badges (locked) | Greyscale + opacity-40 + lock icon |

---

## Loading State

`/app/dashboard/loading.tsx` exports a skeleton component that mirrors the layout of the dashboard with animated pulse placeholders. Shown by Next.js automatically while the Server Component is fetching data.

---

## Error Handling

| Situation | Behavior |
|---|---|
| Missing session cookie | `middleware.ts` redirects to `/` |
| Token refresh fails (revoked/expired) | Clear session cookie, redirect to `/` |
| Token expired but refresh succeeds | Update cookie silently, continue rendering |
| Strava rate limit (429) | Show card: "Strava está ocupado. Intenta de nuevo en unos minutos." + retry button |
| Zero activities returned | Motivational empty state per block |
| Network/fetch error | Error boundary with "Algo salió mal" + retry link |

---

## Environment Variables

```
STRAVA_CLIENT_ID=           # From strava.com/settings/api
STRAVA_CLIENT_SECRET=       # From strava.com/settings/api
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback   # local dev placeholder
# On Vercel: set to https://<your-app>.vercel.app/api/auth/callback
COOKIE_SECRET=              # Random string for cookie signing (32+ chars)
```

**Important:** `STRAVA_REDIRECT_URI` must match exactly what is registered in Strava's developer portal. Set the Vercel environment variable to your production URL before deploying, and add the production callback URL in Strava settings under "Authorization Callback Domain".

---

## Out of Scope

- Database / data persistence
- Multiple sport types (focus on running; primary sport shown for info only)
- Social features
- Push notifications
- Mobile app
- Encrypted cookie contents (noted as production improvement)
