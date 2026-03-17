# Dashboard Enhancements — Design Spec

## Overview

Three improvements to the Strava Dashboard:

1. **Profile Ring** — SVG arc around the athlete photo showing challenge progress
2. **Badge Progress** — locked km-based badges show a progress bar with "faltan X km"
3. **Route Map** — dark world map with all activity routes drawn as orange polylines (heatmap effect via opacity overlap)

---

## A. Profile Ring

### What changes

`components/ProfileCard.tsx` is modified to display the athlete photo centered with an SVG ring arc around it that fills proportionally to `challenge.progress`. The layout shifts from horizontal (photo-left) to centered-vertical.

### Layout

```
┌─────────────────────────────────────────┐
│              [SVG RING + photo]          │
│           Firstname Lastname             │
│           Madrid, Spain                  │
│        [Running] [Atleta desde 2020]     │
│           🟠 25% → Valencia              │
└─────────────────────────────────────────┘
```

### Props change

`ProfileCard` receives a new required prop: `challenge: ChallengeState`.

`dashboard/page.tsx` passes `challenge` (already computed) to `ProfileCard`.

### SVG ring math

- Photo: 80×80 px (`w-20 h-20`)
- SVG overlay: 96×96 px, centered over photo via `position: absolute`
- Circle: `cx=48 cy=48 r=44`, `strokeWidth=5`
- Background track: stroke `#333`
- Progress arc: stroke `#FC4C02`, `stroke-dasharray=276.46`, `stroke-dashoffset = 276.46 * (1 - progress)`, `transform="rotate(-90 48 48)"` (starts at top)
- `stroke-linecap="round"` for smooth ends
- When `challenge.allCompleted`: arc is full (dashoffset = 0), gold color `#FFD700`

### Progress label

Below the name chips, one line: `XX% → Destino` in `#FC4C02`, font-bold text-sm.
If `allCompleted`: `🏆 ¡Ruta completa!`

---

## B. Badge Progress Bars

### What changes

`components/Achievements.tsx` — `Badge` component receives two new optional props:
- `progress?: number` (0–1, ratio of currentKm to threshold)
- `remainingKm?: number`

When the badge is **locked** AND `progress` is provided, it renders:
- Mini progress bar (orange fill, height 3px, rounded)
- `"faltan {remainingKm} km"` in `text-white/40 text-[10px]`

The locked opacity/grayscale is kept. The progress bar is subtle (doesn't dominate).

### Which badges get progress

Only the four km-distance badges have thresholds:

| Label | Threshold |
|---|---|
| Primeros 100 km | 100 |
| Primeros 500 km | 500 |
| Primer 1.000 km | 1000 |
| Primeros 5.000 km | 5000 |

`hasHalf`, `hasMarathon`, `bestWeek`, `bestMonth` badges get no `progress` prop — they behave exactly as today.

### Data source

`totalKm` is already computed in `Achievements` as `totals.distance / 1000`. The `badges` array is extended to include `threshold?: number`, from which `progress` and `remainingKm` are derived inline.

---

## C. Route Map

### New file

`components/RouteMap.tsx` — `'use client'` component.

### Dependencies (new)

- `react-leaflet` + `leaflet` — map rendering (OpenStreetMap compatible, no API key)
- `@types/leaflet` (devDependency) — TypeScript types for leaflet (not bundled with the package)
- `@mapbox/polyline` — decode Strava's encoded polylines

### Type change

`types/strava.ts` — `StravaSummaryActivity` gains:
```ts
map: {
  summary_polyline: string   // Google Encoded Polyline; empty string if private
} | null
```

### Data flow

`getAllActivities` in `lib/strava.ts` fetches up to 600 activities (3 pages × 200 per page, stops early if a page is not full). No API changes needed. `dashboard/page.tsx` passes `activities` to `RouteMap`.

### Rendering

- `MapContainer` with CartoDB Dark Matter tile layer (dark theme, no API key)
  - Tile URL: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
  - Attribution: `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>` (legally required)
- Container wrapper must have an explicit CSS height, e.g. `className="h-96 rounded-2xl overflow-hidden"` — Leaflet renders as 0px without it
- One `Polyline` per activity that has a non-empty `summary_polyline`
- Color: `#FC4C02`, weight: 2, opacity: 0.4 — overlapping routes naturally intensify
- `map.fitBounds` on all route coordinates on mount
- Fallback: if no activities have polylines, show a `<p>` placeholder ("No hay rutas disponibles")

### SSR

`RouteMap` is imported with `dynamic(() => import('@/components/RouteMap'), { ssr: false })` in `dashboard/page.tsx` because Leaflet requires the browser's `window` object.

### Leaflet CSS

Leaflet requires its CSS. Added as a global import in `app/globals.css`:
```css
@import 'leaflet/dist/leaflet.css';
```

### Placement

Added after `FunFact` in `dashboard/page.tsx`, section title "Tus Rutas".

---

## Files changed

| File | Change |
|---|---|
| `components/ProfileCard.tsx` | Modify — centered layout + SVG ring, new `challenge` prop |
| `components/Achievements.tsx` | Modify — Badge gets optional progress bar |
| `components/RouteMap.tsx` | Create — Leaflet map with activity polylines |
| `app/dashboard/page.tsx` | Modify — pass `challenge` to ProfileCard, dynamic import RouteMap |
| `types/strava.ts` | Modify — add `map` field to `StravaSummaryActivity` |
| `app/globals.css` | Modify — import Leaflet CSS |

---

## Out of scope

- No server-side changes to how activities are fetched (already have polylines in summary)
- No new API endpoints
- No changes to auth, middleware, or session handling
- No changes to ChallengeBar, MetricsGrid, BestMarks, FunFact
