import { NextResponse } from 'next/server'
import { DEFAULT_LANG, isLanguage, LANG_COOKIE } from '@/lib/i18n/types'

export async function POST(req: Request) {
  let lang = DEFAULT_LANG
  try {
    const body = (await req.json()) as { lang?: unknown }
    if (isLanguage(body.lang)) lang = body.lang
  } catch {
    // ignore malformed body
  }

  const res = new NextResponse(null, { status: 204 })
  res.cookies.set(LANG_COOKIE, lang, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}

