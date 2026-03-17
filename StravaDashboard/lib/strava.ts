import { cookies } from 'next/headers'
import type {
  StravaAthlete,
  StravaStats,
  StravaSummaryActivity,
  StravaSession,
} from '@/types/strava'

const BASE = 'https://www.strava.com/api/v3'
const COOKIE_NAME = 'strava_session'

export function getSession(): StravaSession | null {
  const cookie = cookies().get(COOKIE_NAME)
  if (!cookie?.value) return null
  try {
    const parsed = JSON.parse(cookie.value)
    // Validate required fields before trusting the cookie
    if (
      typeof parsed?.access_token !== 'string' ||
      typeof parsed?.refresh_token !== 'string' ||
      typeof parsed?.expires_at !== 'number' ||
      typeof parsed?.athlete_id !== 'number'
    ) {
      return null
    }
    return parsed as StravaSession
  } catch {
    return null
  }
}

export class StravaRateLimitError extends Error {
  constructor() {
    super('Strava rate limit exceeded')
    this.name = 'StravaRateLimitError'
  }
}

async function stravaFetch<T>(endpoint: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 }, // always fresh, no Next.js caching
  })

  if (res.status === 429) throw new StravaRateLimitError()
  if (!res.ok) throw new Error(`Strava API error: ${res.status} ${endpoint}`)

  return res.json() as Promise<T>
}

export async function getAthlete(token: string): Promise<StravaAthlete> {
  return stravaFetch<StravaAthlete>('/athlete', token)
}

export async function getAthleteStats(
  token: string,
  athleteId: number
): Promise<StravaStats> {
  return stravaFetch<StravaStats>(`/athletes/${athleteId}/stats`, token)
}

export async function getAllActivities(
  token: string
): Promise<StravaSummaryActivity[]> {
  const allActivities: StravaSummaryActivity[] = []
  const MAX_PAGES = 3

  for (let page = 1; page <= MAX_PAGES; page++) {
    const activities = await stravaFetch<StravaSummaryActivity[]>(
      `/athlete/activities?per_page=200&page=${page}`,
      token
    )
    allActivities.push(...activities)
    if (activities.length < 200) break
  }

  return allActivities
}
