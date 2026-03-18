# Strava Dashboard

A personal running dashboard built with Next.js 14, powered by the Strava API. Visualizes your training history with rich charts, maps, and stats — all in a clean dark-theme interface.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)

---

## Features

- **OAuth login** via Strava — no passwords, no manual data entry
- **Profile card** with yearly km challenge progress arc
- **Activity heatmap** — GitHub-style 52-week grid of your runs
- **Monthly km chart** — current year vs previous year bar comparison
- **Best marks** — personal records for 5K, 10K, half marathon, marathon
- **Top performances** — longest run, best pace, most elevation
- **Achievements** — auto-unlocked badges based on lifetime stats
- **Fun facts** — distance expressed in creative real-world equivalents
- **Other activities** — breakdown of non-running sports (cycling, tennis, etc.)
- **Running partners** — top 3 people you run with most
- **Route map** — interactive world map with all your routes and visited countries highlighted
- **EN / ES language toggle** — persisted across sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Map | react-leaflet + world-atlas + topojson-client |
| Charts | SVG (no chart library) |
| Auth | Strava OAuth 2.0 + signed cookie session |
| Tests | Jest + Testing Library |

---

## Getting Started

### 1. Create a Strava API application

Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an app.

Set the **Authorization Callback Domain** to `localhost` for local development.

### 2. Clone and install

```bash
git clone https://github.com/ono9000/strava-dashboard.git
cd strava-dashboard
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
COOKIE_SECRET=any_random_32_char_string
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with Strava.

---

## Deployment

The app is designed for deployment on [Vercel](https://vercel.com).

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add the same environment variables in **Project Settings → Environment Variables**
4. Update `STRAVA_REDIRECT_URI` to your production URL (e.g. `https://your-app.vercel.app/api/auth/callback`)
5. Update the callback domain in your Strava API app settings

---

## Project Structure

```
app/
  page.tsx              # Landing / login page
  dashboard/page.tsx    # Main dashboard (server component)
  api/auth/             # OAuth flow (strava, callback, logout)
components/
  ProfileCard.tsx       # Athlete header with yearly challenge arc
  MetricsGrid.tsx       # Lifetime totals grid
  ActivityHeatmap.tsx   # 52-week SVG heatmap
  MonthlyChart.tsx      # Monthly km SVG bar chart
  BestMarks.tsx         # Personal records
  TopPerformances.tsx   # Highlight cards (longest, pace, elevation)
  Achievements.tsx      # Auto-unlocked badge system
  FunFact.tsx           # Fun distance equivalents
  SportBreakdown.tsx    # Non-running activity chips
  RunningPartners.tsx   # Top running companions
  RouteMap.tsx          # Interactive Leaflet map with country fill
  LanguageToggle.tsx    # EN/ES toggle (cookie-persisted)
lib/
  strava.ts             # Strava API client
  calculations.ts       # Pure data transformation functions
  i18n/                 # Translation dictionaries (EN/ES)
types/
  strava.ts             # Strava API type definitions
```

---

## Running Tests

```bash
npm test
```

43 unit tests covering all calculation functions and the RouteMap component.

---

## License

MIT
