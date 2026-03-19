import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@wardrobe-os/db'
import { getRedirectPath } from '@/lib/auth/redirects'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  const supabase = createServerClient({
    getAll() {
      return request.cookies.getAll()
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value)
      )
      supabaseResponse = NextResponse.next({ request })
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options)
      )
    },
  })

  // IMPORTANT: Do not run any logic between createServerClient and supabase.auth.getUser()
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
    const redirectResponse = NextResponse.redirect(new URL(redirectTo, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
