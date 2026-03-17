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
| `/dashboard` | Main dashboard (protected, Server Component) |
| `/api/auth/strava` | Initiates OAuth flow, redirects to Strava |
| `/api/auth/callback` | Receives code from Strava, exchanges for token, sets cookie, redirects to `/dashboard` |
| `/api/auth/logout` | Clears cookie, redirects to `/` |

---

## Folder Structure

```
/app
  /page.tsx                  → Landing page
  /dashboard/page.tsx        → Dashboard (Server Component)
  /api/auth/
    /strava/route.ts         → OAuth initiation
    /callback/route.ts       → OAuth callback
    /logout/route.ts         → Logout
/components
  /ProfileCard.tsx           → Athlete profile block
  /MetricsGrid.tsx           → Global stats grid
  /BestMarks.tsx             → Personal bests
  /ChallengeBar.tsx          → Visual geographic challenge
  /Achievements.tsx          → Unlocked badges
  /FunFact.tsx               → Rotating equivalences
/lib
  /strava.ts                 → Strava API client (typed)
  /challenges.ts             → Geographic challenge data
  /calculations.ts           → Stats aggregation logic
/types
  /strava.ts                 → TypeScript types for Strava API responses
```

---

## Strava API Calls

| Endpoint | Used For |
|---|---|
| `GET /athlete` | Profile: name, photo, city, country, created_at |
| `GET /athletes/{id}/stats` | Totals: distance, time, elevation, activity count (all_time) |
| `GET /athlete/activities?per_page=200` | Best marks, best week/month (paginated if needed) |

**Scopes required:** `read,activity:read_all`

---

## Authentication Flow

```
1. User clicks "Connect with Strava"
2. /api/auth/strava → redirects to Strava OAuth URL (client_id + scopes)
3. User authorizes on Strava
4. Strava redirects to /api/auth/callback?code=XXX
5. Server exchanges code for access_token + refresh_token
6. Tokens stored in httpOnly cookie (not accessible from client JS)
7. Redirect to /dashboard
8. Server Component reads cookie, calls Strava API, renders data server-side
```

**Token refresh:** Strava access tokens expire in 6 hours. On each dashboard request, if the token is expired, the server automatically uses the refresh_token to get a new one and updates the cookie. Transparent to the user.

---

## Dashboard Blocks

### Block 1 — Athlete Profile
- Circular profile photo
- Full name
- City / Country
- Primary sport
- "Athlete since [date of first activity]"

### Block 2 — Global Metrics (2×3 card grid)
- Total kilometers
- Total activities
- Total training time
- Accumulated elevation gain
- Average global pace
- Average distance per activity

### Block 3 — Personal Bests (horizontal cards)
- Best 1K
- Best 5K
- Best 10K
- Fastest half marathon
- Fastest marathon (if exists)
- Longest activity
- Best week (km)
- Best month (km)

Personal bests are computed from activities list (best_efforts field on detailed activity). For scale, fetching up to 200 most recent activities is sufficient for a portfolio demo.

### Block 4 — Current Challenge (most visual)
Geographic progress bar showing total lifetime km mapped to symbolic distances from Madrid:

| Destination | Distance |
|---|---|
| Madrid → Segovia | 88 km |
| Madrid → Valencia | 356 km |
| Madrid → Barcelona | 621 km |
| Madrid → París | 1,276 km |
| Madrid → Londres | 1,706 km |
| Madrid → Roma | 1,950 km |
| Madrid → Berlín | 2,320 km |
| Madrid → Estambul | 3,432 km |
| Madrid → Moscú | 4,900 km |

Completed destinations shown as checkpoints (✓). Current destination shown with animated progress bar and "X km remaining" text. If all are completed, show total equivalent laps.

### Block 5 — Unlocked Achievements (badge grid)
Threshold-based badges:
- First 100 km
- First 500 km
- First 1,000 km
- First 5,000 km
- First half marathon
- First marathon
- Week record
- Month record

### Block 6 — Fun Fact (rotating card)
Rotating equivalences:
- Laps of the Camino de Santiago (780 km each)
- Ascents equivalent to El Teide (3,718 m elevation)
- Equivalent marathons completed (42.195 km)
- Laps of Parque del Retiro (~3.2 km each)

---

## Visual Style

| Property | Value |
|---|---|
| Background | `#0f0f0f` / `#1a1a1a` |
| Accent color | `#FC4C02` (Strava orange) |
| Typography | Inter (Tailwind default) |
| Metric numbers | `text-4xl` / `text-5xl`, bold |
| Layout | Single vertical scroll, no horizontal scroll |
| Cards | Dark `#1e1e1e` background, subtle border |
| Progress bars | Orange fill on dark track |

---

## Error Handling

| Situation | Behavior |
|---|---|
| Missing or invalid cookie | Redirect to `/` |
| Expired token | Auto-refresh transparently using refresh_token |
| Strava rate limit (600 req/15min) | Friendly message + retry button |
| Zero activities | Motivational empty state |
| Network error | Error page with retry option |

---

## Environment Variables

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXTAUTH_SECRET=   # random string for cookie signing
```

---

## Out of Scope

- Database / data persistence
- Multiple sport types (focus on running)
- Social features
- Push notifications
- Mobile app
