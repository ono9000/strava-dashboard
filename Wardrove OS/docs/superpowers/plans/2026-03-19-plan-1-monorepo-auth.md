# Wardrobe OS — Plan 1: Monorepo Foundation & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Turborepo monorepo with shared packages, Supabase schema, and a complete authentication + onboarding flow on both web (Next.js 15) and mobile (Expo) — users can sign up, sign in, complete onboarding, and reach the app dashboard on both platforms.

**Architecture:** pnpm workspaces + Turborepo monorepo. Shared `packages/` hold types, Supabase client factories, and core business logic. Web uses Next.js 15 App Router with `@supabase/ssr` for server-side session management and middleware-based auth guards. Mobile uses Expo Router with `expo-secure-store` for token persistence and an `onAuthStateChange` listener for token refresh. Both platforms call the Supabase project directly for data; secret-dependent operations (LLM, weather) are proxied through Next.js API routes.

**Tech Stack:** pnpm 9, Turborepo 2, Next.js 15, Expo SDK 53, Expo Router 4, Supabase JS v2, @supabase/ssr, NativeWind v4, Tailwind CSS v3, expo-secure-store, Vitest

---

## Overview: 3 Plans for the Full MVP

This is Plan 1 of 3:
- **Plan 1 (this):** Monorepo foundation + auth + onboarding
- **Plan 2:** Wardrobe inventory (clothing items, state machine, image upload, laundry)
- **Plan 3:** Outfit intelligence (LLM, weather, outfit generation, usage tracking)

---

## File Map

### Root
- `package.json` — pnpm workspace root
- `pnpm-workspace.yaml` — workspace packages declaration
- `turbo.json` — Turborepo pipeline config
- `tsconfig.base.json` — shared TypeScript base config
- `.gitignore`

### packages/types
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts` — User, ClothingItem, Outfit, ClothingState, all shared types

### packages/db
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/src/client.ts` — createBrowserClient / createServerClient / createMobileClient factories
- `packages/db/src/index.ts`
- `packages/db/migrations/001_users.sql` — users profile table, RLS policies, signup trigger

### packages/core
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/vitest.config.ts`
- `packages/core/src/defaults.ts` — getDefaultMaxWears(category)
- `packages/core/src/index.ts`
- `packages/core/src/__tests__/defaults.test.ts`

### apps/web
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/tailwind.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/tsconfig.json`
- `apps/web/.env.local` (not committed)
- `apps/web/vitest.config.ts`
- `apps/web/middleware.ts` — session refresh + redirect guards
- `apps/web/lib/auth/redirects.ts` — pure redirect logic (unit tested)
- `apps/web/lib/supabase/server.ts` — createSupabaseServerClient helper
- `apps/web/lib/supabase/client.ts` — getSupabaseBrowserClient singleton
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx` — root HTML shell
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/app/(app)/layout.tsx` — server-side auth guard + nav shell
- `apps/web/app/(app)/onboarding/page.tsx`
- `apps/web/app/(app)/dashboard/page.tsx` — stub
- `apps/web/app/api/auth/signout/route.ts`
- `apps/web/__tests__/redirects.test.ts`

### apps/mobile
- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/tailwind.config.js`
- `apps/mobile/.env.local` (not committed)
- `apps/mobile/lib/supabase.ts` — Supabase client + SecureStore adapter
- `apps/mobile/lib/api.ts` — fetch wrapper for Next.js API routes
- `apps/mobile/app/_layout.tsx` — root layout + auth state listener + redirect logic
- `apps/mobile/app/(auth)/_layout.tsx`
- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/signup.tsx`
- `apps/mobile/app/(app)/_layout.tsx` — tab navigator (protected)
- `apps/mobile/app/(app)/onboarding.tsx`
- `apps/mobile/app/(app)/index.tsx` — dashboard stub

---

## Task 1: Initialize Turborepo monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Install pnpm globally if not present**

```bash
npm install -g pnpm@9
pnpm --version
```
Expected: `9.x.x`

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "wardrobe-os",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint",
    "type-check": "turbo type-check"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true
  }
}
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
.turbo
dist
.next
.expo
*.local
.env
.env.local
.env.*.local
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p apps/web apps/mobile packages/types packages/db packages/core packages/ui
```

- [ ] **Step 8: Install root deps and verify**

```bash
pnpm install
```
Expected: lockfile created, no errors.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: initialize Turborepo monorepo with pnpm workspaces"
```

---

## Task 2: Create packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@wardrobe-os/types",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

```typescript
// ─── Enums ─────────────────────────────────────────────────────────────────

export type ClothingState =
  | 'available'
  | 'dirty'
  | 'washing'
  | 'stored'
  | 'archived'

export type OutfitRole = 'top' | 'bottom' | 'shoes' | 'outer' | 'accessory'

export type Occasion =
  | 'casual'
  | 'office'
  | 'dinner'
  | 'sport'
  | 'event'
  | 'home'
  | 'travel'

// ─── Database row types ─────────────────────────────────────────────────────

export interface StylePreferences {
  formality_lean: 1 | 2 | 3 | 4 | 5
  preferred_colors: string[]
  style_tags: string[]
}

export interface WeatherCache {
  temp: number
  feels_like: number
  condition: string
  rain_probability: number
  cached_at: string
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  style_preferences: StylePreferences | null
  location_lat: number | null
  location_lng: number | null
  weather_cache: WeatherCache | null
  onboarding_complete: boolean
  created_at: string
}

export interface ClothingItem {
  id: string
  user_id: string
  name: string
  category: string
  subcategory: string | null
  color_primary: string
  color_secondary: string | null
  pattern: string | null
  material: string | null
  formality: number
  warmth_level: number
  style_tags: string[]
  season: string[]
  image_path: string | null
  max_wears_before_wash: number
  current_wear_count: number
  state: ClothingState
  last_worn_at: string | null
  total_wears: number
  ai_detected: boolean
  created_at: string
}

export interface Outfit {
  id: string
  user_id: string
  occasion: Occasion | null
  weather_context: WeatherCache | null
  ai_explanation: string | null
  score: number | null
  confirmed: boolean
  worn_at: string | null
  created_at: string
}

export interface OutfitItem {
  outfit_id: string
  clothing_item_id: string
  role: OutfitRole
}

export interface WearEvent {
  id: string
  user_id: string
  clothing_item_id: string
  outfit_id: string | null
  worn_at: string
}

// ─── LLM types ──────────────────────────────────────────────────────────────

export interface ClothingDetectionResult {
  category: string
  subcategory: string | null
  color_primary: string
  color_secondary: string | null
  pattern: string | null
  material: string | null
  formality: number
  warmth_level: number
  style_tags: string[]
}

export interface OutfitRecommendation {
  items: Array<{ id: string; role: OutfitRole }>
  explanation: string
  score: number | null
}

export interface OutfitContext {
  available_items: Pick<
    ClothingItem,
    'id' | 'category' | 'color_primary' | 'formality' | 'style_tags' | 'warmth_level' | 'total_wears' | 'last_worn_at'
  >[]
  occasion: Occasion
  weather: WeatherCache | null
  wear_history: Array<{ worn_at: string; occasion: string | null; item_ids: string[] }>
  style_preferences: StylePreferences | null
}
```

- [ ] **Step 4: Install and verify**

```bash
pnpm install
cd packages/types && pnpm type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types
git commit -m "feat(types): add shared TypeScript types"
```

---

## Task 3: Create packages/db

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/migrations/001_users.sql`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@wardrobe-os/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.5.0",
    "@wardrobe-os/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/db/src/client.ts`**

```typescript
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient, type CookieMethods } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { SupportedStorage } from '@supabase/supabase-js'

function getEnvVars() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: SUPABASE_URL and SUPABASE_ANON_KEY required'
    )
  }
  return { url, anonKey }
}

/** For Next.js client components */
export function createBrowserClient() {
  const { url, anonKey } = getEnvVars()
  return _createBrowserClient(url, anonKey)
}

/** For Next.js server components, API routes, and middleware */
export function createServerClient(cookies: CookieMethods) {
  const { url, anonKey } = getEnvVars()
  return _createServerClient(url, anonKey, { cookies })
}

/** For Expo mobile — plain supabase-js client, accepts custom storage (e.g. expo-secure-store) */
export function createMobileClient(storage?: SupportedStorage) {
  const { url, anonKey } = getEnvVars()
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      ...(storage ? { storage } : {}),
    },
  })
}
```

- [ ] **Step 4: Create `packages/db/src/index.ts`**

```typescript
export { createBrowserClient, createServerClient, createMobileClient } from './client'
```

- [ ] **Step 5: Create `packages/db/migrations/001_users.sql`**

```sql
-- ─── Users profile table ────────────────────────────────────────────────────
-- Extends Supabase auth.users with application-specific profile data.
-- id mirrors auth.users.id and equals auth.uid() in all RLS policies.

CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  avatar_url          TEXT,
  style_preferences   JSONB,
  location_lat        DOUBLE PRECISION,
  location_lng        DOUBLE PRECISION,
  weather_cache       JSONB,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row only"
  ON public.users
  FOR ALL
  USING (auth.uid() = id);

-- ─── Trigger: auto-create profile on signup ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)   -- fallback for email/password signups
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 6: Install and verify**

```bash
pnpm install
cd packages/db && pnpm type-check
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db
git commit -m "feat(db): add Supabase client factories and users migration"
```

---

## Task 4: Create packages/core with TDD

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/defaults.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/__tests__/defaults.test.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@wardrobe-os/core",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@wardrobe-os/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 4: Write the failing test**

```typescript
// packages/core/src/__tests__/defaults.test.ts
import { describe, it, expect } from 'vitest'
import { getDefaultMaxWears } from '../defaults'

describe('getDefaultMaxWears', () => {
  it('returns 1 for t-shirt', () => expect(getDefaultMaxWears('t-shirt')).toBe(1))
  it('returns 1 for shirt', () => expect(getDefaultMaxWears('shirt')).toBe(1))
  it('returns 1 for blouse', () => expect(getDefaultMaxWears('blouse')).toBe(1))
  it('returns 2 for polo', () => expect(getDefaultMaxWears('polo')).toBe(2))
  it('returns 3 for jeans', () => expect(getDefaultMaxWears('jeans')).toBe(3))
  it('returns 4 for sweater', () => expect(getDefaultMaxWears('sweater')).toBe(4))
  it('returns 8 for jacket', () => expect(getDefaultMaxWears('jacket')).toBe(8))
  it('returns 8 for coat', () => expect(getDefaultMaxWears('coat')).toBe(8))
  it('returns 1 for unknown category (safe default)', () => {
    expect(getDefaultMaxWears('unknown-category')).toBe(1)
  })
  it('is case-insensitive', () => {
    expect(getDefaultMaxWears('T-Shirt')).toBe(1)
    expect(getDefaultMaxWears('JACKET')).toBe(8)
  })
})
```

- [ ] **Step 5: Run test — verify it fails**

```bash
cd packages/core && pnpm install && pnpm test
```
Expected: FAIL — `Cannot find module '../defaults'`

- [ ] **Step 6: Implement `src/defaults.ts`**

```typescript
const WEAR_DEFAULTS: Record<string, number> = {
  'blouse':  1,
  'shirt':   1,
  't-shirt': 1,
  'polo':    2,
  'jeans':   3,
  'sweater': 4,
  'jacket':  8,
  'coat':    8,
}

/**
 * Returns the default number of wears before washing for a clothing category.
 * Falls back to 1 for unknown categories.
 */
export function getDefaultMaxWears(category: string): number {
  return WEAR_DEFAULTS[category.toLowerCase()] ?? 1
}
```

- [ ] **Step 7: Create `src/index.ts`**

```typescript
export { getDefaultMaxWears } from './defaults'
```

- [ ] **Step 8: Run tests — verify they pass**

```bash
cd packages/core && pnpm test
```
Expected: 10 tests passing.

- [ ] **Step 9: Commit**

```bash
git add packages/core
git commit -m "feat(core): add getDefaultMaxWears with full test coverage"
```

---

## Task 5: Apply Supabase migration

**Prerequisites:** A Supabase project must exist. Create one at supabase.com if needed. You need: Project URL, anon key, service role key, and DB connection string.

- [ ] **Step 1: Apply migration via Supabase SQL Editor**

Open your Supabase project → SQL Editor → paste the full contents of `packages/db/migrations/001_users.sql` → Run.

- [ ] **Step 2: Verify in Supabase dashboard**

Check:
- Table Editor → `public.users` exists with all columns
- Authentication → `on_auth_user_created` trigger exists under Database → Functions
- Table Editor → `public.users` has RLS enabled (shield icon)

- [ ] **Step 3: Record your environment variables**

You will need these values for the next tasks:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
EXPO_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000   # Android emulator — adjust per device
```

- [ ] **Step 4: Commit migration file (already committed in Task 3)**

Migration is already tracked in git via `packages/db/migrations/`. Nothing more to do.

---

## Task 6: Scaffold Next.js web app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/.env.local`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@wardrobe-os/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.43.0",
    "@wardrobe-os/db": "workspace:*",
    "@wardrobe-os/types": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@wardrobe-os/db', '@wardrobe-os/types', '@wardrobe-os/core'],
}

export default config
```

- [ ] **Step 3: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
```

- [ ] **Step 5: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create `apps/web/.env.local`** (do not commit)

```
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

- [ ] **Step 7: Create `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-inter: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 8: Install deps and verify Next.js starts**

```bash
cd apps/web && pnpm install && pnpm dev
```
Expected: server starts on http://localhost:3000 (404 is fine — no pages yet). Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "chore(web): scaffold Next.js 15 app with Tailwind"
```

---

## Task 7: Web auth redirect logic (TDD) + middleware + Supabase helpers

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/__tests__/redirects.test.ts`
- Create: `apps/web/lib/auth/redirects.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/__tests__/redirects.test.ts
import { describe, it, expect } from 'vitest'
import { getRedirectPath } from '../lib/auth/redirects'

describe('getRedirectPath', () => {
  it('redirects unauthenticated user from protected route to /login', () => {
    expect(getRedirectPath(false, false, '/dashboard')).toBe('/login')
  })

  it('does not redirect unauthenticated user on /login', () => {
    expect(getRedirectPath(false, false, '/login')).toBeNull()
  })

  it('does not redirect unauthenticated user on /signup', () => {
    expect(getRedirectPath(false, false, '/signup')).toBeNull()
  })

  it('redirects authenticated user without onboarding to /onboarding from any app route', () => {
    expect(getRedirectPath(true, false, '/dashboard')).toBe('/onboarding')
  })

  it('does not redirect authenticated user without onboarding if already on /onboarding', () => {
    expect(getRedirectPath(true, false, '/onboarding')).toBeNull()
  })

  it('redirects authenticated + onboarded user from /login to /dashboard', () => {
    expect(getRedirectPath(true, true, '/login')).toBe('/dashboard')
  })

  it('redirects authenticated + onboarded user from /signup to /dashboard', () => {
    expect(getRedirectPath(true, true, '/signup')).toBe('/dashboard')
  })

  it('does not redirect authenticated + onboarded user on a protected route', () => {
    expect(getRedirectPath(true, true, '/dashboard')).toBeNull()
    expect(getRedirectPath(true, true, '/wardrobe')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd apps/web && pnpm test
```
Expected: FAIL — `Cannot find module '../lib/auth/redirects'`

- [ ] **Step 4: Implement `lib/auth/redirects.ts`**

```typescript
const PUBLIC_PATHS = new Set(['/login', '/signup'])

/**
 * Returns the path to redirect to, or null if no redirect is needed.
 * Pure function — no side effects, fully unit testable.
 */
export function getRedirectPath(
  hasSession: boolean,
  onboardingComplete: boolean,
  currentPath: string
): string | null {
  const isPublic = PUBLIC_PATHS.has(currentPath)

  if (!hasSession && !isPublic) return '/login'
  if (hasSession && onboardingComplete && isPublic) return '/dashboard'
  if (hasSession && !onboardingComplete && currentPath !== '/onboarding') return '/onboarding'
  return null
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd apps/web && pnpm test
```
Expected: 8 tests passing.

- [ ] **Step 6: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@wardrobe-os/db'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient({
    get(name) {
      return cookieStore.get(name)?.value
    },
    set(name, value, options) {
      cookieStore.set({ name, value, ...options })
    },
    remove(name, options) {
      cookieStore.set({ name, value: '', ...options })
    },
  })
}
```

- [ ] **Step 7: Create `lib/supabase/client.ts`**

```typescript
'use client'
import { createBrowserClient } from '@wardrobe-os/db'

let client: ReturnType<typeof createBrowserClient> | null = null

/** Singleton browser client — reuse across the component tree */
export function getSupabaseBrowserClient() {
  if (!client) client = createBrowserClient()
  return client
}
```

- [ ] **Step 8: Create `middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@wardrobe-os/db'
import { getRedirectPath } from '@/lib/auth/redirects'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  const supabase = createServerClient({
    get(name) { return request.cookies.get(name)?.value },
    set(name, value, options) {
      request.cookies.set({ name, value, ...options })
      response.cookies.set({ name, value, ...options })
    },
    remove(name, options) {
      request.cookies.set({ name, value: '', ...options })
      response.cookies.set({ name, value: '', ...options })
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  let onboardingComplete = false

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()
    onboardingComplete = profile?.onboarding_complete ?? false
  }

  const redirectTo = getRedirectPath(!!user, onboardingComplete, pathname)
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib apps/web/middleware.ts apps/web/__tests__ apps/web/vitest.config.ts
git commit -m "feat(web): add auth redirect logic with tests, Supabase helpers, and middleware"
```

---

## Task 8: Web root layout and auth pages

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Wardrobe OS',
  description: 'Your personal wardrobe intelligence system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your wardrobe</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="font-medium text-gray-900 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(auth)/signup/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create your wardrobe</h1>
          <p className="mt-1 text-sm text-gray-500">Free to start, intelligent by design</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Min. 8 characters" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          Have an account?{' '}
          <Link href="/login" className="font-medium text-gray-900 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app
git commit -m "feat(web): add root layout and auth pages (login, signup)"
```

---

## Task 9: Web protected layout, onboarding, and dashboard stub

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/api/auth/signout/route.ts`
- Create: `apps/web/app/(app)/onboarding/page.tsx`
- Create: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create `app/(app)/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Wardrobe OS</span>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Sign out
          </button>
        </form>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/api/auth/signout/route.ts`**

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 3: Add `OPENWEATHERMAP_API_KEY` to `apps/web/.env.local`**

Open `apps/web/.env.local` and append:

```
OPENWEATHERMAP_API_KEY=your-key-here
```

- [ ] **Step 3b: Create `app/api/location/geocode/route.ts`**

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { city } = await request.json() as { city: string }
  if (!city?.trim()) return Response.json({ error: 'City is required' }, { status: 400 })

  const apiKey = process.env.OPENWEATHERMAP_API_KEY
  if (!apiKey) return Response.json({ error: 'Weather API not configured' }, { status: 500 })

  const geoRes = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
  )
  if (!geoRes.ok) return Response.json({ error: 'Geocoding failed' }, { status: 502 })

  const geoData = await geoRes.json() as Array<{ lat: number; lon: number; name: string }>
  if (!geoData.length) return Response.json({ error: 'City not found' }, { status: 404 })

  const { lat, lon } = geoData[0]
  return Response.json({ lat, lng: lon })
}
```

- [ ] **Step 3c: Create `app/(app)/onboarding/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'location' | 'done'>('location')
  const [city, setCity] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported. Please enter your city.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoError(null) },
      () => setGeoError('Location access denied. Please enter your city.')
    )
  }

  function handleLocationNext(e: React.FormEvent) {
    e.preventDefault()
    if (!coords && !city.trim()) { setGeoError('Provide your location or city.'); return }
    setStep('done')
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const update: Record<string, unknown> = { onboarding_complete: true }

    if (coords) {
      update.location_lat = coords.lat
      update.location_lng = coords.lng
    } else if (city.trim()) {
      // Resolve city to coordinates via server-side geocoding
      const res = await fetch('/api/location/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim() }),
      })
      if (res.ok) {
        const { lat, lng } = await res.json() as { lat: number; lng: number }
        update.location_lat = lat
        update.location_lng = lng
      } else {
        // Proceed without coordinates — weather will prompt again on first use
        console.warn('Geocoding failed for city:', city)
      }
    }

    const { error } = await supabase.from('users').update(update).eq('id', user.id)
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-lg p-8 bg-white rounded-xl shadow-sm border border-gray-200 space-y-6">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Step {step === 'location' ? '1' : '2'} of 2
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {step === 'location' ? 'Where are you?' : 'Almost done'}
          </h1>
        </div>

        {step === 'location' ? (
          <form onSubmit={handleLocationNext} className="space-y-4">
            <p className="text-sm text-gray-500">We use your location for weather-appropriate outfit suggestions.</p>
            {coords ? (
              <p className="text-sm text-green-600 font-medium">✓ Location captured</p>
            ) : (
              <>
                <button type="button" onClick={requestGeolocation}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Use my current location
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Enter your city (e.g. Madrid)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </>
            )}
            {geoError && <p className="text-sm text-red-600">{geoError}</p>}
            <button type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
              Next
            </button>
          </form>
        ) : (
          <form onSubmit={handleFinish} className="space-y-4">
            <p className="text-sm text-gray-500">Your wardrobe is ready. You can update preferences anytime.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {loading ? 'Setting up…' : 'Enter my wardrobe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(app)/dashboard/page.tsx`**

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase.from('users').select('name').single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning{profile?.name ? `, ${profile.name}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your wardrobe is ready. Start by adding your first item.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center">
        <p className="text-sm text-gray-400">
          Clothing inventory coming in Plan 2.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Smoke-test the full web auth flow**

```bash
cd apps/web && pnpm dev
```
Manually verify:
1. `http://localhost:3000` → redirects to `/login`
2. Sign up with a new email → redirects to `/onboarding`
3. Grant location or enter city → click "Enter my wardrobe" → reaches `/dashboard`
4. Refresh → stays on `/dashboard`
5. Click Sign out → redirects to `/login`

- [ ] **Step 6: Run all web tests**

```bash
cd apps/web && pnpm test
```
Expected: 8 tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app
git commit -m "feat(web): add protected layout, onboarding flow, and dashboard stub"
```

---

## Task 10: Scaffold Expo mobile app

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/.env.local` (not committed)
- Create: `apps/mobile/assets/` (placeholder images)

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@wardrobe-os/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@expo/vector-icons": "^14.0.0",
    "@supabase/supabase-js": "^2.43.0",
    "@wardrobe-os/db": "workspace:*",
    "@wardrobe-os/types": "workspace:*",
    "expo": "~53.0.0",
    "expo-constants": "~17.0.0",
    "expo-font": "~13.0.0",
    "expo-linking": "~7.0.0",
    "expo-location": "~18.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "nativewind": "^4.0.1",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "react-native-safe-area-context": "^4.10.0",
    "react-native-screens": "^4.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "Wardrobe OS",
    "slug": "wardrobe-os",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "wardrobe-os",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.wardrobeos.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.wardrobeos.app"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Allow Wardrobe OS to use your location for weather-based outfit suggestions."
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 3: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Create `apps/mobile/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 5: Create `apps/mobile/.env.local`** (do not commit)

```
EXPO_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

- [ ] **Step 6: Create placeholder assets**

```bash
mkdir -p apps/mobile/assets
```
Place a 1024×1024 PNG as `icon.png`, `splash.png`, and `adaptive-icon.png` in `apps/mobile/assets/`. Any solid-color PNG works for development.

- [ ] **Step 7: Install deps**

```bash
cd apps/mobile && pnpm install
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "chore(mobile): scaffold Expo app with NativeWind and Expo Router"
```

---

## Task 11: Mobile Supabase client, API wrapper, and auth screens

**Files:**
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/api.ts`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/signup.tsx`

- [ ] **Step 1: Create `lib/supabase.ts`**

```typescript
import * as SecureStore from 'expo-secure-store'
import { createMobileClient } from '@wardrobe-os/db'
import type { SupportedStorage } from '@supabase/supabase-js'

// Adapter that satisfies Supabase's SupportedStorage interface using expo-secure-store.
// NOTE: SecureStore has a ~2KB limit per key. Supabase sessions rarely exceed this,
// but if they do, tokens will silently fail to persist. For MVP this is acceptable.
const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createMobileClient(ExpoSecureStoreAdapter)
```

- [ ] **Step 2: Create `lib/api.ts`**

```typescript
import { supabase } from './supabase'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 3: Create `app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 4: Create `app/(auth)/login.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // Navigation handled by root layout auth listener
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900">Welcome back</Text>
        <Text className="mt-1 text-sm text-gray-500">Sign in to your wardrobe</Text>
        <View className="mt-8 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
              keyboardType="email-address" placeholder="you@example.com"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry
              placeholder="Your password"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <TouchableOpacity onPress={handleLogin} disabled={loading}
            className="bg-gray-900 rounded-xl py-3.5 items-center mt-2">
            <Text className="text-white font-semibold text-sm">
              {loading ? 'Signing in…' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link href="/(auth)/signup" className="font-medium text-gray-900">Sign up</Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 5: Create `app/(auth)/signup.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignupScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) { setError(error.message); setLoading(false) }
    // Navigation handled by root layout auth listener
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900">Create your wardrobe</Text>
        <Text className="mt-1 text-sm text-gray-500">Free to start, intelligent by design</Text>
        <View className="mt-8 gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Your name"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none"
              keyboardType="email-address" placeholder="you@example.com"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry
              placeholder="Min. 8 characters"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900" />
          </View>
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <TouchableOpacity onPress={handleSignup} disabled={loading}
            className="bg-gray-900 rounded-xl py-3.5 items-center mt-2">
            <Text className="text-white font-semibold text-sm">
              {loading ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-center text-sm text-gray-500 mt-6">
          Have an account?{' '}
          <Link href="/(auth)/login" className="font-medium text-gray-900">Sign in</Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib apps/mobile/app
git commit -m "feat(mobile): add Supabase client, API wrapper, and auth screens"
```

---

## Task 12: Mobile root layout, protected navigation, onboarding, and dashboard stub

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/onboarding.tsx`
- Create: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Create `app/_layout.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

function useAuthRedirect(session: Session | null | undefined, onboardingComplete: boolean | null) {
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (session === undefined || onboardingComplete === null) return // still loading

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && !onboardingComplete && segments[1] !== 'onboarding') {
      router.replace('/(app)/onboarding')
    } else if (session && onboardingComplete && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [session, onboardingComplete, segments])
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session) fetchOnboarding(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session) fetchOnboarding(session.user.id)
      else setOnboardingComplete(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchOnboarding(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', userId)
      .single()
    setOnboardingComplete(data?.onboarding_complete ?? false)
  }

  useAuthRedirect(session, onboardingComplete)

  if (session === undefined) return null // loading — show nothing (Expo splash screen handles this)

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  )
}
```

- [ ] **Step 2: Create `app/(app)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
```

- [ ] **Step 3: Create `app/(app)/onboarding.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState<'location' | 'done'>('location')
  const [city, setCity] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Denied', 'Please enter your city manually.'); return }
    const loc = await Location.getCurrentPositionAsync({})
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude })
  }

  async function handleFinish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const update: Record<string, unknown> = { onboarding_complete: true }

    if (coords) {
      update.location_lat = coords.lat
      update.location_lng = coords.lng
    } else if (city.trim()) {
      try {
        const { apiPost } = await import('@/lib/api')
        const { lat, lng } = await apiPost<{ lat: number; lng: number }>(
          '/api/location/geocode',
          { city: city.trim() }
        )
        update.location_lat = lat
        update.location_lng = lng
      } catch {
        // Proceed without coordinates — weather will prompt again on first use
      }
    }

    const { error } = await supabase.from('users').update(update).eq('id', user.id)
    if (error) { Alert.alert('Error', error.message); setLoading(false); return }
    router.replace('/(app)')
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Step {step === 'location' ? '1' : '2'} of 2
        </Text>
        <Text className="mt-1 text-3xl font-bold text-gray-900">
          {step === 'location' ? 'Where are you?' : 'Almost done'}
        </Text>
        <Text className="mt-2 text-sm text-gray-500">
          {step === 'location'
            ? 'We use your location for weather-based outfit suggestions.'
            : 'Your wardrobe is ready to explore.'}
        </Text>

        {step === 'location' && (
          <View className="mt-8 gap-4">
            {coords ? (
              <Text className="text-sm text-green-600 font-medium">✓ Location captured</Text>
            ) : (
              <>
                <TouchableOpacity onPress={requestLocation}
                  className="border border-gray-300 rounded-xl py-3.5 items-center">
                  <Text className="text-sm font-medium text-gray-700">Use current location</Text>
                </TouchableOpacity>
                <Text className="text-center text-xs text-gray-400">or</Text>
                <TextInput value={city} onChangeText={setCity}
                  placeholder="Enter your city (e.g. Madrid)"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-sm" />
              </>
            )}
            <TouchableOpacity onPress={() => setStep('done')}
              className="bg-gray-900 rounded-xl py-3.5 items-center mt-2">
              <Text className="text-white font-semibold text-sm">Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'done' && (
          <View className="mt-8">
            <TouchableOpacity onPress={handleFinish} disabled={loading}
              className="bg-gray-900 rounded-xl py-3.5 items-center">
              <Text className="text-white font-semibold text-sm">
                {loading ? 'Setting up…' : 'Enter my wardrobe'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 4: Create `app/(app)/index.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

export default function DashboardScreen() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('name').eq('id', user.id).single()
        .then(({ data }) => setName(data?.name ?? null))
    })
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-gray-900">
          Good morning{name ? `, ${name}` : ''}.
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          Your wardrobe is ready. Start by adding your first item.
        </Text>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-400 text-center">
            Clothing inventory coming in Plan 2.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 5: Smoke-test mobile auth flow**

```bash
cd apps/mobile && pnpm ios
```
Verify in iOS simulator:
1. App opens → redirects to login screen
2. Sign up → redirects to onboarding
3. Grant location or enter city → tap "Enter my wardrobe" → reaches dashboard
4. Force-quit and reopen → stays authenticated on dashboard tab

- [ ] **Step 6: Run all tests**

```bash
cd ../.. && pnpm test
```
Expected: all tests in `packages/core` (10) and `apps/web` (8) pass.

- [ ] **Step 7: Final commit**

```bash
git add apps/mobile/app
git commit -m "feat(mobile): add root auth layout, protected navigation, onboarding, and dashboard stub"
```

---

## Plan 1 Complete ✓

**What was built:**
- Turborepo monorepo with pnpm workspaces and shared `packages/`
- `@wardrobe-os/types` — all shared TypeScript types
- `@wardrobe-os/db` — Supabase client factories for web, server, and mobile
- `@wardrobe-os/core` — `getDefaultMaxWears` with 10 unit tests
- Supabase `users` table with RLS and auto-profile trigger
- Next.js 15 web app: login, signup, middleware auth guard, onboarding, dashboard stub (8 unit tests)
- Expo mobile app: login, signup, auth state listener, onboarding, dashboard stub

**All tests passing:** 18 total (10 core + 8 web redirect logic)

**Next:** Plan 2 — Wardrobe Inventory (clothing items CRUD, image upload, state machine, laundry management)
