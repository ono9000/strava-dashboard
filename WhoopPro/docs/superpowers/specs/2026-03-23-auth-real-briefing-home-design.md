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

## Auth Stack

**Package:** `@supabase/ssr` — the official Supabase package for Next.js App Router. Manages sessions via cookies.

**New Supabase clients:**

| File | Purpose |
|---|---|
| `lib/supabase/server.ts` | Server component client — reads cookies via `next/headers` |
| `lib/supabase/middleware.ts` | Middleware client — reads/writes cookies from `NextRequest`/`NextResponse` |

Existing `lib/supabase/public.ts` and `lib/supabase/admin.ts` are untouched. API routes continue using `resolveUserIdFromRequest` with Bearer tokens.

---

## Middleware

File: `middleware.ts` (root of `src/`)

**Rules:**
- `/(app)/*` routes: no session → redirect to `/login`
- `/login` and `/signup`: active session → redirect to `/dashboard`
- All other routes: pass through
- On every matched request: refresh the session token (Supabase SSR handles this with `updateSession`)

**Matcher config:** applies to `/(app)/(.*)`, `/login`, `/signup`

---

## Auth Pages

### Login (`/login`)
- Email + password form
- Google OAuth button (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- On success: redirect to `/dashboard`
- On error: inline message under the form (no page reload)
- Link to `/signup`

### Signup (`/signup`)
- Email + password form
- Google OAuth button (same flow)
- On success: redirect to `/dashboard`
- On error: inline message (email taken, weak password, etc.)
- Link to `/login`

### Google OAuth callback (`/auth/callback`)
- Route handler: exchanges Supabase `code` param for a session
- On success: redirect to `/dashboard`
- On failure: redirect to `/login?error=auth_failed`

**Note:** Supabase's Google OAuth (for login) is distinct from the Google Calendar OAuth (for data ingestion). They use different Google Cloud clients and different scopes. No conflict.

---

## Dashboard Data Flow

`/dashboard/page.tsx` is a **server component**.

1. Reads `user.id` from the server-side Supabase session
2. Queries `daily_briefings WHERE user_id = $1 AND signal_date = today`
3. Branch on result:
   - **Briefing exists for today** → render `BriefingView`
   - **Briefing exists but is stale** (signal_date < today) → render `BriefingView` with a stale notice + refresh button
   - **No briefing** → render `EmptyBriefingState`
   - **Supabase error** → render error boundary message

The `GenerateBriefingButton` (client component) calls `POST /api/briefing/generate`, shows a loading state, and calls `router.refresh()` on success to re-trigger the server component fetch.

---

## Components

All components use existing CSS design tokens (`--accent`, `--foreground`, `--surface-strong`, `--line`, `--warning`, `--ok`) and the `panel`/`rise-in` classes from `globals.css`. No new CSS framework introduced.

| Component | Type | Description |
|---|---|---|
| `BriefingView` | Server | Extracted from current `page.tsx`. Receives `DailyBriefing` and renders all panels: scores, windows, suggested moves, adaptive loop. |
| `EmptyBriefingState` | Server | Card shown when no briefing exists. Contains `GenerateBriefingButton`. |
| `GenerateBriefingButton` | Client | Calls `POST /api/briefing/generate`. Handles loading/error states. Calls `router.refresh()` on success. |
| `NavBar` | Server | Logo + user email + logout button. Logout calls `supabase.auth.signOut()` via a server action, then redirects to `/`. |
| `AuthForm` | Client | Shared card wrapper for login/signup (logo, heading, Google button, divider, email/password fields, submit, error message, link to other page). |

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
| Google OAuth failure | Redirect to `/login?error=oauth_failed`, banner at top of form |
| No briefing for today | `EmptyBriefingState` card + generate button |
| Briefing from a previous day | `BriefingView` rendered with amber notice: "This briefing is from [date]." + refresh button |
| Generate in progress | Button disabled, spinner, "Generating your briefing…" |
| Generate failed | Error message inline, retry button |
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
- [ ] User can sign up with email + password
- [ ] User can log in with email + password
- [ ] User can log in with Google
- [ ] Logged-in user on `/dashboard` sees their real briefing from `daily_briefings`
- [ ] If no briefing exists, user sees empty state with a working "Generate" button
- [ ] Generate button produces a briefing and the page updates without a full reload
- [ ] Logout redirects to `/`
- [ ] Session persists across page refreshes
