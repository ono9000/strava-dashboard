# Onboarding + Integrations + First Real Generation — Design Spec

**Date:** 2026-03-23
**Sub-project:** 2 of 4
**Status:** Draft

> **Path convention:** All file paths in this spec are relative to `apps/web/src/` unless otherwise noted.

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
│   ├── layout.tsx              # NEW: minimal wrapper (no NavBar)
│   └── page.tsx                # NEW: forced wizard (outside (app) group)
```

`/onboarding` is outside the `(app)` route group so it has no NavBar. It has its own minimal layout via `src/app/onboarding/layout.tsx`, which is a simple wrapper that renders `{children}` with no navigation or shell chrome — just the page content centered on screen.

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

**Middleware body change:** The existing `isAppRoute` conditional currently checks `path.startsWith('/dashboard')`. Extend it to also cover `/settings`:

```ts
const isAppRoute = path.startsWith('/dashboard') || path.startsWith('/settings')
```

Add a separate check for `/onboarding`:
```ts
const isOnboarding = path === '/onboarding'
if ((isAppRoute || isOnboarding) && !session) return NextResponse.redirect(new URL('/login', request.url))
```

**Cookie propagation on redirect:** When constructing redirect responses in middleware, copy Supabase session cookies from `supabaseResponse` to the redirect response (same pattern as the existing `/dashboard` redirect in middleware).

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

**No redirect loop:** `/onboarding` is outside the `(app)/` route group, so `(app)/layout.tsx` never runs for it. The profile check cannot trigger while the user is already on `/onboarding`.

---

## Onboarding Flow

### Page: `src/app/onboarding/page.tsx` (server component)

Calls `createClient()` from `@/lib/supabase/server` and `getUser()`. If `getUser()` returns no user (session missing or expired) → `redirect('/login')`. Middleware should have already caught this, but the page defends itself regardless.

If profile already exists **and** `?connected=` is NOT in the URL → `redirect('/dashboard')`.

If profile already exists **and** `?connected=` IS in the URL → the user is returning from OAuth on step 4. Render `<OnboardingWizard />` (the wizard will start at step 4 based on the query param; see below).

If no profile → render `<OnboardingWizard />`.

### Component: `src/components/onboarding/OnboardingWizard.tsx` (client)

Single client component managing steps 1–4 with `useState`. Steps 1–3 are local state (no network call until step 3 is submitted).

**Initial step:** On mount, the component reads `?connected=` from `useSearchParams()`. If present, it starts at step 4 (the user is returning from OAuth). Otherwise it starts at step 1.

**Step 1 — Timezone**
- Detects timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` as initial value
- Searchable dropdown of IANA timezone strings (list embedded, not fetched)
- "Next" button advances to step 2

**Step 2 — Chronotype**
- Three card options: Morning (Early Bird) / Balanced / Evening (Night Owl)
- Maps to DB values: `'morning'` / `'balanced'` / `'evening'`
- Selecting a card advances immediately to step 3 (no separate Next button)
- No back navigation on steps 2, 3, or 4 — the wizard is intentionally linear for simplicity

**Step 3 — Objective**
- Four card options: Performance / Balance / Recovery / Consistency
- Selecting a card calls `saveProfileAction({ timezone, chronotype, objective })` via Server Action
- While saving: spinner on the selected card, disabled state
- On success: advances to step 4
- On error: inline error message, allow retry

**Step 4 — Connect Integrations (optional)**
- Shown after profile is saved in step 3, or when returning from OAuth (wizard starts at step 4 via `useSearchParams`)
- Two connect buttons: "Connect WHOOP" and "Connect Google Calendar"
- Each button is a plain `<a>` link to `/api/integrations/[provider]/connect?returnTo=onboarding` (e.g. `/api/integrations/whoop/connect?returnTo=onboarding`)
- If `?connected=whoop` or `?connected=google` is in the URL (set by callback): show success badge on the relevant card
- **Multiple connects:** each OAuth flow replaces the previous `?connected=` value; the badge only shows for the most-recently-connected provider. This is acceptable for beta.
- If `?error=connect_failed` is in the URL: show an amber banner ("Could not connect integration. Please try again.")
- "Go to dashboard" link at the bottom — always visible

### Server Action: `src/lib/profile/actions.ts` (NEW directory)

```ts
'use server'

export async function saveProfileAction(data: {
  timezone: string
  chronotype: 'morning' | 'balanced' | 'evening'
  objective: 'performance' | 'balance' | 'recovery' | 'consistency'
}): Promise<{ ok: true } | { error: string }>
```

Uses server Supabase client (`createClient()`). Upserts into `profiles` with `onConflict: 'user_id'`. Returns `{ ok: true }` or `{ error: string }`.

No server-side timezone validation is required — the client presents an IANA dropdown and the DB accepts any text value. Trust the client value.

`full_name` is intentionally NOT collected during onboarding (it defaults to `NULL` in the DB). This is by design for the current scope.

---

## Integration Connect Flow

### Fix 1: `/api/integrations/[provider]/connect/route.ts`

Currently uses `resolveUserIdFromRequest` (Bearer-only). Add cookie auth fallback:

```ts
// Try cookie auth first (browser/UI flow), then Bearer (API flow)
// Import createClient from '@/lib/supabase/server' (cookie-based server client)
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const userId = user?.id ?? await resolveUserIdFromRequest(request)
if (!userId) return new Response('Unauthorized', { status: 401 })
```

Also read and embed `returnTo` query param (`'onboarding'` or `'settings'`) into the OAuth state payload via `OAuthStatePayload`:

```ts
// state.ts — extend OAuthStatePayload
returnTo?: 'onboarding' | 'settings'
```

**Required changes to `state.ts`:**
1. Add `returnTo?: 'onboarding' | 'settings'` to the `OAuthStatePayload` interface.
2. Update `createOAuthStatePayload` signature to accept `returnTo` as an optional third positional argument: `createOAuthStatePayload(provider, userId, returnTo?: 'onboarding' | 'settings')`. Include it in the payload object only when defined.
3. Update `decodeStatePayload`'s validation block: the existing four **required** field checks (`state`, `provider`, `userId`, `issuedAt`) are unchanged. After those pass, also read the optional `returnTo` field from the parsed payload: include it in the returned object only if its value is `'onboarding'` or `'settings'` (whitelist); otherwise omit it. The function's return type `OAuthStatePayload | null` is unchanged, but `OAuthStatePayload` now includes `returnTo?`.
4. The connect route passes `returnTo` when calling `createOAuthStatePayload`: read `new URL(request.url).searchParams.get('returnTo')` and validate it is `'onboarding'` or `'settings'` before passing; discard any other value.

**Provider naming convention:** `?connected=` query param values always use the URL path segment names (`whoop`, `google`), not DB enum names (`whoop`, `google_calendar`). UI components map these to display labels: `'whoop'` → "WHOOP", `'google'` → "Google Calendar".

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

**`returnTo` source:** The callback reads `returnTo` from `stateCookie.returnTo` (embedded in the OAuth state during the connect step), NOT from any query parameter on the callback URL.

**`providerValue`** is the URL `[provider]` path segment (e.g. `'whoop'`, `'google'`), not the DB enum value (`'google_calendar'`). The `?connected=` query param uses this same segment value.

**State cookie missing:** If the state cookie cannot be decoded (missing or invalid), fall back to `returnTo = 'settings'` and redirect to `/settings/integrations?error=connect_failed`.

**Token-save failure:** If `saveIntegrationToken` throws, catch the error and redirect to the source page with `?error=connect_failed` (same `returnTo` logic as above). Do not return a JSON 500.

**On OAuth error** (provider returns `?error=`): the state cookie is still present (it was set during the connect step, before the browser left for the provider). Decode `returnTo` from the state cookie and redirect to `/onboarding?error=connect_failed` or `/settings/integrations?error=connect_failed`. If the state cookie is also missing/invalid at this point, fall back to `/settings/integrations?error=connect_failed`.

**All non-success paths in callback must redirect, not return JSON:**
- Provider returns `?error=`: redirect as above
- State cookie missing / CSRF mismatch: redirect to `/settings/integrations?error=connect_failed`
- Code exchange failure: redirect to source page with `?error=connect_failed`
- Token-save failure: redirect to source page with `?error=connect_failed`

No path in the callback route should return a JSON response after these fixes.

---

## Settings/Integrations Page

`src/app/(app)/settings/integrations/page.tsx` — server component.

1. Calls `createClient()` from `@/lib/supabase/server` and `getUser()` to get the current user (same pattern as the dashboard page — do not rely on layout to pass the user down)
2. Calls `listIntegrationStatus(user.id)` to get connected providers; this returns an array of `{ provider: IntegrationProvider; expiresAt: Date | null; lastSyncAt: Date | null; scopes: string[] | null }` — **only rows that exist in the DB are returned** (missing providers are absent from the array, not present with `connected: false`)
3. The page synthesises a full `IntegrationStatus[]` list for the two supported providers (`'whoop'` and `'google'`): for each provider, find its row in the `listIntegrationStatus` result; if present, `connected = true` and `lastSyncAt` is available; if absent, `connected = false`
4. Passes the synthesised list plus `connected` (from `?connected=` URL param) and `error` (from `?error=` URL param) as props to `IntegrationsManager`
5. Success banner text: `"[Provider display name] connected successfully."` where provider display name maps `'whoop'` → "WHOOP", `'google'` → "Google Calendar"

### Component: `src/components/settings/IntegrationsManager.tsx` (client)

Shows cards for WHOOP and Google Calendar:
- **Connected**: provider name, "Last synced: [date]", "Reconnect" link (links to the same `/api/integrations/[provider]/connect?returnTo=settings` — re-runs the OAuth flow)
- **Not connected**: "Connect [Provider]" button (links to `/api/integrations/[provider]/connect?returnTo=settings`)
- Oura shown as "Coming soon" (greyed out)
- If `?error=connect_failed` in URL: show amber banner

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
- [ ] OAuth error from onboarding step 4 redirects to `/onboarding?error=connect_failed` and shows amber banner
- [ ] OAuth error from settings page redirects to `/settings/integrations?error=connect_failed` and shows amber banner
- [ ] NavBar shows Settings link for authenticated users
- [ ] `POST /api/briefing/generate` with valid Bearer token triggers sync + generation pipeline (unchanged, already works)

> **Manual smoke test (requires live credentials, not automatable):** After connecting WHOOP and/or Google Calendar and generating today's briefing, the resulting briefing should contain real data (WHOOP recovery score, calendar events) rather than default/empty values.
