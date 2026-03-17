// Strava API response types — matches Strava v3 API

export interface StravaAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string          // URL to profile photo (large size)
  city: string | null
  country: string | null
  created_at: string       // ISO8601 date
}

export interface StravaActivityTotals {
  count: number
  distance: number         // meters
  moving_time: number      // seconds
  elapsed_time: number     // seconds
  elevation_gain: number   // meters
}

export interface StravaStats {
  all_run_totals: StravaActivityTotals
  ytd_run_totals: StravaActivityTotals
  recent_run_totals: StravaActivityTotals
  biggest_ride_distance: number
  biggest_climb_elevation_gain: number
}

export interface StravaSummaryActivity {
  id: number
  name: string
  distance: number         // meters
  moving_time: number      // seconds
  elapsed_time: number     // seconds
  total_elevation_gain: number  // meters
  sport_type: string       // 'Run', 'Ride', 'Walk', etc.
  start_date: string       // UTC ISO8601
  start_date_local: string // Local timezone ISO8601
  athlete_count?: number  // number of athletes in the activity; >1 means group run
  map: {
    summary_polyline: string   // Google Encoded Polyline; empty string if private/no GPS
  } | null
}

// Session data stored in the httpOnly cookie
export interface StravaSession {
  access_token: string
  refresh_token: string
  expires_at: number       // Unix timestamp in seconds
  athlete_id: number
}

// Strava token endpoint response (exchange + refresh)
export interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: StravaAthlete
}

export interface SummaryAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string  // photo URL
}
