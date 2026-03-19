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
  formality: 1 | 2 | 3 | 4 | 5
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
  formality: 1 | 2 | 3 | 4 | 5
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
    'id' | 'category' | 'color_primary' | 'formality' | 'style_tags' | 'warmth_level' | 'total_wears' | 'last_worn_at' | 'season'
  >[]
  occasion: Occasion
  weather: WeatherCache | null
  wear_history: Array<{ worn_at: string; occasion: Occasion | null; item_ids: string[] }>
  style_preferences: StylePreferences | null
}
