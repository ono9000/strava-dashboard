# Onboarding + Integrations + First Real Generation — Design Spec

**Date:** 2026-03-23
**Sub-project:** 2 of 4
**Status:** Approved

---

## Overview

This spec covers the second shippable slice of Axial Day: a new user who signs up goes through a forced onboarding wizard (timezone, chronotype, objective), can optionally connect WHOOP and Google Calendar in the final onboarding step, and then sees a real briefing generated from their actual data. Returning users can manage integrations from a `/settings/integrations` page accessible from the NavBar.

The backend pipeline (OAuth flow, token storage, sync, Inngest) is already built. This sub-project is primarily a UI layer and two small backend fixes.

---

## What Already Exists (Do Not Touch)

| File | What it does |
|---|---|
| `src/lib/integrations/oauth.ts` | `buildAuthorizationUrl`, `exchangeAuthorizationCode`, `refreshAccessToken` for WHOOP / Google / Oura |
| `src/lib/integrations/repository.ts` | `saveIntegrationToken`, `getIntegrationCredentials`, `listIntegrationStatus`, etc. |
| `src/lib/integrations/state.ts` | OAuth CSRF state: `createOAuthStatePayload`, `encodeStatePayload`, `decodeStatePayload` |
| `src/lib/ingestion/sync-today.ts` | `syncTodaySignalsForUser` — fetches WHOOP + Google Calendar, builds `DailySignals`, upserts |
| `src/lib/inngest/functions.ts` | `generateBriefingForUser` — syncs signals → computes briefing → persists |
| `src/app/api/integrations/[provider]/connect/route.ts` | Starts OAuth: creates state, sets cookie, redirects to provider |
| `src/app/api/integrations/[provider]/callback/route.ts` | Exchanges code, saves token — **fix: redirect instead of JSON** |
| `src/app/api/integrations/status/route.ts` | Lists connected integrations for a user |
| `src/app/api/briefing/generate/route.ts` | Fires Inngest `briefing/generate.user` event |

---

## Database Schema (Already In Supabase)

```sql
-- Enums
create type public.objective_type as enum ('performance', 'balance', 'recovery', 'consistency');
create type public.chronotype_type as enum ('morning', 'balanced', 'evening');
create type public.integration_provider as enum ('whoop', 'google_calendar', 'oura');

-- Tables
create table public.profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone  text not null default 'Europe/Paris',
  objective objective_type not null default 'performance',
  chronotype chronotype_type not null default 'balanced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integrations (
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider         integration_provider not null,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at       timestamptz,
  scopes           text[],
  last_sync_at     timestamptz,
  primary key (user_id, provider)
);
```

**Profile existence = onboarding complete.** If no row exists in `profiles` for the current user, they have not onboarded. After completing the wizard, a row is upserted and they never see onboarding again.

---

## Route Structure

```
apps/web/src/app/
├── (app)/
│   ├── layout.tsx              # MODIFIED: add profile-existence check → redirect /onboarding
│   ├── dashboard/page.tsx      # Unchanged
│   └── settings/
│       └── integrations/
│           └── page.tsx        # NEW: manage connected integrations
├── (public)/
│   └── ...                     # Unchanged
├── onboarding/
│   └── page.tsx                # NEW: forced wizard (outside (app) group — no NavBar)
```

`/onboarding` is outside the `(app)` route group so it has no NavBar. It has its own minimal layout via `src/app/onboarding/layout.tsx`.

---

## Middleware Updates

Add `/onboarding` and `/settings/:path*` to the matcher:

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/onboarding', '/settings/:path*'],
}
```

Redirect rules (added to `middleware.ts`):
- `/onboarding`: no session → redirect to `/login`
- `/settings/:path*`: no session → redirect to `/login`
- All other rules unchanged (authenticated users on `/login`/`/signup` → `/dashboard`)

The profile-existence check (for forcing onboarding) is **not** done in middleware — it is done in `(app)/layout.tsx` via a Supabase query. Middleware only enforces session presence.

---

## Profile Existence Check (App Layout)

`src/app/(app)/layout.tsx` gains a second check after `getUser()`:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('user_id')
  .eq('user_id', user.id)
  .maybeSingle()

if (!profile) redirect('/onboarding')
```

This means every authenticated route (`/dashboard`, `/settings/integrations`) silently redirects new users to onboarding until they complete it. Once the wizard upserts the profile row, they never hit this branch again.

Conversely: if a user with a complete profile visits `/onboarding`, the page itself redirects to `/dashboard` (checked in the onboarding page server component).

---

## Onboarding Flow

### Page: `src/app/onboarding/page.tsx` (server component)

Reads user from session. If no session → middleware already redirected. If profile already exists → `redirect('/dashboard')`. Otherwise renders `<OnboardingWizard />`.

### Component: `src/components/onboarding/OnboardingWizard.tsx` (client)

Single client component managing steps 1–4 with `useState`. Steps 1–3 are local state (no network call until step 3 is submitted).

**Step 1 — Timezone**
- Detects timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` as initial value
- Searchable dropdown of IANA timezone strings (list embedded, not fetched)
- "Next" button advances to step 2

**Step 2 — Chronotype**
- Three card options: Morning (Early Bird) / Balanced / Evening (Night Owl)
- Maps to DB values: `'morning'` / `'balanced'` / `'evening'`
- Selecting a card advances immediately to step 3 (no separate Next button)

**Step 3 — Objective**
- Four card options: Performance / Balance / Recovery / Consistency
- Selecting a card calls `saveProfileAction({ timezone, chronotype, objective })` via Server Action
- While saving: spinner on the selected card, disabled state
- On success: advances to step 4
- On error: inline error message, allow retry

**Step 4 — Connect Integrations (optional)**
- Shown after profile is saved in step 3
- Two connect buttons: "Connect WHOOP" and "Connect Google Calendar"
- Each button is a plain `<a>` link to `/api/integrations/whoop/connect?returnTo=onboarding` (no fetch needed — server redirects to OAuth)
- If `?connected=whoop` or `?connected=google` is in the URL (set by callback): show success badge on the relevant card
- "Go to dashboard" link at the bottom — always visible

### Server Action: `src/lib/profile/actions.ts`

```ts
'use server'

export async function saveProfileAction(data: {
  timezone: string
  chronotype: 'morning' | 'balanced' | 'evening'
  objective: 'performance' | 'balance' | 'recovery' | 'consistency'
}): Promise<{ ok: true } | { error: string }>
```

Uses server Supabase client (`createClient()`). Upserts into `profiles` with `onConflict: 'user_id'`. Returns `{ ok: true }` or `{ error: string }`.

---

## Integration Connect Flow

### Fix 1: `/api/integrations/[provider]/connect/route.ts`

Currently uses `resolveUserIdFromRequest` (Bearer-only). Add cookie auth fallback:

```ts
// Try cookie auth first (browser/UI flow), then Bearer (API flow)
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const userId = user?.id ?? await resolveUserIdFromRequest(request)
```

Also read and embed `returnTo` query param (`'onboarding'` or `'settings'`) into the OAuth state payload via `OAuthStatePayload`:

```ts
// state.ts — extend OAuthStatePayload
returnTo?: 'onboarding' | 'settings'
```

### Fix 2: `/api/integrations/[provider]/callback/route.ts`

After `saveIntegrationToken`, redirect instead of returning JSON:

```ts
const returnTo = stateCookie.returnTo ?? 'settings'
const destination = returnTo === 'onboarding'
  ? `/onboarding?connected=${providerValue}`
  : `/settings/integrations?connected=${providerValue}`

const response = NextResponse.redirect(new URL(destination, request.url))
// clear the state cookie on the response
response.cookies.set(OAUTH_STATE_COOKIE, '', { maxAge: 0, ... })
return response
```

On OAuth error (provider returns `?error=`): redirect to `/onboarding?error=connect_failed` or `/settings/integrations?error=connect_failed` based on `returnTo`.

---

## Settings/Integrations Page

`src/app/(app)/settings/integrations/page.tsx` — server component.

1. Reads user from session (already available from layout)
2. Calls `listIntegrationStatus(user.id)` to get connected providers
3. Renders `IntegrationsManager` client component with the status list as props
4. If `?connected=[provider]` in URL: shows a dismissible success banner

### Component: `src/components/settings/IntegrationsManager.tsx` (client)

Shows cards for WHOOP and Google Calendar:
- **Connected**: provider name, "Last synced: [date]", "Reconnect" link
- **Not connected**: "Connect [Provider]" button (links to `/api/integrations/[provider]/connect?returnTo=settings`)
- Oura shown as "Coming soon" (greyed out)

---

## NavBar Update

`src/components/NavBar.tsx` adds a Settings link:

```tsx
<Link href="/settings/integrations" className="...">Settings</Link>
```

---

## Error and Empty States

| Scenario | UI |
|---|---|
| Save profile fails | Inline error under the card in step 3, allow retry |
| OAuth provider error on connect | Redirect to source page with `?error=connect_failed`, amber banner |
| Integration connects but sync has no data yet | Dashboard shows EmptyBriefingState as normal — user generates manually |
| User visits `/onboarding` with complete profile | Server redirect to `/dashboard` |
| User visits `/settings/integrations` without session | Middleware redirect to `/login` |

---

## What This Spec Does NOT Cover

- Oura integration UI (backend exists, UI is "coming soon")
- Disconnect / revoke integration
- Profile editing post-onboarding (timezone, chronotype, objective changes)
- Password reset / email verification
- Stripe billing

---

## Acceptance Criteria

- [ ] New user who signs up is redirected to `/onboarding` before seeing the dashboard
- [ ] User with existing profile who visits `/onboarding` is redirected to `/dashboard`
- [ ] Onboarding wizard detects timezone from browser on step 1
- [ ] Selecting a chronotype card on step 2 advances immediately to step 3
- [ ] Selecting an objective card on step 3 calls `saveProfileAction` and advances to step 4
- [ ] Save profile error shows inline message and allows retry
- [ ] Step 4 shows "Connect WHOOP" and "Connect Google Calendar" links
- [ ] "Go to dashboard" link on step 4 navigates to `/dashboard`
- [ ] Clicking "Connect WHOOP" from step 4 redirects through OAuth and returns to `/onboarding?connected=whoop`
- [ ] After returning from OAuth to step 4, a success badge appears on the connected provider card
- [ ] Clicking "Connect Google Calendar" from settings redirects through OAuth and returns to `/settings/integrations?connected=google`
- [ ] `/settings/integrations` shows connected/not-connected state for WHOOP and Google Calendar
- [ ] `?connected=[provider]` in URL shows success banner on settings page
- [ ] OAuth error redirects to source page with `?error=connect_failed` and amber banner
- [ ] NavBar shows Settings link for authenticated users
- [ ] `POST /api/briefing/generate` with valid Bearer token triggers sync + generation pipeline (unchanged, already works)
- [ ] After connecting WHOOP and/or Google Calendar, clicking "Generate today's briefing" produces a briefing with real data (WHOOP recovery score, calendar events) rather than defaults
