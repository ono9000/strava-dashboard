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

The web and mobile apps contain only presentation logic. All business logic, AI calls, and data access live in `packages/` and are shared.

---

## 5. Infrastructure

| Concern | Solution |
|---|---|
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email + OAuth) |
| File storage | Supabase Storage (clothing photos) |
| API layer | Next.js API routes (consumed by web and mobile) |
| LLM | Gemini 2.0 Flash via Google AI SDK |
| Weather | OpenWeatherMap free tier (cached per user per day) |
| Styling | Tailwind CSS (web), NativeWind (mobile) |

---

## 6. Data Model

### `users`
```
id                  uuid PK
email               text unique
name                text
avatar_url          text
style_preferences   jsonb       -- color preferences, formality lean, style tags
location_lat        float
location_lng        float
created_at          timestamp
```

### `clothing_items`
```
id                      uuid PK
user_id                 uuid FK → users
name                    text
category                text        -- t-shirt | shirt | jeans | jacket | shoes | ...
subcategory             text
color_primary           text
color_secondary         text
pattern                 text        -- solid | striped | checked | ...
material                text
formality               int (1–5)   -- 1 casual → 5 formal
warmth_level            int (1–5)
style_tags              text[]      -- ["casual", "minimal", "streetwear"]
season                  text[]      -- ["spring", "summer", "autumn", "winter"]
image_url               text
max_wears_before_wash   int         -- user-overridable, defaults by category
current_wear_count      int         -- resets on user-confirmed wash
state                   text        -- available | dirty | washing | stored | archived
last_worn_at            timestamp
total_wears             int         -- lifetime counter, never resets
ai_detected             bool        -- true if attributes were filled by vision AI
created_at              timestamp
```

### `outfits`
```
id                  uuid PK
user_id             uuid FK → users
occasion            text        -- casual | office | dinner | sport | event | ...
weather_context     jsonb       -- { temp, feels_like, condition, rain_probability }
ai_explanation      text        -- why this outfit was recommended
score               float       -- LLM-assigned confidence score
confirmed           bool        -- user confirmed they actually wore this
worn_at             timestamp
created_at          timestamp
```

### `outfit_items`
```
outfit_id           uuid FK → outfits
clothing_item_id    uuid FK → clothing_items
role                text        -- top | bottom | shoes | outer | accessory
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

## 7. Clothing State Machine

All state transitions are **user-triggered**. The system never auto-moves items between states.

```
available ──[user confirms outfit]──→ wear count incremented
    │                                         │
    │                              [user marks dirty]
    │                                         ↓
    │                                       dirty
    │                                         │
    │                              [user marks washing]
    │                                         ↓
    │                                      washing
    │                                         │
    │                               [user marks clean]
    │                                         ↓
    └─────────────────────────────────────available
    │
    ├──[user stores seasonally]──→ stored
    │
    └──[user archives]──────────→ archived
```

**Category defaults for `max_wears_before_wash`:**

| Category | Default |
|---|---|
| T-shirt, shirt, blouse | 1 |
| Polo | 2 |
| Jeans | 3 |
| Sweater | 4 |
| Jacket, coat | 8 |
| Shoes, accessories | N/A (user manages manually) |

These defaults are suggestions only. The user can override per item.

After confirming an outfit, the app presents a nudge: *"Anything going in the wash?"* — but no state changes unless the user acts.

**Outfit engine visibility:** Only items with state `available` are considered for recommendations. Dirty, washing, stored, and archived items are excluded.

---

## 8. LLM Integration Layer

### Provider Interface (`packages/ai/src/provider.ts`)
```typescript
interface LLMProvider {
  detectClothing(imageBase64: string): Promise<ClothingDetectionResult>
  generateOutfit(context: OutfitContext): Promise<OutfitRecommendation[]>
  explainOutfit(outfit: Outfit, context: OutfitContext): Promise<string>
  learnFromHistory(history: WearHistory[]): Promise<StyleInsights>
}
```

`GeminiProvider` is the concrete implementation. The interface allows swapping to any other model without touching app code.

### Use Case 1 — Photo Clothing Detection
- User uploads a photo of a clothing item
- Image sent to Gemini 2.0 Flash Vision
- Gemini returns: category, subcategory, primary color, secondary color, pattern, material estimate, formality estimate, style tags
- Attributes pre-fill the clothing item form
- User reviews and corrects before saving
- `ai_detected` flag set to `true`

### Use Case 2 — Outfit Generation
Context sent to Gemini per request:
- Available items (compact JSON: id, category, color, formality, style_tags, warmth_level)
- Weather: temperature, condition, rain probability
- Occasion: user-selected
- Wear history: last 14 days of confirmed outfits
- Style preferences from user profile

Gemini returns 3 ranked outfit options, each with:
- Array of item IDs (one per role)
- Short explanation (1–2 sentences)
- Confidence score (0–1)

### Use Case 3 — Personalization Loop
Every confirmed wear event is stored. As history grows, the LLM receives richer context — which combinations the user actually wore, which occasions they dress for most, which pieces they keep skipping. No fine-tuning required. Context-window personalization only.

### Cost Control
- LLM calls triggered only by explicit user actions (photo upload, outfit request)
- No background polling or scheduled AI jobs
- Item lists passed as compact JSON, not prose descriptions
- Weather and history are cached; only fresh data triggers new calls
- Estimated cost: < $0.05 per user per month at typical usage

---

## 9. Core User Flows

### Flow 1 — Add a clothing item
1. User taps "Add item"
2. Chooses entry method: photo, manual form, or URL/receipt import
3. **Photo path:** image → Gemini Vision → pre-filled form → user confirms
4. **Manual path:** user fills category, color, material, formality, style tags
5. Item saved with state `available`

### Flow 2 — Get today's outfit
1. User opens app → daily dashboard shows weather automatically
2. Taps "Suggest outfit" → selects occasion
3. App sends context to Gemini → returns 3 outfit options with explanations
4. User picks one, optionally swaps individual pieces
5. User confirms outfit

### Flow 3 — Confirm a wear
1. Outfit saved to history, wear events recorded for each item
2. App nudges: *"Anything going in the wash?"*
3. User optionally marks items as dirty
4. Wear counters update; `last_worn_at` updates

### Flow 4 — Manage laundry
1. Laundry view shows all `dirty` and `washing` items
2. User moves items through states manually
3. Items return to `available` and re-enter recommendations

### Flow 5 — Browse wardrobe
1. Grid or list view of all items
2. Filterable by category, state, color, occasion, season
3. Item detail shows wear history, current state, AI-detected attributes

---

## 10. Error Handling

| Failure | Behavior |
|---|---|
| Gemini Vision fails | Form opens empty for manual entry. User notified. |
| Outfit generation fails | Clear error message shown, retry button. App never hangs. |
| Weather API fails | Last cached weather used. If no cache, user sets conditions manually. |
| Supabase unavailable | Optimistic UI where possible. Offline state surfaced clearly. |
| Image upload fails | Client-side validation (size, format) before upload. Clear error on failure. |

---

## 11. Testing Strategy

| Layer | Approach |
|---|---|
| Business logic (`packages/core`) | Unit tests — state machine transitions, wear counter logic, outfit filtering. Pure functions. |
| API routes | Integration tests against test Supabase instance. |
| LLM calls | AI provider mocked in all tests. No real Gemini calls in CI. |
| LLM quality | Small set of manual eval prompts run periodically outside CI. |
| E2E | Playwright on web for critical flows: add item, get outfit, confirm wear. |

---

## 12. Out of Scope for Phase 1

- Wardrobe optimization insights (versatility, underuse, rotation quality)
- Combination space estimation
- Strategic purchase guidance
- Outfit planning ahead
- Travel and packing intelligence
- Social features
- Push notifications
- Subscription / billing
