# Axial Day MVP

Axial Day is an adaptive executive planner that translates your real daily state into a structured operating plan.

## Stack

- Next.js 16 + TypeScript + App Router
- Tailwind CSS
- Supabase (schema included)
- Route Handlers for the briefing API

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

### `GET /api/briefing`

Use predefined scenarios:

- `/api/briefing?scenario=strategic`
- `/api/briefing?scenario=focused`
- `/api/briefing?scenario=lowReserve`
- `/api/briefing?scenario=recoveryFirst`

### `POST /api/briefing`

Send a full `DailySignals` payload and get a generated briefing.

### `POST /api/briefing/generate`

Enqueue a generation event through Inngest.

```json
{
  "timezone": "Europe/Paris"
}
```

Authentication:

- `Authorization: Bearer <supabase_access_token>`
- or local fallback with `DEV_USER_ID` in `.env.local`

### `POST /api/signals/ingest/today`

Pulls data from connected integrations (WHOOP/Oura/Google Calendar), computes daily signals, and upserts into `daily_signals`.

### Integration OAuth endpoints

- `GET /api/integrations/whoop/connect`
- `GET /api/integrations/google/connect`
- `GET /api/integrations/oura/connect`

Authentication:

- `Authorization: Bearer <supabase_access_token>`
- or local fallback with `DEV_USER_ID`

Callbacks are handled at:

- `/api/integrations/[provider]/callback`

### `GET /api/integrations/status`

Returns connected providers (`whoop`, `google`, `oura`) with token expiry and `last_sync_at`.

## Key Files

- `src/lib/domain/types.ts`: domain contracts
- `src/lib/domain/scoring.ts`: readiness scoring model (v1)
- `src/lib/domain/briefing.ts`: day mode + recommendations engine
- `src/app/api/briefing/route.ts`: API endpoint
- `src/app/api/integrations/[provider]/connect/route.ts`: OAuth start
- `src/app/api/integrations/[provider]/callback/route.ts`: OAuth callback + token storage
- `src/app/api/inngest/route.ts`: Inngest serve endpoint
- `src/lib/inngest/functions.ts`: scheduled and event-based generation
- `supabase/schema.sql`: initial relational schema with RLS
- `docs/mvp-blueprint.md`: architecture and rollout plan

## Environment Variables

Copy `.env.example` to `.env.local` and fill credentials when you start wiring integrations.

## Smoke Test

1. Run app:

```bash
npm run dev
```

2. Generate demo briefing:

```bash
curl "http://localhost:3000/api/briefing?scenario=strategic"
```

3. Start OAuth flow:

```bash
curl -i "http://localhost:3000/api/integrations/google/connect" \
  -H "Authorization: Bearer <supabase_access_token>"
```

4. Sync real daily signals:

```bash
curl -X POST "http://localhost:3000/api/signals/ingest/today" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"timezone\":\"Europe/Paris\"}"
```

5. Enqueue briefing generation event:

```bash
curl -X POST "http://localhost:3000/api/briefing/generate" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"timezone\":\"Europe/Paris\"}"
```
