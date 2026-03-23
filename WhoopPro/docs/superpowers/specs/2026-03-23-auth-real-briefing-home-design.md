# Auth + Real Briefing Home — Design Spec

**Date:** 2026-03-23
**Sub-project:** 1 of 4
**Status:** Approved

---

## Overview

This spec covers the first shippable slice of Axial Day: authenticated access to a real daily briefing. After this sub-project, a user can sign up, log in (email/password or Google), and see their actual briefing pulled from Supabase — not a demo scenario.

---

## Route Structure

```
apps/web/src/app/
├── (public)/
│   ├── layout.tsx                # Minimal layout, no nav
│   ├── page.tsx                  # Landing page (hero + CTA)
│   ├── login/page.tsx            # Login form
│   └── signup/page.tsx           # Signup form
├── (app)/
│   ├── layout.tsx                # App shell: NavBar + session enforcement
│   └── dashboard/page.tsx        # Real briefing for logged-in user
├── auth/
│   └── callback/route.ts         # Supabase OAuth code exchange
├── api/...                       # Existing API routes — untouched
├── privacy/page.tsx              # Already exists
├── globals.css
└── layout.tsx                    # Root layout (fonts, metadata)
```

The current `page.tsx` demo (scenario-based briefing) is replaced by the landing page. The demo scenario logic is preserved in `lib/domain/scenarios.ts` but is no longer the entry point.

---

## Environment Variables

Two env var categories are required after this sub-project. Existing vars are untouched.

**New server-only vars** (already present in most deployments, just confirming):
- `SUPABASE_URL` — already used by existing clients

**New `NEXT_PUBLIC_` vars** (required for the browser Supabase client):
- `NEXT_PUBLIC_SUPABASE_URL` — same value as `SUPABASE_URL`, but exposed to the browser bundle
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same value as `SUPABASE_ANON_KEY`, but exposed to the browser bundle
- `NEXT_PUBLIC_SITE_URL` — the app's public base URL (e.g. `https://axialday.com` or `http://localhost:3200`). Used to build absolute OAuth redirect URLs.

These must be added to `.env.local` and to all deployment environment configs.

---

## Auth Stack

**Package:** `@supabase/ssr` — the official Supabase package for Next.js App Router. Manages sessions via cookies.

**New Supabase clients:**

| File | Purpose |
|---|---|
| `lib/supabase/server.ts` | Server component + Route Handler client — reads/writes cookies via `next/headers` (`createServerClient`) |
| `lib/supabase/middleware.ts` | Middleware client — reads/writes cookies from `NextRequest`/`NextResponse` (`createServerClient`) |
| `lib/supabase/browser.ts` | Browser client for client components (`createBrowserClient`). Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Singleton pattern to avoid multiple instances. |

Existing `lib/supabase/public.ts` and `lib/supabase/admin.ts` are untouched. API routes continue using `resolveUserIdFromRequest` with Bearer tokens.

**`DEV_USER_ID` runtime guard:** `resolveUserIdFromRequest` in `lib/auth/request-user.ts` must be updated to add a runtime guard: if `DEV_USER_ID` is set and `process.env.NODE_ENV !== 'development'`, throw an error at call time with the message `"DEV_USER_ID must not be set outside local development"`. This ensures a misconfigured staging/production environment fails loudly rather than silently accepting unauthenticated requests.

---

## Middleware

File: `middleware.ts` (at `apps/web/src/middleware.ts`)

**Rules:**
- `/dashboard` and any future `(app)` routes: no session → redirect to `/login`
- `/login` and `/signup`: active session → redirect to `/dashboard`
- `/auth/callback`: **excluded from matcher** — must not run `updateSession` before the session is established, to avoid a race condition with the code exchange
- All other routes: pass through (including `/api/*`, `/privacy`, `/`)
- On every matched request: call `updateSession` (from `@supabase/ssr` via `lib/supabase/middleware.ts`) to refresh the session token

**Matcher config:**
```ts
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
```

As new `(app)` route segments are added in future sub-projects (e.g., `/onboarding`, `/settings`), their paths must be added to this matcher.

---

## Auth Pages

### Login (`/login`)
- Email + password form
- Google OAuth button:
  ```ts
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
  })
  ```
- On success: redirect to `/dashboard`
- On error: inline message under the form (no page reload)
- Link to `/signup`
- If `?error=auth_failed` is in the URL: show an amber banner at the top of the form ("Authentication failed. Please try again.")

### Signup (`/signup`)
- Email + password form
- Google OAuth button (same `redirectTo` pattern as login)
- On success: redirect to `/dashboard`
- On error: inline message (email taken, weak password, etc.)
- Link to `/login`
- If `?error=auth_failed` is in the URL: show amber banner

### Google OAuth callback (`/auth/callback`)
- Route handler at `app/auth/callback/route.ts`
- Uses the **server Supabase client** (`lib/supabase/server.ts`) — not the middleware client. Route Handlers use `next/headers` cookies, same as server components.
- Exchanges the Supabase `code` query param for a session via `supabase.auth.exchangeCodeForSession(code)`
- On success: redirect to `/dashboard`
- On failure: redirect to `/login?error=auth_failed`

**Note:** The `?error=auth_failed` param is the single, consistent error identifier used for all OAuth failures. Do not use `oauth_failed` or any other variant.

**Note on Google OAuth:** Supabase's Google OAuth (for login) is a distinct OAuth app and flow from the Google Calendar OAuth (for data ingestion in sub-project 2). Different Google Cloud clients, different scopes. No conflict.

---

## Dashboard Data Flow

`/dashboard/page.tsx` is a **server component**.

1. Reads `user.id` from the server-side Supabase session (via `lib/supabase/server.ts`)
2. Reads the user's `timezone` from `profiles WHERE user_id = $1` (falls back to `'UTC'` if null)
3. Computes `today` using `getTodayDateInTimeZone(timezone)` from `lib/time/timezone.ts`
4. Queries `daily_briefings WHERE user_id = $1 ORDER BY signal_date DESC LIMIT 1`
   - `signal_date` is a Postgres `DATE` column, stored as `YYYY-MM-DD`
5. Branch on result:
   - **Row exists and `signal_date === today`** → render `BriefingView`
   - **Row exists and `signal_date < today`** (stale) → render `BriefingView` with an amber stale notice: "This briefing is from [date]." + refresh button (the refresh button re-triggers generate)
   - **No row** → render `EmptyBriefingState`
   - **Supabase error** → render inline error card

The `timezone` value from step 2 is passed as a prop to `EmptyBriefingState` → `GenerateBriefingButton` so the generate call can include it.

---

## GenerateBriefingButton Auth & Async UX

`GenerateBriefingButton` is a client component that calls `POST /api/briefing/generate`.

**Auth:** On click, it calls `supabase.auth.getSession()` (using the browser Supabase client from `lib/supabase/browser.ts`) to obtain the current `access_token`, then attaches `Authorization: Bearer <access_token>` to the fetch request.

**Request body:** `{ timezone }` — passes the user's timezone (received as a prop from the server component) so the Inngest job uses the correct local date.

**Async UX:** The API route fires an Inngest event and immediately returns `{ ok: true, queued: true }`. Briefing generation is asynchronous — it is not complete when the response arrives. Therefore:
- On API success (200 `queued: true`): show a confirmation message "Your briefing is being generated. Refresh in a moment." with a manual "Refresh" button that calls `router.refresh()`
- Do NOT call `router.refresh()` automatically — it would re-render before the job completes, showing the same empty state
- On API failure: show inline error with retry button

---

## Components

All components use existing CSS design tokens (`--accent`, `--foreground`, `--surface-strong`, `--line`, `--warning`, `--ok`) and the `panel`/`rise-in` classes from `globals.css`. No new CSS framework introduced.

| Component | Type | Description |
|---|---|---|
| `BriefingView` | Server | Extracted from current `page.tsx`. Receives `DailyBriefing` and renders all panels: scores, windows, suggested moves, adaptive loop. |
| `EmptyBriefingState` | Server | Card shown when no briefing exists. Contains `GenerateBriefingButton`. Passes `timezone` prop to it. |
| `GenerateBriefingButton` | Client | Gets session token from browser Supabase client. Calls `POST /api/briefing/generate` with Bearer token and `{ timezone }` body. Shows queued confirmation + manual refresh button on success. |
| `NavBar` | Server | Logo + user email. Contains `LogoutButton` as a child. |
| `LogoutButton` | Client | `'use client'` component. On click calls a Server Action that runs `supabase.auth.signOut()` on the server client, then redirects to `/`. |
| `AuthForm` | Client | Shared card wrapper for login/signup: logo, heading, Google button (absolute `redirectTo`), divider, email/password fields, submit, inline error message, optional amber banner for `?error=auth_failed`, link to other page. |

---

## Landing Page

`(public)/page.tsx` — server component, no auth required.

Content:
- Product name: **Axial Day**
- One-liner: "Your calendar knows what exists. This engine decides when it makes sense."
- Short value prop (2–3 lines)
- "Get started" button → `/signup`
- "Sign in" link → `/login`

Uses the same design tokens and font variables. No heavy marketing content — this is a beta entry point.

---

## Error & Empty States

| Scenario | UI |
|---|---|
| Wrong password / user not found | Inline error under form, no reload |
| Email already taken on signup | Inline error under form |
| Google OAuth failure | Redirect to `/login?error=auth_failed`, amber banner at top of form |
| No briefing for today | `EmptyBriefingState` card + generate button |
| Briefing from a previous day | `BriefingView` with amber notice: "This briefing is from [date]." + refresh button |
| Generate API call in progress | Button disabled, spinner, "Generating…" |
| Generate queued successfully | Confirmation: "Your briefing is being generated. Refresh in a moment." + manual Refresh button |
| Generate API failed | Inline error, retry button |
| Supabase fetch error on dashboard | Inline error card: "Something went wrong. Try refreshing." |

---

## What This Spec Does NOT Cover

- Onboarding flow (profile setup: timezone, chronotype, objective) — Sub-project 2
- Integrations connect UI (WHOOP / Google Calendar OAuth buttons) — Sub-project 2
- Recalibration endpoint and UI — Sub-project 3
- Observability / job health panel — Sub-project 4
- Password reset / email verification flows — post-beta

---

## Acceptance Criteria

- [ ] Unauthenticated user visiting `/dashboard` is redirected to `/login`
- [ ] `/auth/callback` is excluded from the middleware matcher and from `updateSession`
- [ ] User can sign up with email + password
- [ ] User can log in with email + password
- [ ] User can log in with Google (OAuth `redirectTo` uses an absolute URL from `NEXT_PUBLIC_SITE_URL`)
- [ ] After Google login, `/auth/callback` exchanges the code using the server Supabase client and redirects to `/dashboard`
- [ ] Google OAuth failure redirects to `/login?error=auth_failed` and shows an amber banner
- [ ] Logged-in user on `/dashboard` sees their real briefing from `daily_briefings`
- [ ] Dashboard query uses `ORDER BY signal_date DESC LIMIT 1` to fetch the most recent briefing
- [ ] Dashboard uses the user's timezone from `profiles` (via `getTodayDateInTimeZone`) to compute today's date
- [ ] If no briefing exists, user sees empty state with a working "Generate" button
- [ ] If the most recent briefing's `signal_date` is before today, user sees a stale notice with a refresh button
- [ ] Generate button calls the API with a Bearer token (from `supabase.auth.getSession()`) and passes `{ timezone }` in the request body
- [ ] After a successful generate (queued), user sees a confirmation message and a manual Refresh button — no automatic re-render
- [ ] `DEV_USER_ID` present outside `NODE_ENV=development` causes a runtime error in `resolveUserIdFromRequest`
- [ ] Logout redirects to `/`
- [ ] Session persists across page refreshes
