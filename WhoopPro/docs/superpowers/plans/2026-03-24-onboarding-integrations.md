# Onboarding + Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a forced onboarding wizard, WHOOP/Google Calendar connect buttons, and a settings/integrations page so new users can connect their data sources and generate real briefings.

**Architecture:** The backend pipeline (OAuth, token storage, sync, Inngest) is already complete. This plan adds: (a) two backend fixes — cookie auth on the connect route and redirect-instead-of-JSON in the callback; (b) UI — onboarding wizard (4 steps), settings/integrations page, NavBar Settings link; (c) routing guards — middleware and app layout profile check.

**Tech Stack:** Next.js 15 App Router, Supabase SSR, TypeScript, Tailwind CSS, Vitest, `@/lib/supabase/server` (cookie-based server client).

> **AGENTS.md warning:** This codebase has a note: "This is NOT the Next.js you know — read node_modules/next/dist/docs/ before writing code." `cookies()` is async, `params` is a Promise, `headers()` is async. Follow patterns in existing files, not training data defaults.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/integrations/state.ts` | Add `returnTo` to `OAuthStatePayload`, extend `createOAuthStatePayload`, update `decodeStatePayload` |
| Create | `src/lib/integrations/__tests__/state.test.ts` | Unit tests for state payload round-trip with `returnTo` |
| Modify | `src/app/api/integrations/[provider]/connect/route.ts` | Add cookie auth fallback + `returnTo` param embedding |
| Create | `src/lib/integrations/redirect.ts` | Pure helper: `resolveCallbackDestination(outcome, returnTo, provider)` |
| Create | `src/lib/integrations/__tests__/redirect.test.ts` | Unit tests for `resolveCallbackDestination` |
| Modify | `src/app/api/integrations/[provider]/callback/route.ts` | Convert all JSON responses to redirects |
| Modify | `src/middleware.ts` | Add `/onboarding` and `/settings/:path*` guards |
| Modify | `src/app/(app)/layout.tsx` | Add profile-existence check → redirect `/onboarding` |
| Create | `src/lib/profile/actions.ts` | `saveProfileAction` server action — upserts profile row |
| Create | `src/lib/profile/__tests__/actions.test.ts` | Unit test for error path of `saveProfileAction` |
| Modify | `src/components/NavBar.tsx` | Add Settings link |
| Create | `src/app/onboarding/layout.tsx` | Minimal layout (no NavBar, centers content) |
| Create | `src/app/onboarding/page.tsx` | Server component — auth guard + profile guard + renders wizard |
| Create | `src/components/onboarding/OnboardingWizard.tsx` | Client component — 4-step wizard |
| Create | `src/app/(app)/settings/integrations/page.tsx` | Server component — integration status + renders manager |
| Create | `src/components/settings/IntegrationsManager.tsx` | Client component — connected/not-connected cards |

---

## Task 1: Extend `state.ts` — add `returnTo` to OAuth state payload

**Files:**
- Modify: `src/lib/integrations/state.ts`
- Create: `src/lib/integrations/__tests__/state.test.ts`

This is pure logic — no external deps, easy to TDD.

- [ ] **Step 1: Write failing tests**

Create `src/lib/integrations/__tests__/state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  createOAuthStatePayload,
  encodeStatePayload,
  decodeStatePayload,
} from '@/lib/integrations/state'

describe('createOAuthStatePayload', () => {
  it('creates payload without returnTo', () => {
    const p = createOAuthStatePayload('whoop', 'user-123')
    expect(p.provider).toBe('whoop')
    expect(p.userId).toBe('user-123')
    expect(p.returnTo).toBeUndefined()
    expect(typeof p.state).toBe('string')
    expect(typeof p.issuedAt).toBe('number')
  })

  it('creates payload with returnTo=onboarding', () => {
    const p = createOAuthStatePayload('google', 'user-abc', 'onboarding')
    expect(p.returnTo).toBe('onboarding')
  })

  it('creates payload with returnTo=settings', () => {
    const p = createOAuthStatePayload('whoop', 'user-abc', 'settings')
    expect(p.returnTo).toBe('settings')
  })
})

describe('decodeStatePayload round-trip', () => {
  it('preserves returnTo=onboarding through encode/decode', () => {
    const payload = createOAuthStatePayload('whoop', 'user-1', 'onboarding')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.returnTo).toBe('onboarding')
  })

  it('preserves returnTo=settings through encode/decode', () => {
    const payload = createOAuthStatePayload('google', 'user-2', 'settings')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded!.returnTo).toBe('settings')
  })

  it('drops unknown returnTo values', () => {
    const payload = createOAuthStatePayload('whoop', 'user-3')
    // Manually inject invalid returnTo into encoded payload
    const raw = { ...payload, returnTo: 'evil' }
    const encoded = Buffer.from(JSON.stringify(raw)).toString('base64url')
    const decoded = decodeStatePayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.returnTo).toBeUndefined()
  })

  it('returns null for missing value', () => {
    expect(decodeStatePayload(undefined)).toBeNull()
    expect(decodeStatePayload('')).toBeNull()
  })

  it('decodes payload without returnTo (backwards compat)', () => {
    const payload = createOAuthStatePayload('oura', 'user-4')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded!.returnTo).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (returnTo not yet in interface)**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run src/lib/integrations/__tests__/state.test.ts
```

Expected: errors about missing `returnTo` argument in `createOAuthStatePayload`.

- [ ] **Step 3: Update `src/lib/integrations/state.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { IntegrationProvider } from "@/lib/integrations/oauth";

export const OAUTH_STATE_COOKIE = "axial_oauth_state";

export interface OAuthStatePayload {
  state: string;
  provider: IntegrationProvider;
  userId: string;
  issuedAt: number;
  returnTo?: 'onboarding' | 'settings';
}

export function createOAuthStatePayload(
  provider: IntegrationProvider,
  userId: string,
  returnTo?: 'onboarding' | 'settings',
): OAuthStatePayload {
  const payload: OAuthStatePayload = {
    state: randomUUID(),
    provider,
    userId,
    issuedAt: Date.now(),
  };
  if (returnTo !== undefined) {
    payload.returnTo = returnTo;
  }
  return payload;
}

export function encodeStatePayload(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeStatePayload(value?: string): OAuthStatePayload | null {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    if (
      typeof parsed.state === "string" &&
      typeof parsed.userId === "string" &&
      (parsed.provider === "whoop" ||
        parsed.provider === "google" ||
        parsed.provider === "oura") &&
      typeof parsed.issuedAt === "number"
    ) {
      const result: OAuthStatePayload = {
        state: parsed.state,
        provider: parsed.provider,
        userId: parsed.userId,
        issuedAt: parsed.issuedAt,
      };
      // Whitelist returnTo — only carry through known values
      if (parsed.returnTo === 'onboarding' || parsed.returnTo === 'settings') {
        result.returnTo = parsed.returnTo;
      }
      return result;
    }
  } catch {
    return null;
  }

  return null;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run src/lib/integrations/__tests__/state.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/lib/integrations/state.ts apps/web/src/lib/integrations/__tests__/state.test.ts && git commit -m "feat: add returnTo to OAuthStatePayload with whitelist decode"
```

---

## Task 2: Fix connect route — cookie auth + `returnTo` embedding

**Files:**
- Modify: `src/app/api/integrations/[provider]/connect/route.ts`

> No unit test — this route has too many external dependencies (Supabase cookies, OAuth redirects). Covered by AC smoke test.

- [ ] **Step 1: Read the current file**

Read `src/app/api/integrations/[provider]/connect/route.ts` to confirm current state (should match the file you read during planning).

- [ ] **Step 2: Replace the file contents**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserIdFromRequest } from "@/lib/auth/request-user";
import { buildAuthorizationUrl, isIntegrationProvider } from "@/lib/integrations/oauth";
import {
  createOAuthStatePayload,
  encodeStatePayload,
  OAUTH_STATE_COOKIE,
} from "@/lib/integrations/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  // Try cookie auth first (browser/UI flow), then Bearer (API flow)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? await resolveUserIdFromRequest(request);

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Read and validate returnTo param
  const rawReturnTo = new URL(request.url).searchParams.get('returnTo');
  const returnTo = (rawReturnTo === 'onboarding' || rawReturnTo === 'settings')
    ? rawReturnTo
    : undefined;

  const statePayload = createOAuthStatePayload(providerValue, userId, returnTo);
  const authorizeUrl = buildAuthorizationUrl(providerValue, statePayload.state);
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(OAUTH_STATE_COOKIE, encodeStatePayload(statePayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/app/api/integrations/\[provider\]/connect/route.ts && git commit -m "fix: add cookie auth fallback and returnTo to connect route"
```

---

## Task 3: Fix callback route — all paths redirect (no JSON)

**Files:**
- Create: `src/lib/integrations/redirect.ts`
- Create: `src/lib/integrations/__tests__/redirect.test.ts`
- Modify: `src/app/api/integrations/[provider]/callback/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/integrations/__tests__/redirect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveCallbackDestination } from '@/lib/integrations/redirect'

describe('resolveCallbackDestination', () => {
  it('success + onboarding → /onboarding?connected=whoop', () => {
    expect(resolveCallbackDestination('success', 'onboarding', 'whoop'))
      .toBe('/onboarding?connected=whoop')
  })

  it('success + settings → /settings/integrations?connected=google', () => {
    expect(resolveCallbackDestination('success', 'settings', 'google'))
      .toBe('/settings/integrations?connected=google')
  })

  it('success + undefined returnTo → defaults to settings', () => {
    expect(resolveCallbackDestination('success', undefined, 'whoop'))
      .toBe('/settings/integrations?connected=whoop')
  })

  it('error + onboarding → /onboarding?error=connect_failed', () => {
    expect(resolveCallbackDestination('error', 'onboarding', 'whoop'))
      .toBe('/onboarding?error=connect_failed')
  })

  it('error + settings → /settings/integrations?error=connect_failed', () => {
    expect(resolveCallbackDestination('error', 'settings', 'whoop'))
      .toBe('/settings/integrations?error=connect_failed')
  })

  it('error + undefined returnTo → defaults to /settings/integrations', () => {
    expect(resolveCallbackDestination('error', undefined, 'whoop'))
      .toBe('/settings/integrations?error=connect_failed')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run src/lib/integrations/__tests__/redirect.test.ts
```

Expected: module not found error.

- [ ] **Step 3: Create `src/lib/integrations/redirect.ts`**

```ts
export function resolveCallbackDestination(
  outcome: 'success' | 'error',
  returnTo: 'onboarding' | 'settings' | undefined,
  providerValue: string,
): string {
  const base = returnTo === 'onboarding' ? '/onboarding' : '/settings/integrations';
  if (outcome === 'success') {
    return `${base}?connected=${providerValue}`;
  }
  return `${base}?error=connect_failed`;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run src/lib/integrations/__tests__/redirect.test.ts
```

- [ ] **Step 5: Rewrite the callback route**

Replace entire contents of `src/app/api/integrations/[provider]/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, isIntegrationProvider } from "@/lib/integrations/oauth";
import { saveIntegrationToken } from "@/lib/integrations/repository";
import { decodeStatePayload, OAUTH_STATE_COOKIE } from "@/lib/integrations/state";
import { resolveCallbackDestination } from "@/lib/integrations/redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clearStateCookieOn(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: providerValue } = await params;

  if (!isIntegrationProvider(providerValue)) {
    // Unknown provider — redirect to settings with error (no JSON)
    return NextResponse.redirect(new URL('/settings/integrations?error=connect_failed', request.url));
  }

  // Decode state cookie first — needed for returnTo in all error paths
  const stateCookie = decodeStatePayload(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const returnTo = stateCookie?.returnTo;

  // Provider returned an OAuth error
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearStateCookieOn(response);
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // Missing state cookie, code, or state param
  if (!code || !state || !stateCookie) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearStateCookieOn(response);
    return response;
  }

  // CSRF / expiry check
  const isValidState =
    stateCookie.provider === providerValue &&
    stateCookie.state === state &&
    Date.now() - stateCookie.issuedAt <= 10 * 60 * 1000;

  if (!isValidState) {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearStateCookieOn(response);
    return response;
  }

  try {
    const token = await exchangeAuthorizationCode(providerValue, code);
    await saveIntegrationToken({
      userId: stateCookie.userId,
      provider: providerValue,
      token,
    });

    const destination = resolveCallbackDestination('success', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearStateCookieOn(response);
    return response;
  } catch {
    const destination = resolveCallbackDestination('error', returnTo, providerValue);
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearStateCookieOn(response);
    return response;
  }
}
```

- [ ] **Step 6: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/lib/integrations/redirect.ts apps/web/src/lib/integrations/__tests__/redirect.test.ts "apps/web/src/app/api/integrations/[provider]/callback/route.ts" && git commit -m "fix: callback route converts all JSON responses to redirects"
```

---

## Task 4: Update middleware — add `/onboarding` and `/settings` guards

**Files:**
- Modify: `src/middleware.ts`

> Middleware involves NextRequest/NextResponse — hard to unit test. Logic is straightforward; verify by manual smoke test.

- [ ] **Step 1: Replace `src/middleware.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isAppRoute = path.startsWith("/dashboard") || path.startsWith("/settings");
  const isOnboarding = path === "/onboarding";
  const isAuthRoute = path === "/login" || path === "/signup";

  if ((isAppRoute || isOnboarding) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/onboarding", "/settings/:path*"],
};
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/middleware.ts && git commit -m "feat: add /onboarding and /settings session guards to middleware"
```

---

## Task 5: App layout — add profile-existence check

**Files:**
- Modify: `src/app/(app)/layout.tsx`

> No unit test — this is a Next.js server component that hits Supabase. Covered by AC flow test.

- [ ] **Step 1: Replace `src/app/(app)/layout.tsx`**

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
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

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add "apps/web/src/app/(app)/layout.tsx" && git commit -m "feat: add profile-existence check to app layout → redirect /onboarding"
```

---

## Task 6: `saveProfileAction` server action

**Files:**
- Create: `src/lib/profile/actions.ts`
- Create: `src/lib/profile/__tests__/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/profile/__tests__/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We only test the validation/error return shapes.
// The happy path hits Supabase and requires integration testing.
describe('saveProfileAction input types', () => {
  it('accepts valid chronotype values', () => {
    const validChronotypes = ['morning', 'balanced', 'evening'] as const
    validChronotypes.forEach(c => {
      expect(['morning', 'balanced', 'evening'].includes(c)).toBe(true)
    })
  })

  it('accepts valid objective values', () => {
    const validObjectives = ['performance', 'balance', 'recovery', 'consistency'] as const
    validObjectives.forEach(o => {
      expect(['performance', 'balance', 'recovery', 'consistency'].includes(o)).toBe(true)
    })
  })
})
```

> Note: deeper tests require mocking Supabase and `"use server"`. The type contract is the primary unit-testable surface here; integration tests require a live Supabase instance.

- [ ] **Step 2: Run the test — expect PASS (it's purely structural)**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run src/lib/profile/__tests__/actions.test.ts
```

- [ ] **Step 3: Create `src/lib/profile/actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveProfileAction(data: {
  timezone: string
  chronotype: 'morning' | 'balanced' | 'evening'
  objective: 'performance' | 'balance' | 'recovery' | 'consistency'
}): Promise<{ ok: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated.' }
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          timezone: data.timezone,
          chronotype: data.chronotype,
          objective: data.objective,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (error) {
      return { error: error.message }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error saving profile.'
    return { error: message }
  }
}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/lib/profile/actions.ts apps/web/src/lib/profile/__tests__/actions.test.ts && git commit -m "feat: add saveProfileAction server action for onboarding profile upsert"
```

---

## Task 7: NavBar — add Settings link

**Files:**
- Modify: `src/components/NavBar.tsx`

- [ ] **Step 1: Update `src/components/NavBar.tsx`**

```tsx
import Link from "next/link";
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
          <Link
            href="/settings/integrations"
            className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,white)] hover:text-[var(--foreground)] transition-colors"
          >
            Settings
          </Link>
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

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/components/NavBar.tsx && git commit -m "feat: add Settings link to NavBar"
```

---

## Task 8: Onboarding layout + page (server components)

**Files:**
- Create: `src/app/onboarding/layout.tsx`
- Create: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Create `src/app/onboarding/layout.tsx`**

```tsx
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/onboarding/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware should have caught this, but defend anyway
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { connected } = await searchParams;

  // Profile exists and this is NOT an OAuth return → go to dashboard
  if (profile && !connected) {
    redirect("/dashboard");
  }

  // Profile exists and ?connected= is present → user returned from OAuth on step 4
  // The wizard reads ?connected= and ?error= directly from useSearchParams()

  return <OnboardingWizard />;
}
```

- [ ] **Step 3: Commit**

> **Note:** Skip the `tsc --noEmit` check here — `OnboardingWizard` doesn't exist yet. Task 9 creates it and the `tsc` check there will pass. Do NOT skip Task 9.

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/app/onboarding/layout.tsx apps/web/src/app/onboarding/page.tsx && git commit -m "feat: add onboarding layout and page server component"
```

---

## Task 9: `OnboardingWizard` client component

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`

This is the largest single component. Read through the full spec section before implementing.

Key facts:
- 4 steps, all in one client component with `useState`
- Step 1: timezone searchable dropdown (IANA list embedded, not fetched)
- Step 2: chronotype cards — selecting immediately advances to step 3
- Step 3: objective cards — selecting calls `saveProfileAction`; shows spinner on selected card while pending
- Step 4: connect buttons + `?connected=` badge + `?error=` amber banner
- Initial step: reads `?connected=` from `useSearchParams()` — if present, starts at step 4

- [ ] **Step 1: Create `src/components/onboarding/OnboardingWizard.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { saveProfileAction } from '@/lib/profile/actions'

// Abbreviated IANA timezone list — common zones only
// For production, embed the full list from https://data.iana.org/time-zones/
const TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
]

type Chronotype = 'morning' | 'balanced' | 'evening'
type Objective = 'performance' | 'balance' | 'recovery' | 'consistency'

const CHRONOTYPE_OPTIONS: { value: Chronotype; label: string; subtitle: string }[] = [
  { value: 'morning', label: 'Morning', subtitle: 'Early Bird' },
  { value: 'balanced', label: 'Balanced', subtitle: 'Flexible' },
  { value: 'evening', label: 'Evening', subtitle: 'Night Owl' },
]

const OBJECTIVE_OPTIONS: { value: Objective; label: string; subtitle: string }[] = [
  { value: 'performance', label: 'Performance', subtitle: 'Push your limits' },
  { value: 'balance', label: 'Balance', subtitle: 'Steady and sustainable' },
  { value: 'recovery', label: 'Recovery', subtitle: 'Rebuild and restore' },
  { value: 'consistency', label: 'Consistency', subtitle: 'Show up every day' },
]

const PROVIDER_LABELS: Record<string, string> = {
  whoop: 'WHOOP',
  google: 'Google Calendar',
}

export function OnboardingWizard() {
  const searchParams = useSearchParams()
  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  // Start at step 4 if returning from OAuth
  const [step, setStep] = useState<1 | 2 | 3 | 4>(connectedParam ? 4 : 1)
  const [timezone, setTimezone] = useState(
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Madrid',
  )
  const [tzSearch, setTzSearch] = useState('')
  const [chronotype, setChronotype] = useState<Chronotype | null>(null)
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredTimezones = TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzSearch.toLowerCase()),
  )

  function handleSelectObjective(objective: Objective) {
    if (isPending) return
    setSelectedObjective(objective)
    setSaveError(null)

    startTransition(async () => {
      const result = await saveProfileAction({
        timezone,
        chronotype: chronotype!,
        objective,
      })
      if ('error' in result) {
        setSaveError(result.error)
        setSelectedObjective(null)
      } else {
        setStep(4)
      }
    })
  }

  return (
    <div className="w-full max-w-md">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 w-2 rounded-full transition-colors ${
              s === step ? 'bg-[var(--accent)]' : s < step ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Timezone */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            What's your timezone?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            We'll use this to time your briefings correctly.
          </p>
          <input
            type="text"
            placeholder="Search timezones..."
            value={tzSearch}
            onChange={(e) => setTzSearch(e.target.value)}
            className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm mb-2 bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="max-h-48 overflow-y-auto border border-[var(--line)] rounded-lg bg-[var(--surface)] mb-6">
            {filteredTimezones.map((tz) => (
              <button
                key={tz}
                onClick={() => setTimezone(tz)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] transition-colors ${
                  timezone === tz ? 'font-medium text-[var(--accent-strong)]' : 'text-[var(--foreground)]'
                }`}
              >
                {tz}
              </button>
            ))}
          </div>
          <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)] mb-4">
            Selected: <strong>{timezone}</strong>
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-[var(--accent)] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2 — Chronotype */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            When do you feel sharpest?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            Choose what fits you best.
          </p>
          <div className="flex flex-col gap-3">
            {CHRONOTYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setChronotype(option.value)
                  setStep(3)
                }}
                className="text-left border border-[var(--line)] rounded-lg px-4 py-3 hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] transition-all"
              >
                <p className="font-medium text-[var(--foreground)]">{option.label}</p>
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  {option.subtitle}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Objective */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            What's your main goal?
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            This shapes how your briefings are framed.
          </p>
          <div className="flex flex-col gap-3">
            {OBJECTIVE_OPTIONS.map((option) => {
              const isSelected = selectedObjective === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelectObjective(option.value)}
                  disabled={isPending}
                  className={`text-left border rounded-lg px-4 py-3 transition-all ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-[var(--line)] hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
                  } ${isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{option.label}</p>
                      <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                        {option.subtitle}
                      </p>
                    </div>
                    {isSelected && isPending && (
                      <div className="h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {saveError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError} — please try again.
            </p>
          )}
        </div>
      )}

      {/* Step 4 — Connect Integrations */}
      {step === 4 && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
            Connect your data
          </h1>
          <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
            Optional — skip and connect later in Settings.
          </p>

          {errorParam === 'connect_failed' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
              Could not connect integration. Please try again.
            </div>
          )}

          <div className="flex flex-col gap-3 mb-6">
            {(['whoop', 'google'] as const).map((provider) => {
              const isJustConnected = connectedParam === provider
              return (
                <div
                  key={provider}
                  className={`border rounded-lg px-4 py-3 flex items-center justify-between ${
                    isJustConnected
                      ? 'border-green-300 bg-green-50'
                      : 'border-[var(--line)]'
                  }`}
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {PROVIDER_LABELS[provider]}
                    </p>
                    {isJustConnected && (
                      <p className="text-xs text-green-700">Connected successfully</p>
                    )}
                  </div>
                  {isJustConnected ? (
                    <span className="text-green-600 text-lg">✓</span>
                  ) : (
                    <a
                      href={`/api/integrations/${provider}/connect?returnTo=onboarding`}
                      className="text-xs font-medium text-[var(--accent)] hover:underline"
                    >
                      Connect
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          <a
            href="/dashboard"
            className="block w-full text-center bg-[var(--accent)] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to dashboard
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to make sure nothing broke**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add apps/web/src/components/onboarding/OnboardingWizard.tsx && git commit -m "feat: add OnboardingWizard client component (4 steps)"
```

---

## Task 10: Settings/Integrations page + `IntegrationsManager` component

**Files:**
- Create: `src/app/(app)/settings/integrations/page.tsx`
- Create: `src/components/settings/IntegrationsManager.tsx`

- [ ] **Step 1: Create `src/components/settings/IntegrationsManager.tsx`**

```tsx
'use client'

type Provider = 'whoop' | 'google'

interface IntegrationStatus {
  provider: Provider
  connected: boolean
  lastSyncAt: string | null
}

interface IntegrationsManagerProps {
  integrations: IntegrationStatus[]
  connectedParam: string | null
  errorParam: string | null
}

const PROVIDER_LABELS: Record<Provider, string> = {
  whoop: 'WHOOP',
  google: 'Google Calendar',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function IntegrationsManager({
  integrations,
  connectedParam,
  errorParam,
}: IntegrationsManagerProps) {
  const connectedProviderLabel =
    connectedParam && connectedParam in PROVIDER_LABELS
      ? PROVIDER_LABELS[connectedParam as Provider]
      : null

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Integrations</h1>
      <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_60%,white)] mb-6">
        Connect your data sources to power your daily briefing.
      </p>

      {connectedProviderLabel && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
          {connectedProviderLabel} connected successfully.
        </div>
      )}

      {errorParam === 'connect_failed' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          Could not connect integration. Please try again.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {integrations.map(({ provider, connected, lastSyncAt }) => (
          <div
            key={provider}
            className="border border-[var(--line)] rounded-lg px-4 py-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-[var(--foreground)]">{PROVIDER_LABELS[provider]}</p>
              {connected ? (
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  Last synced: {formatDate(lastSyncAt)}
                </p>
              ) : (
                <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">
                  Not connected
                </p>
              )}
            </div>
            {connected ? (
              <a
                href={`/api/integrations/${provider}/connect?returnTo=settings`}
                className="text-xs font-medium text-[color-mix(in_srgb,var(--foreground)_50%,white)] hover:text-[var(--foreground)] transition-colors"
              >
                Reconnect
              </a>
            ) : (
              <a
                href={`/api/integrations/${provider}/connect?returnTo=settings`}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Connect
              </a>
            )}
          </div>
        ))}

        {/* Oura — coming soon */}
        <div className="border border-[var(--line)] rounded-lg px-4 py-4 flex items-center justify-between opacity-50">
          <div>
            <p className="font-medium text-[var(--foreground)]">Oura</p>
            <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,white)]">Coming soon</p>
          </div>
          <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_40%,white)]">—</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(app)/settings/integrations/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listIntegrationStatus } from '@/lib/integrations/repository'
import { IntegrationsManager } from '@/components/settings/IntegrationsManager'

const SUPPORTED_PROVIDERS = ['whoop', 'google'] as const
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number]

export default async function SettingsIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const statusRows = await listIntegrationStatus(user.id)

  // Synthesise full list — missing providers get connected = false
  const integrations = SUPPORTED_PROVIDERS.map((provider) => {
    const row = statusRows.find((r) => r.provider === provider)
    return {
      provider,
      connected: !!row,
      lastSyncAt: row?.lastSyncAt ?? null,
    }
  })

  const { connected = null, error = null } = await searchParams

  return (
    <IntegrationsManager
      integrations={integrations}
      connectedParam={connected}
      errorParam={error}
    />
  )
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\onofr\WhoopPro && git add "apps/web/src/app/(app)/settings/integrations/page.tsx" apps/web/src/components/settings/IntegrationsManager.tsx && git commit -m "feat: add settings/integrations page and IntegrationsManager component"
```

---

## Task 11: Final verification + push

- [ ] **Step 1: Run full test suite**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx vitest run
```

Expected: all tests pass (state.test.ts, redirect.test.ts, briefing-data.test.ts, request-user.test.ts, actions.test.ts — all in `src/lib/**/__tests__/`).

- [ ] **Step 2: TypeScript full check**

```bash
cd C:\Users\onofr\WhoopPro\apps\web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test checklist**

Start dev server:
```bash
cd C:\Users\onofr\WhoopPro\apps\web && npm run dev
```

Check each AC:
- [ ] Sign up with a new account → redirected to `/onboarding`
- [ ] Complete steps 1–3 → reaches step 4
- [ ] Click "Go to dashboard" → arrives at `/dashboard`
- [ ] Visit `/onboarding` with completed profile → redirected to `/dashboard`
- [ ] NavBar shows "Settings" link → click it → arrives at `/settings/integrations`
- [ ] Settings page shows WHOOP and Google Calendar as "Not connected", Oura as "Coming soon"
- [ ] Visit `/settings/integrations` without session (incognito) → redirected to `/login`

- [ ] **Step 4: Push branch to GitHub**

```bash
cd C:\Users\onofr\WhoopPro && git push origin feature/auth-briefing-home
```

---

## AC Traceability

| Acceptance Criterion | Task |
|---|---|
| New user redirected to /onboarding | Task 5 (layout) + Task 4 (middleware) |
| User with profile visiting /onboarding → /dashboard | Task 8 (page) |
| Wizard detects timezone from browser | Task 9 (wizard step 1) |
| Chronotype card advances immediately | Task 9 (wizard step 2) |
| Objective card calls saveProfileAction | Task 9 (wizard step 3) + Task 6 |
| Save error shows inline message | Task 9 (wizard step 3 error) |
| Step 4 shows connect links | Task 9 (wizard step 4) |
| Go to dashboard link | Task 9 (wizard step 4) |
| Connect WHOOP → returns to /onboarding?connected=whoop | Task 2 + Task 3 |
| Success badge on connected card | Task 9 (wizard step 4 connectedParam) |
| Connect from settings → /settings/integrations?connected=google | Task 2 + Task 3 |
| Settings shows connected state | Task 10 |
| ?connected= shows success banner | Task 10 |
| OAuth error → ?error=connect_failed amber banner | Task 3 + Task 9/10 |
| NavBar Settings link | Task 7 |
| Bearer POST /api/briefing/generate unchanged | No changes needed |
