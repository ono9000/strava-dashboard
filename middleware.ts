import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { StravaSession, StravaTokenResponse } from '@/types/strava'

const COOKIE_NAME = 'strava_session'
const TOKEN_URL = 'https://www.strava.com/oauth/token'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME)

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let session: StravaSession
  try {
    const parsed = JSON.parse(sessionCookie.value)
    // Validate required fields — guard against malformed-but-valid-JSON cookies
    if (
      typeof parsed?.access_token !== 'string' ||
      typeof parsed?.refresh_token !== 'string' ||
      typeof parsed?.expires_at !== 'number' ||
      typeof parsed?.athlete_id !== 'number'
    ) {
      throw new Error('Invalid session shape')
    }
    session = parsed as StravaSession
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url))
    res.cookies.delete(COOKIE_NAME) // COOKIE_NAME = 'strava_session'
    return res
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (session.expires_at > nowSec) {
    return NextResponse.next()
  }

  // Token expired — attempt refresh
  try {
    const refreshRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.refresh_token,
      }),
    })

    if (!refreshRes.ok) throw new Error('Refresh failed')

    const data = (await refreshRes.json()) as StravaTokenResponse
    const updatedSession: StravaSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: session.athlete_id,
    }

    const response = NextResponse.next()
    response.cookies.set(COOKIE_NAME, JSON.stringify(updatedSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url))
    res.cookies.delete(COOKIE_NAME) // COOKIE_NAME = 'strava_session'
    return res
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
