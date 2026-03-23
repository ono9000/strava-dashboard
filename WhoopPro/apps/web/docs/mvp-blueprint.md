# Axial Day MVP Blueprint

## 1) Product Core

Axial Day is an adaptive planner with one job:

- Input: physiological state + calendar reality + user profile + objective.
- Output: one executable daily briefing with timing guidance.

The engine optimizes timing quality, not task volume.

## 2) Technical Stack (MVP)

- Frontend and BFF: Next.js 16 (App Router, Route Handlers)
- Language: TypeScript
- UI: Tailwind CSS
- Data/Auth: Supabase (Postgres + Auth + RLS)
- Async workflows: Inngest
- Integrations: WHOOP v2, Google Calendar, Oura
- Billing: Stripe Subscriptions
- Observability: Sentry + PostHog
- Hosting: Vercel

## 3) Domain Model

### Primary entities

- `profiles`
- `integrations`
- `daily_signals`
- `calendar_events`
- `daily_briefings`
- `daily_feedback`

SQL starter schema is at:

- `supabase/schema.sql`

## 4) Daily Engine Contract

### Input

`DailySignals`

- Recovery, sleep, strain, HRV trend, stress load
- Meetings, focus blocks, decision load, travel load
- Chronotype, objective, training intent

### Output

`DailyBriefing`

- `dayMode`
- `scores` for 5 dimensions:
  - Deep Work Readiness
  - Meeting Readiness
  - Execution Capacity
  - Physical Readiness
  - Recovery Protection
- `windows` for deep work, meetings, training, dip zone, shutdown
- `primaryRecommendation`, `warning`
- `suggestedMoves`, `recalibrationTriggers`, `endOfDayPrompts`

## 5) API Surface (current)

### `GET /api/briefing?scenario=strategic`

- Returns one generated briefing from built-in scenarios.
- Scenarios available now:
  - `strategic`
  - `focused`
  - `lowReserve`
  - `recoveryFirst`

### `POST /api/briefing`

- Accepts `DailySignals` JSON payload.
- Returns a generated briefing.

### `POST /api/briefing/generate`

- Sends an event to Inngest to generate and persist a briefing for a user.
- Uses authenticated user from Supabase Bearer token (or DEV_USER_ID in local mode).

### `POST /api/signals/ingest/today`

- Pulls WHOOP/Oura/Google Calendar data for the authenticated user.
- Computes and upserts `daily_signals` and `calendar_events`.

## 6) Integration Sequence

1. OAuth connect endpoints
   - `/api/integrations/whoop/connect`
   - `/api/integrations/google/connect`
   - `/api/integrations/oura/connect`
2. Callback handlers storing encrypted tokens.
3. Scheduled ingest jobs (Inngest):
   - Pull wearable metrics daily
   - Pull calendar events daily + mid-day refresh
4. Upsert into `daily_signals` and `calendar_events`.
5. Compute and persist `daily_briefings`.

Current implementation now includes:

- `/api/integrations/[provider]/connect`
- `/api/integrations/[provider]/callback`
- `/api/inngest` for Inngest function serving
- `/api/signals/ingest/today` for manual sync and debugging

## 7) Security Baseline

- RLS on all user-owned tables.
- Service role key only on server-side routes/jobs.
- Tokens encrypted at rest.
- Minimal scopes on external OAuth apps.
- Audit integration sync errors.

## 8) Rollout Plan

### Phase 1 (current)

- Engine v1 with deterministic scoring
- Briefing API
- Executive daily dashboard

### Phase 2

- Real OAuth integrations
- Scheduled ingestion + persisted briefings
- End-of-day feedback capture

### Phase 3

- Personalization loop from feedback
- Recommendations confidence scoring
- Subscription paywall and onboarding funnel

## 9) Immediate Build Backlog

1. Supabase project + run `supabase/schema.sql`
2. Implement integration OAuth routes
3. Add Inngest functions for ingestion and briefing generation
4. Persist API outputs to `daily_briefings`
5. Add authentication and user-scoped dashboard view
