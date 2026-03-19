# Wardrobe OS — MVP Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Phase:** 1 — Core Loop (Inventory + Outfit Recommendation + Usage Tracking)

---

## 1. Product Summary

Wardrobe OS is a personal wardrobe intelligence system that helps users manage their clothing, get context-aware outfit recommendations, and track clothing usage over time. It behaves less like a static closet catalog and more like a living model of the user's wardrobe — where items change state, get worn, get washed, and influence future recommendations.

The MVP answers three questions:
- What do I own and what is currently available?
- What should I wear today, given my context?
- What did I wear and what needs washing?

---

## 2. Scope

### Phase 1 (MVP — this spec)
- Wardrobe inventory management
- Clothing state and availability tracking (user-controlled)
- LLM-powered outfit generation with context awareness
- Usage tracking and outfit confirmation
- Laundry management view

### Phase 2 (future)
- Wardrobe intelligence and optimization insights
- Versatility and underuse analysis
- Combination space estimation

### Phase 3 (future)
- Strategic purchase guidance
- Travel and packing intelligence
- Outfit planning ahead

### Out of scope for MVP
- URL/receipt import for clothing items (Phase 2)
- Offline support (no offline-first architecture in Phase 1)
- Social features, push notifications, billing

---

## 3. Platform

- **Web:** Next.js 15 (App Router) — desktop-first, responsive
- **Mobile:** Expo (React Native) — iOS and Android
- **Architecture:** Turborepo monorepo, shared business logic across platforms

---

## 4. Repository Structure

```
wardrobe-os/
├── apps/
│   ├── web/              # Next.js 15 (App Router)
│   └── mobile/           # Expo (React Native)
├── packages/
│   ├── db/               # Prisma schema, Supabase client, migrations
│   ├── ai/               # LLM abstraction layer (Gemini 2.0 Flash)
│   ├── core/             # Business logic: state machine, outfit engine, scoring
│   ├── types/            # Shared TypeScript types
│   └── ui/               # Shared component primitives (NativeWind + Tailwind)
```

**Data access pattern:**

- Both web and mobile use the Supabase JS client (`packages/db/`) for all direct database reads and writes. The Supabase **anon key** is used — this key is safe to embed in client apps by design (it is public). Row-Level Security is the enforcement layer; the anon key alone grants no access to data without a valid user session.
- Operations requiring server-side secrets (Gemini API key, OpenWeatherMap API key) are proxied through **Next.js API routes**. Both web and mobile call these routes over HTTPS, authenticated via the user's Supabase JWT in the `Authorization: Bearer <token>` header. The API route validates the JWT before executing.
- All other business logic (state machine, filtering, wear counter math) lives in `packages/core/` and runs client-side on both platforms.

**API base URL configuration:**
The mobile app reads the API base URL from `EXPO_PUBLIC_API_URL`:

| Environment | Value |
|---|---|
| Local dev (Android emulator) | `http://10.0.2.2:3000` |
| Local dev (iOS sim / physical device) | `http://<LAN_IP>:3000` |
| Staging / production | `https://your-domain.com` |

Set in `apps/mobile/.env.local`, injected at build time.

---

## 5. Infrastructure

| Concern | Solution |
|---|---|
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email + OAuth) |
| File storage | Supabase Storage (private bucket, signed URLs, 10MB file size limit configured in bucket settings) |
| LLM + weather API proxy | Next.js API routes (web & mobile client) |
| LLM model | Gemini 2.0 Flash via Google AI SDK |
| Weather | OpenWeatherMap free tier (fetched server-side, 6-hour TTL cache) |
| Styling | Tailwind CSS (web), NativeWind (mobile) |

---

## 6. Authentication & User Profile

### Supabase `auth.users` vs. profile table
Supabase Auth manages `auth.users` internally. The `users` table in this spec is a **profile table** that extends `auth.users`. Its `id` is a foreign key to `auth.users.id` and equals `auth.uid()` in all RLS policies.

A database trigger creates the profile row on first sign-up:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

For Google OAuth, `full_name` is populated from metadata. For email/password signups, the username portion of the email is used as the initial name. Users can update their name in profile settings at any time.

### Sign-up / sign-in
- Email + password and Google OAuth via Supabase Auth
- Web: session in HTTP-only cookies via `@supabase/ssr`
- Mobile: session in `expo-secure-store` (never AsyncStorage for tokens)

### JWT handling on mobile
- Supabase client fires `onAuthStateChange` on token refresh; the app registers a listener that updates the in-memory token for subsequent Next.js API route calls — preventing stale-token 401 errors.
- Current access token sent as `Authorization: Bearer <token>` on all API route calls.

### JWT validation in API routes
```typescript
const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  headers: { Authorization: request.headers.get('Authorization') }
})
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

### Row-Level Security (RLS)

**`users` table:**
```sql
CREATE POLICY "users can only access their own profile"
ON users FOR ALL USING (auth.uid() = id);
```

**Tables with `user_id`** (`clothing_items`, `outfits`, `user_wear_events`):
```sql
CREATE POLICY "users can only access their own rows"
ON <table> FOR ALL USING (auth.uid() = user_id);
```

**`outfit_items`** (no `user_id` — joined through `outfits`):
```sql
CREATE POLICY "users can only access their own outfit items"
ON outfit_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM outfits
    WHERE outfits.id = outfit_items.outfit_id
    AND outfits.user_id = auth.uid()
  )
);
```

---

## 7. Onboarding & Location

New users complete a brief onboarding flow after first sign-in:
1. **Name** — pre-filled from trigger (editable)
2. **Location** — app requests geolocation permission
   - If granted: coordinates saved to `users.location_lat` / `users.location_lng`
   - If denied: user enters their city manually; coordinates resolved server-side via OpenWeatherMap geocoding and saved to profile
3. **Style preferences** — optional quick-select (casual / smart casual / formal lean, preferred colors)

Until onboarding is complete, outfit generation is disabled. The weather manual picker (described in Section 11) covers API failures only — not missing coordinates. Coordinates are required for weather to work.

---

## 8. Data Model

### `users`
```
id                  uuid PK  (= auth.users.id)
email               text unique
name                text NOT NULL
avatar_url          text
style_preferences   jsonb
location_lat        float
location_lng        float
weather_cache       jsonb       -- { temp, feels_like, condition, rain_probability, cached_at }
onboarding_complete bool NOT NULL DEFAULT false
created_at          timestamp
```

### `clothing_items`
```
id                      uuid PK
user_id                 uuid FK → users
name                    text
category                text
subcategory             text
color_primary           text
color_secondary         text
pattern                 text
material                text
formality               int (1–5)
warmth_level            int (1–5)
style_tags              text[]
season                  text[]
image_path              text
max_wears_before_wash   int NOT NULL DEFAULT 1
current_wear_count      int NOT NULL DEFAULT 0
state                   text NOT NULL DEFAULT 'available'
last_worn_at            timestamp
total_wears             int NOT NULL DEFAULT 0
ai_detected             bool NOT NULL DEFAULT false
created_at              timestamp
```

### `outfits`
```
id                  uuid PK
user_id             uuid FK → users
occasion            text
weather_context     jsonb
ai_explanation      text
score               float       -- 0.0–1.0 or null; stored for Phase 2 analytics; used for initial display ordering in Phase 1
confirmed           bool NOT NULL DEFAULT false
worn_at             timestamp
created_at          timestamp
```

### `outfit_items`
```
outfit_id           uuid FK → outfits
clothing_item_id    uuid FK → clothing_items
role                text CHECK (role IN ('top','bottom','shoes','outer','accessory'))
PRIMARY KEY (outfit_id, clothing_item_id)
```

### `user_wear_events`
```
id                  uuid PK
user_id             uuid FK → users
clothing_item_id    uuid FK → clothing_items
outfit_id           uuid nullable FK → outfits
worn_at             timestamp
```

---

## 9. Clothing State Machine

All state transitions are **user-triggered**. The system never auto-moves items between states.

```
available ──[user marks dirty]──────────→ dirty
    │                                        │
    │                             [user marks washing]
    │                                        ↓
    │                                     washing
    │                                        │
    │                   [user marks clean → current_wear_count resets to 0]
    │                                        │
    └────────────────────────────────────────┘
    │
    ├──[user stores seasonally]──→ stored ──[user retrieves]──→ available
    │
    └──[user archives]──────────→ archived ──[user re-activates]──→ available
```

**`current_wear_count` lifecycle:**
- **Increments by 1** immediately on outfit confirmation (before the laundry nudge)
- **Resets to 0** when the user transitions `washing → available`
- There is no `dirty → available` shortcut; items must pass through `washing`
- `total_wears` increments alongside `current_wear_count` on every confirmation and never resets

**`max_wears_before_wash` — soft hint model:**
This field is a soft hint to the user and the LLM, not a hard gate. It does not trigger automatic state changes. When `current_wear_count` reaches `max_wears_before_wash`, the app surfaces a visible reminder on the item card (e.g., "Time to wash?") and the LLM receives the wear count in context and may deprioritize the item. The user is always in control — they may continue using the item without washing. This is consistent with the product philosophy that the user controls all state.

**`max_wears_before_wash` defaults** enforced in `packages/core` via `getDefaultMaxWears(category: string): number`. Called at item creation. Database column has `DEFAULT 1` as fallback for direct inserts.

| Category | Default |
|---|---|
| T-shirt, shirt, blouse | 1 |
| Polo | 2 |
| Jeans | 3 |
| Sweater | 4 |
| Jacket, coat | 8 |
| Shoes, accessories | N/A |

**Outfit engine visibility:** Only `available` items appear in recommendations.

**Archived items:** Re-activatable from item detail view (`archived → available`).

---

## 10. Image Storage

Photos stored in a **private Supabase Storage bucket** named `clothing-images`. The `clothing_items.image_path` column stores a relative path (`{user_id}/{item_id}.jpg`), never a full URL. Signed URLs (1-hour expiry) are generated at display time and never persisted.

Supabase bucket is configured with a **10MB file size limit** in dashboard settings. MIME type validation is client-side only (jpg/png/webp); this is an accepted risk for MVP — arbitrary file types beyond the client path are a low-severity concern at this scale.

**Storage RLS policy** (in `packages/db/migrations`):
```sql
CREATE POLICY "users can manage their own images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'clothing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 11. LLM Integration Layer

### Provider Interface (`packages/ai/src/provider.ts`)
```typescript
interface LLMProvider {
  detectClothing(imageBase64: string): Promise<ClothingDetectionResult>
  generateOutfit(context: OutfitContext): Promise<OutfitRecommendation[]>
}
```

Both methods called only from Next.js API routes.

### Use Case 1 — Photo Clothing Detection (`/api/ai/detect-clothing`)
Gemini returns: category, subcategory, primary color, secondary color, pattern, material, formality (1–5), warmth level (1–5), style tags. Attributes pre-fill the item form. User reviews before saving.

### Use Case 2 — Outfit Generation (`/api/ai/generate-outfit`)

**Item selection (capped to 60 total):**
1. Never-worn items (`total_wears = 0`): up to 20 slots, ordered by `created_at ASC` (oldest first; alphabetical as tiebreaker)
2. Remaining slots (up to 40): most recently worn available items by `last_worn_at DESC` (ties broken by `created_at ASC`)

**Context sent to Gemini:** selected items (compact JSON), last 14 days of wear history (capped at 30 entries), weather cache, occasion, style preferences.

**Response:** up to 3 ranked outfits, each with item ID array, explanation, confidence score (0.0–1.0).

**Server-side validation:**
- All returned item IDs checked against the available items sent in the same request; invalid outfits discarded
- `outfit_items.role` values validated against the allowed set (`top`, `bottom`, `shoes`, `outer`, `accessory`); outfits with invalid roles discarded
- Score clamped to [0.0, 1.0]; if null/unparseable → stored as `null`, ranked last
- 0 valid outfits → "no valid outfits" error; 1–2 valid outfits → partial success, shown as-is

### Outfit swap

Swapping happens **client-side in memory only** before confirmation. Replacement items must have state `available` — validated client-side from the locally loaded wardrobe data. The swap does not trigger a new API call to Gemini. On confirmation, the final item set (original + swaps) is sent to the server, which re-validates all item IDs for availability before persisting. The `outfits` row is created only on confirmation — nothing is written to the database during the swap phase.

Only **final confirmed items** receive wear events and counter increments. Swapped-out items receive nothing.

### Cost control
- LLM calls triggered only by explicit user actions
- Items capped at 60, history at 30 entries
- Estimated: < $0.05 per user per month at typical usage

---

## 12. Weather

Fetched **server-side** via `/api/weather/refresh` (OpenWeatherMap, key never exposed to client). Result stored in `users.weather_cache` (6-hour TTL).

**Failure fallback:** If API unreachable and no cache → manual picker (temperature + condition). Requires `users.location_lat` / `users.location_lng` to be set (guaranteed by onboarding). Weather is optional context — outfit generation works without it.

---

## 13. Core User Flows

### Flow 1 — Onboarding
1. First sign-in → onboarding screen
2. Confirm/edit name
3. Grant location or enter city manually
4. Optional style preferences
5. `users.onboarding_complete` set to `true`

### Flow 2 — Add a clothing item
1. Tap "Add item" → choose photo or manual
2. **Photo:** image → `/api/ai/detect-clothing` → pre-filled form → user confirms
3. **Manual:** user fills all fields
4. `max_wears_before_wash` set from `getDefaultMaxWears(category)` at creation
5. Item saved: `state = available`, `current_wear_count = 0`

### Flow 3 — Get today's outfit
1. Dashboard shows weather (refreshed if stale via `/api/weather/refresh`)
2. Tap "Suggest outfit" → select occasion
3. Client calls `/api/ai/generate-outfit` → server validates, calls Gemini, validates output
4. Up to 3 valid options shown, ordered by score descending (null last)
5. User picks one, optionally swaps pieces (client-side state only, replacement must be `available`)
6. User taps confirm → server re-validates final item set → outfit saved

### Flow 4 — Confirm a wear
1. `outfits` row created (`confirmed = true`, `worn_at = now`)
2. `outfit_items` rows created for final items only
3. `user_wear_events` rows created for final items only
4. For each final item: `current_wear_count += 1`, `total_wears += 1`, `last_worn_at = now`
5. If `current_wear_count >= max_wears_before_wash` → item card shows "Time to wash?" reminder
6. App nudges: *"Anything going in the wash?"*
7. User optionally marks items dirty → `state = dirty`

### Flow 5 — Manage laundry
1. Laundry view shows all `dirty` and `washing` items
2. User moves: `dirty → washing` or `washing → available` (resets `current_wear_count`)

### Flow 6 — Browse wardrobe
1. Grid/list view filterable by category, state, color, occasion, season
2. Item detail: wear history, state, AI attributes, signed image, actions (edit, change state, archive, re-activate)

---

## 14. Error Handling

| Failure | Behavior |
|---|---|
| Gemini Vision fails | Form opens empty for manual entry |
| Outfit generation fails | Error shown, retry button |
| 0 valid outfits after validation | "No valid outfits found" with retry |
| 1–2 valid outfits | Show available options (partial success) |
| LLM role value invalid | Outfit discarded server-side |
| LLM score null/invalid | Stored as `null`, ranked last |
| Weather API fails + cache exists | Use cached weather |
| Weather API fails + no cache | Manual picker shown |
| Supabase unavailable | Error surfaced; no optimistic writes |
| Image upload fails | Client-side pre-validation (≤ 10MB, jpg/png/webp); error shown |

---

## 15. Testing Strategy

| Layer | Approach |
|---|---|
| `packages/core` | Unit tests — state machine, `getDefaultMaxWears`, wear counter, outfit item selection |
| API routes | Integration tests against a dedicated test Supabase project with seeded data |
| LLM calls | AI provider mocked in all tests; no real Gemini calls in CI |
| LLM quality | Manual eval prompts run periodically outside CI |
| Web E2E | Playwright — onboarding, add item, get outfit, confirm wear |
| Mobile E2E | Maestro — same critical flows on iOS simulator |

---

## 16. Out of Scope for Phase 1

- URL/receipt import for clothing items
- Offline-first / local-first architecture
- Wardrobe optimization insights (versatility, underuse, rotation quality)
- Combination space estimation
- Strategic purchase guidance
- Outfit planning ahead
- Travel and packing intelligence
- Social features
- Push notifications
- Subscription / billing
