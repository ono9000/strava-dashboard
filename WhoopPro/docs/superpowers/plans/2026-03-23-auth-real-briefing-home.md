# Auth + Real Briefing Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase SSR auth (email/password + Google OAuth), route protection middleware, and a real dashboard that pulls the user's daily briefing from Supabase.

**Architecture:** Route groups `(public)` and `(app)` organize public vs. authenticated routes. Next.js middleware enforces session checks via `@supabase/ssr`. The dashboard is a server component that queries `daily_briefings` directly; a client `GenerateBriefingButton` triggers async generation via the existing Inngest API.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, Supabase Auth (email+password + Google OAuth), TypeScript, Tailwind CSS 4.

---

## IMPORTANT: Read Before Writing Any Next.js Code

Next.js 16 has breaking changes. Before writing any code, read:
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — `cookies()` is now **async**: `const cookieStore = await cookies()`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — route group names do NOT appear in URLs

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/middleware.ts` | Session enforcement — redirect unauth to /login, auth to /dashboard |
| `src/lib/supabase/server.ts` | `createClient()` for server components and route handlers (uses `next/headers`) |
| `src/lib/supabase/middleware.ts` | `updateSession()` for middleware cookie handling |
| `src/lib/supabase/browser.ts` | `getSupabaseBrowserClient()` singleton for client components |
| `src/app/auth/callback/route.ts` | OAuth code → session exchange |
| `src/app/(public)/layout.tsx` | Minimal layout for landing/login/signup |
| `src/app/(public)/page.tsx` | Landing page — replaces the deleted root page.tsx |
| `src/app/(public)/login/page.tsx` | Login form page |
| `src/app/(public)/signup/page.tsx` | Signup form page |
| `src/app/(app)/layout.tsx` | App shell — NavBar + session check |
| `src/app/(app)/dashboard/page.tsx` | Real briefing dashboard (server component) |
| `src/components/AuthForm.tsx` | Shared auth card (client) — used by login and signup |
| `src/components/BriefingView.tsx` | Presentational briefing panels (server), includes stale-notice with generate button |
| `src/components/EmptyBriefingState.tsx` | Empty state when no briefing exists (server) |
| `src/components/GenerateBriefingButton.tsx` | Trigger briefing generation (client) |
| `src/components/NavBar.tsx` | Top navigation bar (server) |
| `src/components/LogoutButton.tsx` | Sign out client component (renders a form that submits to Server Action) |
| `src/lib/auth/actions.ts` | Server Action: `signOutAction` — calls server Supabase client, clears SSR cookie, redirects to `/` |
| `src/lib/dashboard/briefing-data.ts` | Pure helper: `rowToBriefing` + `isBriefingStale` (testable) |
| `src/lib/dashboard/__tests__/briefing-data.test.ts` | Unit tests for the above |
| `src/lib/auth/__tests__/request-user.test.ts` | Unit tests for DEV_USER_ID guard |

### Modified files
| Path | Change |
|---|---|
| `src/lib/auth/request-user.ts` | Add DEV_USER_ID runtime guard |
| `src/app/page.tsx` | **Delete** — replaced by `(public)/page.tsx` |

---

## Task 1: Install @supabase/ssr and add env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: Confirm .env.local is gitignored**

```bash
grep '.env.local' apps/web/.gitignore
```

Expected: `.env.local` appears in the output. If it does not, add it before proceeding — never commit this file.

- [ ] **Step 2: Install the package**

```bash
cd apps/web && npm install @supabase/ssr
```

Expected: package installs without error. `package.json` now includes `"@supabase/ssr"`.

- [ ] **Step 3: Add NEXT_PUBLIC vars to .env.local**

Open `apps/web/.env.local` and add these three lines (use the same values as your existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`):

```
NEXT_PUBLIC_SUPABASE_URL=<same value as SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same value as SUPABASE_ANON_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3200
```

- [ ] **Step 4: Verify the app still starts**

```bash
cd apps/web && npm run dev
```

Expected: server starts on port 3200, no errors in terminal.

- [ ] **Step 5: Commit (package files only — never commit .env.local)**

```bash
cd apps/web && git add package.json package-lock.json
git commit -m "feat: install @supabase/ssr for Next.js App Router auth"
```

---

## Task 2: Add DEV_USER_ID runtime guard

**Files:**
- Modify: `src/lib/auth/request-user.ts`
- Create: `src/lib/auth/__tests__/request-user.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/__tests__/request-user.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('resolveUserIdFromRequest - DEV_USER_ID guard', () => {
  afterEach(() => {
    delete process.env.DEV_USER_ID
    vi.resetModules()
  })

  it('throws when DEV_USER_ID is set outside development', async () => {
    process.env.DEV_USER_ID = 'some-user-id'
    vi.stubEnv('NODE_ENV', 'production')

    vi.resetModules()
    const { resolveUserIdFromRequest } = await import('@/lib/auth/request-user')
    const fakeReq = new Request('http://localhost/api/test') as any

    await expect(resolveUserIdFromRequest(fakeReq)).rejects.toThrow(
      'DEV_USER_ID must not be set outside local development'
    )
    vi.unstubAllEnvs()
  })

  it('returns DEV_USER_ID when set in development', async () => {
    process.env.DEV_USER_ID = 'dev-user-id'
    vi.stubEnv('NODE_ENV', 'development')

    vi.resetModules()
    const { resolveUserIdFromRequest } = await import('@/lib/auth/request-user')
    const fakeReq = new Request('http://localhost/api/test') as any

    await expect(resolveUserIdFromRequest(fakeReq)).resolves.toBe('dev-user-id')
    vi.unstubAllEnvs()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/web && npx vitest run src/lib/auth/__tests__/request-user.test.ts
```

Expected: FAIL — "throws when DEV_USER_ID is set outside development"

- [ ] **Step 3: Add the guard to request-user.ts**

Replace the full contents of `src/lib/auth/request-user.ts`:

```ts
import { NextRequest } from "next/server";
import { optionalEnv } from "@/lib/env";
import { getSupabasePublicClient } from "@/lib/supabase/public";

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function resolveUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = extractBearerToken(request);

  if (!token) {
    const devUserId = optionalEnv("DEV_USER_ID");
    if (devUserId && process.env.NODE_ENV !== "development") {
      throw new Error("DEV_USER_ID must not be set outside local development");
    }
    return devUserId ?? null;
  }

  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && npx vitest run src/lib/auth/__tests__/request-user.test.ts
```

Expected: PASS (both tests green)

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/lib/auth/request-user.ts src/lib/auth/__tests__/request-user.test.ts
git commit -m "feat: add DEV_USER_ID runtime guard to resolveUserIdFromRequest"
```

---

## Task 3: Create Supabase SSR clients

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/lib/supabase/browser.ts`

- [ ] **Step 1: Create the server client**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 2: Create the middleware client**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase session on every request and returns the updated
 * response. IMPORTANT: always return `supabaseResponse` from your middleware
 * — not a freshly constructed NextResponse — otherwise the refreshed session
 * cookies will be lost.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
```

- [ ] **Step 3: Create the browser client singleton**

`src/lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors related to the new files.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/lib/supabase/server.ts src/lib/supabase/middleware.ts src/lib/supabase/browser.ts
git commit -m "feat: add Supabase SSR clients (server, middleware, browser)"
```

---

## Task 4: Create middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the middleware file**

`src/middleware.ts`:
```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isAppRoute = path.startsWith("/dashboard");
  const isAuthRoute = path === "/login" || path === "/signup";

  if (isAppRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the redirect manually**

Start the dev server (`npm run dev`), visit `http://localhost:3200/dashboard` in the browser while not signed in.

Expected: you are redirected to `/login` (the page may 404 for now — that's fine, the redirect itself is what matters).

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/middleware.ts
git commit -m "feat: add Next.js middleware for auth-based route protection"
```

---

## Task 5: Create /auth/callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the route handler**

`src/app/auth/callback/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/app/auth/callback/route.ts
git commit -m "feat: add /auth/callback route handler for Supabase OAuth"
```

---

## Task 6: Create pure dashboard helpers with unit tests

Extract pure, testable logic from the dashboard page into a dedicated module.

**Files:**
- Create: `src/lib/dashboard/briefing-data.ts`
- Create: `src/lib/dashboard/__tests__/briefing-data.test.ts`

- [ ] **Step 1: Write the failing tests first**

`src/lib/dashboard/__tests__/briefing-data.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rowToBriefing, isBriefingStale } from '@/lib/dashboard/briefing-data'

const stubRow = {
  signal_date: '2026-03-23',
  day_mode: 'Strategic',
  synopsis: 'High-clarity day.',
  primary_recommendation: 'Protect the first window.',
  warning: 'Afternoon is vulnerable.',
  scores: {
    deepWorkReadiness: 80,
    meetingReadiness: 72,
    executionCapacity: 75,
    physicalReadiness: 68,
    recoveryProtection: 30,
  },
  windows: [],
  suggested_moves: ['Do the hard thing first.'],
  recalibration_triggers: ['Unexpected conflict.'],
  end_of_day_prompts: ['What worked?'],
}

describe('rowToBriefing', () => {
  it('maps snake_case DB row to camelCase DailyBriefing', () => {
    const briefing = rowToBriefing(stubRow)
    expect(briefing.dayMode).toBe('Strategic')
    expect(briefing.primaryRecommendation).toBe('Protect the first window.')
    expect(briefing.suggestedMoves).toEqual(['Do the hard thing first.'])
    expect(briefing.recalibrationTriggers).toEqual(['Unexpected conflict.'])
    expect(briefing.endOfDayPrompts).toEqual(['What worked?'])
    expect(briefing.scores.deepWorkReadiness).toBe(80)
  })
})

describe('isBriefingStale', () => {
  it('returns false when signal_date equals today', () => {
    expect(isBriefingStale('2026-03-23', '2026-03-23')).toBe(false)
  })

  it('returns true when signal_date is before today', () => {
    expect(isBriefingStale('2026-03-22', '2026-03-23')).toBe(true)
  })

  it('returns false when signal_date is today (same day, different check)', () => {
    expect(isBriefingStale('2026-03-23', '2026-03-23')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd apps/web && npx vitest run src/lib/dashboard/__tests__/briefing-data.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

`src/lib/dashboard/briefing-data.ts`:
```ts
import type { DailyBriefing } from "@/lib/domain/types";

export interface BriefingRow {
  signal_date: string;
  day_mode: string;
  synopsis: string;
  primary_recommendation: string;
  warning: string;
  scores: DailyBriefing["scores"];
  windows: DailyBriefing["windows"];
  suggested_moves: string[];
  recalibration_triggers: string[];
  end_of_day_prompts: string[];
}

export function rowToBriefing(row: BriefingRow): DailyBriefing {
  return {
    dayMode: row.day_mode as DailyBriefing["dayMode"],
    synopsis: row.synopsis,
    primaryRecommendation: row.primary_recommendation,
    warning: row.warning,
    scores: row.scores,
    windows: row.windows,
    suggestedMoves: row.suggested_moves,
    recalibrationTriggers: row.recalibration_triggers,
    endOfDayPrompts: row.end_of_day_prompts,
  };
}

/**
 * Returns true if the briefing's signal_date is before today.
 * Both arguments must be YYYY-MM-DD strings.
 */
export function isBriefingStale(signalDate: string, today: string): boolean {
  return signalDate < today;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && npx vitest run src/lib/dashboard/__tests__/briefing-data.test.ts
```

Expected: PASS (all 4 tests green)

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/lib/dashboard/briefing-data.ts src/lib/dashboard/__tests__/briefing-data.test.ts
git commit -m "feat: add dashboard briefing-data helpers with unit tests"
```

---

## Task 7: Create GenerateBriefingButton

**Files:**
- Create: `src/components/GenerateBriefingButton.tsx`

- [ ] **Step 1: Create the component**

`src/components/GenerateBriefingButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface GenerateBriefingButtonProps {
  timezone: string;
}

type State = "idle" | "loading" | "queued" | "error";

export function GenerateBriefingButton({ timezone }: GenerateBriefingButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setState("loading");
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setErrorMessage("Session expired. Please sign in again.");
        setState("error");
        return;
      }

      const response = await fetch("/api/briefing/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        setErrorMessage(data.error ?? "Failed to queue briefing generation.");
        setState("error");
        return;
      }

      setState("queued");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--ok)]">
          Your briefing is being generated. Refresh in a moment.
        </p>
        <button
          onClick={() => router.refresh()}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state === "error" && errorMessage && (
        <p className="text-sm text-[var(--warning)]">{errorMessage}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={state === "loading"}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 transition-colors"
      >
        {state === "loading" ? "Generating…" : "Generate today's briefing"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/components/GenerateBriefingButton.tsx
git commit -m "feat: add GenerateBriefingButton with Bearer auth and async UX"
```

---

## Task 8: Create BriefingView with stale notice + generate button

**Files:**
- Create: `src/components/BriefingView.tsx`

Note: `BriefingView` receives a `timezone` prop and passes it to `GenerateBriefingButton` inside the stale notice, so the user can regenerate from within the stale state.

- [ ] **Step 1: Create BriefingView**

`src/components/BriefingView.tsx`:
```tsx
import type { DailyBriefing, WindowKind } from "@/lib/domain/types";
import { GenerateBriefingButton } from "@/components/GenerateBriefingButton";

const scoreLabels: Array<{
  key: keyof DailyBriefing["scores"];
  label: string;
  invert?: boolean;
}> = [
  { key: "deepWorkReadiness", label: "Deep Work Readiness" },
  { key: "meetingReadiness", label: "Meeting Readiness" },
  { key: "executionCapacity", label: "Execution Capacity" },
  { key: "physicalReadiness", label: "Physical Readiness" },
  { key: "recoveryProtection", label: "Recovery Protection", invert: true },
];

const kindLabel: Record<WindowKind, string> = {
  "deep-work": "Deep Work Window",
  meetings: "Meeting Window",
  training: "Training Window",
  "delicate-zone": "Energy Dip Zone",
  shutdown: "Shutdown Window",
};

function scoreTone(score: number, invert = false): string {
  const value = invert ? 100 - score : score;
  if (value >= 70) return "text-[var(--ok)]";
  if (value >= 45) return "text-[var(--accent-strong)]";
  return "text-[var(--warning)]";
}

interface BriefingViewProps {
  briefing: DailyBriefing;
  staleDate?: string;
  timezone: string;
}

export function BriefingView({ briefing, staleDate, timezone }: BriefingViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {staleDate && (
        <div className="rounded-2xl border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--warning)]">
            This briefing is from {staleDate}. Generate a new one to get today&apos;s plan.
          </p>
          <GenerateBriefingButton timezone={timezone} />
        </div>
      )}

      <section className="panel rise-in rounded-3xl px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              Axial Day — Executive Briefing
            </p>
            <h1 className="display-font max-w-3xl text-4xl leading-tight text-[var(--foreground)] sm:text-5xl">
              Your calendar knows what exists.
              <br />
              This engine decides when it makes sense.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_78%,white)] sm:text-base">
              Today mode: <strong>{briefing.dayMode}</strong>. {briefing.synopsis}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Main call</p>
            <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-[var(--foreground)]">
              {briefing.primaryRecommendation}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Energy Architecture</h2>
            <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">5 dimensions</span>
          </header>
          <div className="mt-5 space-y-5">
            {scoreLabels.map(({ key, label, invert }) => {
              const value = briefing.scores[key];
              const progress = invert ? 100 - value : value;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
                    <p className={`text-sm font-semibold ${scoreTone(value, invert)}`}>{value}/100</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--line)_50%,white)]">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--warning)]">Risk guardrail</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">{briefing.warning}</p>
          </div>
        </article>

        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <header className="flex items-center justify-between">
            <h2 className="display-font text-2xl text-[var(--foreground)]">Optimal Windows</h2>
            <span className="text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">local time</span>
          </header>
          <div className="mt-5 space-y-3">
            {briefing.windows.map((window) => (
              <div key={window.kind} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{kindLabel[window.kind]}</p>
                  <p className="text-sm text-[var(--accent-strong)]">{window.start} - {window.end}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[color-mix(in_srgb,var(--foreground)_76%,white)]">{window.rationale}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <h2 className="display-font text-2xl text-[var(--foreground)]">Suggested Moves</h2>
          <ul className="mt-4 space-y-3">
            {briefing.suggestedMoves.map((move) => (
              <li key={move} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{move}</p>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel rise-in rounded-3xl p-6 sm:p-7">
          <h2 className="display-font text-2xl text-[var(--foreground)]">Adaptive Control Loop</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Recalibrate when</p>
              <ul className="mt-2 space-y-2">
                {briefing.recalibrationTriggers.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-[var(--foreground)]">- {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">End of day prompts</p>
              <ul className="mt-2 space-y-2">
                {briefing.endOfDayPrompts.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-[var(--foreground)]">- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/components/BriefingView.tsx
git commit -m "feat: add BriefingView with stale notice and generate button"
```

---

## Task 9: Create EmptyBriefingState, AuthForm, LogoutButton, NavBar

**Files:**
- Create: `src/components/EmptyBriefingState.tsx`
- Create: `src/components/AuthForm.tsx`
- Create: `src/components/LogoutButton.tsx`
- Create: `src/components/NavBar.tsx`

- [ ] **Step 1: Create EmptyBriefingState**

`src/components/EmptyBriefingState.tsx`:
```tsx
import { GenerateBriefingButton } from "@/components/GenerateBriefingButton";

interface EmptyBriefingStateProps {
  timezone: string;
}

export function EmptyBriefingState({ timezone }: EmptyBriefingStateProps) {
  return (
    <div className="panel rise-in rounded-3xl px-6 py-10 sm:px-8 sm:py-12 text-center">
      <p className="display-font text-2xl text-[var(--foreground)]">No briefing yet today</p>
      <p className="mt-3 max-w-sm mx-auto text-sm leading-relaxed text-[color-mix(in_srgb,var(--foreground)_70%,white)]">
        Connect WHOOP or Google Calendar to get a personalized briefing, or generate one now using your profile defaults.
      </p>
      <div className="mt-8 flex justify-center">
        <GenerateBriefingButton timezone={timezone} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AuthForm**

`src/components/AuthForm.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasOAuthError = searchParams.get("error") === "auth_failed";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); return; }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
      }
      // Use push only — no router.refresh() needed here as the new page
      // is a full server render that will establish the session on load.
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
  }

  return (
    <div className="panel rise-in mx-auto w-full max-w-sm rounded-3xl p-8">
      <p className="display-font text-2xl font-semibold text-[var(--foreground)]">
        {mode === "login" ? "Sign in" : "Get started"}
      </p>
      <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--foreground)_70%,white)]">
        {mode === "login" ? "Welcome back to Axial Day." : "Create your Axial Day account."}
      </p>

      {hasOAuthError && (
        <div className="mt-4 rounded-xl border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,white)] px-4 py-3">
          <p className="text-sm text-[var(--warning)]">Authentication failed. Please try again.</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
      >
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">or</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--warning)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60 transition-colors"
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[color-mix(in_srgb,var(--foreground)_60%,white)]">
        {mode === "login" ? (
          <>No account? <a href="/signup" className="underline">Sign up</a></>
        ) : (
          <>Already have an account? <a href="/login" className="underline">Sign in</a></>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create the signOut Server Action**

`src/lib/auth/actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Signs out the user server-side so the HttpOnly SSR session cookie is
 * cleared. Browser-only signOut() does not clear that cookie, which would
 * leave the middleware session check passing after logout.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 4: Create LogoutButton**

`src/components/LogoutButton.tsx`:
```tsx
"use client";

import { signOutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-xs font-medium text-[color-mix(in_srgb,var(--foreground)_65%,white)] hover:text-[var(--foreground)] transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
```

Note: using a `<form action={serverAction}>` pattern is idiomatic for Server Actions in Next.js App Router. The form submit triggers the server action, which clears the HttpOnly SSR session cookie and redirects to `/`.

- [ ] **Step 5: Create NavBar**

`src/components/NavBar.tsx`:
```tsx
import { LogoutButton } from "@/components/LogoutButton";

interface NavBarProps {
  email: string;
}

export function NavBar({ email }: NavBarProps) {
  return (
    <header className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_90%,white)] px-5 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <p className="display-font text-base font-semibold text-[var(--accent-strong)]">
          Axial Day
        </p>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-[color-mix(in_srgb,var(--foreground)_60%,white)] sm:block">
            {email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd apps/web && git add src/components/EmptyBriefingState.tsx src/components/AuthForm.tsx src/components/LogoutButton.tsx src/components/NavBar.tsx src/lib/auth/actions.ts
git commit -m "feat: add EmptyBriefingState, AuthForm, LogoutButton (Server Action), NavBar"
```

---

## Task 10: Create (public) layout, login, signup pages

**Files:**
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/login/page.tsx`
- Create: `src/app/(public)/signup/page.tsx`

- [ ] **Step 1: Create the public layout**

`src/app/(public)/layout.tsx`:
```tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      {children}
    </main>
  );
}
```

- [ ] **Step 2: Create the login page**

`src/app/(public)/login/page.tsx`:
```tsx
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in — Axial Day" };

export default function LoginPage() {
  // Suspense boundary required because AuthForm uses useSearchParams()
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
```

- [ ] **Step 3: Create the signup page**

`src/app/(public)/signup/page.tsx`:
```tsx
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Get started — Axial Day" };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
```

- [ ] **Step 4: Visit login and signup pages**

```bash
cd apps/web && npm run dev
```

Visit `http://localhost:3200/login` and `http://localhost:3200/signup`. Both should render the auth form.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add "src/app/(public)/layout.tsx" "src/app/(public)/login/page.tsx" "src/app/(public)/signup/page.tsx"
git commit -m "feat: add (public) route group with login and signup pages"
```

---

## Task 11: Create (app) layout and dashboard page

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create the (app) layout**

`src/app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar email={user.email ?? ""} />
      <div className="flex-1 mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-12">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the dashboard page**

`src/app/(app)/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { getTodayDateInTimeZone } from "@/lib/time/timezone";
import { rowToBriefing, isBriefingStale, type BriefingRow } from "@/lib/dashboard/briefing-data";
import { BriefingView } from "@/components/BriefingView";
import { EmptyBriefingState } from "@/components/EmptyBriefingState";

interface ProfileRow {
  timezone: string | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout handles redirect

  // Load timezone from profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (profileData ?? {}) as ProfileRow;
  const timezone = profile.timezone ?? "UTC";
  const today = getTodayDateInTimeZone(timezone);

  // Fetch most recent briefing
  const { data: briefingData, error } = await supabase
    .from("daily_briefings")
    .select(
      "signal_date, day_mode, synopsis, primary_recommendation, warning, scores, windows, suggested_moves, recalibration_triggers, end_of_day_prompts"
    )
    .eq("user_id", user.id)
    .order("signal_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <div className="panel rounded-3xl px-6 py-8 text-center">
        <p className="text-sm text-[var(--warning)]">
          Something went wrong loading your briefing. Try refreshing.
        </p>
      </div>
    );
  }

  if (!briefingData) {
    return <EmptyBriefingState timezone={timezone} />;
  }

  const row = briefingData as BriefingRow;
  const briefing = rowToBriefing(row);
  const stale = isBriefingStale(row.signal_date, today);

  return (
    <BriefingView
      briefing={briefing}
      staleDate={stale ? row.signal_date : undefined}
      timezone={timezone}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add "src/app/(app)/layout.tsx" "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: add (app) layout and real dashboard page"
```

---

## Task 12: Create landing page and remove old page.tsx

**Files:**
- Create: `src/app/(public)/page.tsx`
- Delete: `src/app/page.tsx`

- [ ] **Step 1: Create the landing page**

`src/app/(public)/page.tsx`:
```tsx
import Link from "next/link";

export const metadata = {
  title: "Axial Day — Energy Architecture for High-Performers",
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
        Personal Operating System
      </p>
      <h1 className="display-font mt-4 max-w-3xl text-5xl leading-tight text-[var(--foreground)] sm:text-6xl">
        Your calendar knows what exists.
        <br />
        This engine decides when it makes sense.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[color-mix(in_srgb,var(--foreground)_72%,white)]">
        Axial Day converts your physiological state, agenda, and goals into a daily briefing that tells you what to do, when to do it, and what to protect.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-xl bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-8 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the old demo page.tsx**

```bash
rm apps/web/src/app/page.tsx
```

- [ ] **Step 3: Verify TypeScript compiles and pages render**

```bash
cd apps/web && npx tsc --noEmit
```

Visit `http://localhost:3200` — landing page renders.
Visit `http://localhost:3200/dashboard` while not signed in — redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add "src/app/(public)/page.tsx" && git rm src/app/page.tsx
git commit -m "feat: add landing page, remove demo page — route groups complete"
```

---

## Task 13: End-to-end smoke test

No code changes — verification only.

- [ ] **Step 1: Full auth flow**

With the dev server running (`npm run dev`):

1. Visit `http://localhost:3200` → landing page renders ✓
2. Click "Get started" → `/signup` opens ✓
3. Sign up with a test email/password → redirects to `/dashboard` ✓
4. Dashboard shows `EmptyBriefingState` (or real briefing if signals exist) ✓
5. Click "Sign out" → redirects to `/` ✓
6. Visit `/dashboard` directly → redirects to `/login` ✓
7. Sign in with same credentials → redirects to `/dashboard` ✓
8. Visit `/login` while signed in → redirects to `/dashboard` ✓

- [ ] **Step 2: Generate briefing test**

On the dashboard with `EmptyBriefingState`:
1. Click "Generate today's briefing"
2. Button shows "Generating…" during the API call
3. After response: shows "Your briefing is being generated. Refresh in a moment." + Refresh button
4. Open Inngest dev UI (`http://localhost:8288`) — confirm the `briefing/generate.user` event arrived
5. Wait for job to complete, then click Refresh
6. `BriefingView` renders with real data ✓

- [ ] **Step 3: Run all unit tests**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

Check for any uncommitted changes before closing:

```bash
cd apps/web && git status
```

If `git status` shows any modified or untracked files from smoke-testing fixes, stage them explicitly by name. If there are no changes, skip the commit — do not create an empty commit.

```bash
# Only if git status shows unstaged changes:
git add <file1> <file2>
git commit -m "fix: smoke-test corrections for auth + real briefing home"
```

---

## Checklist Against Acceptance Criteria

- [ ] Unauthenticated user visiting `/dashboard` is redirected to `/login` ← Task 4
- [ ] `/auth/callback` is excluded from the middleware matcher ← Task 4
- [ ] User can sign up with email + password ← Task 10
- [ ] User can log in with email + password ← Task 10
- [ ] User can log in with Google (OAuth `redirectTo` uses `NEXT_PUBLIC_SITE_URL`) ← Task 9
- [ ] `/auth/callback` exchanges code using the server Supabase client ← Task 5
- [ ] Google OAuth failure redirects to `/login?error=auth_failed` with amber banner ← Tasks 5 & 9
- [ ] Dashboard shows real briefing from `daily_briefings` ← Task 11
- [ ] Dashboard query uses `ORDER BY signal_date DESC LIMIT 1` ← Task 11
- [ ] Dashboard uses user timezone from `profiles` ← Task 11
- [ ] No briefing → empty state with Generate button ← Task 9 + 11
- [ ] Stale briefing → stale notice with generate button ← Tasks 7 & 8
- [ ] Generate button uses Bearer token + sends `timezone` ← Task 7
- [ ] After queue, shows confirmation + manual Refresh button ← Task 7
- [ ] `DEV_USER_ID` outside dev throws runtime error ← Task 2
- [ ] Logout redirects to `/` ← Task 9
- [ ] Session persists across page refreshes ← Tasks 3 & 4
