import { NextResponse } from 'next/server'

export function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.STRAVA_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Strava configuration' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()

  const stravaUrl = new URL('https://www.strava.com/oauth/authorize')
  stravaUrl.searchParams.set('client_id', clientId)
  stravaUrl.searchParams.set('redirect_uri', redirectUri)
  stravaUrl.searchParams.set('response_type', 'code')
  stravaUrl.searchParams.set('approval_prompt', 'auto')
  // Note: searchParams.set() auto-URL-encodes the comma → %2C, which Strava accepts correctly
  stravaUrl.searchParams.set('scope', 'read,activity:read_all')
  stravaUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(stravaUrl.toString())
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })
  return response
}
