import { NextRequest, NextResponse } from 'next/server'
import type { StravaSession, StravaTokenResponse } from '@/types/strava'

const TOKEN_URL = 'https://www.strava.com/oauth/token'
const COOKIE_NAME = 'strava_session'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // User cancelled authorization
  if (searchParams.get('error')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const stateCookie = request.cookies.get('oauth_state')?.value

  // CSRF validation: state must be present and match
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`)
    }

    const data = (await tokenRes.json()) as StravaTokenResponse

    // Strava includes athlete on authorization_code exchange but not on refresh.
    // If absent here, the exchange itself failed or returned an unexpected payload.
    if (!data.athlete?.id) {
      throw new Error('No athlete in token response — redirect to /')
    }

    const session: StravaSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete.id,
    }

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set(COOKIE_NAME, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    response.cookies.delete('oauth_state')
    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
