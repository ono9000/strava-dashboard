import { describe, it, expect } from 'vitest'
import { getRedirectPath } from '../lib/auth/redirects'

describe('getRedirectPath', () => {
  it('redirects unauthenticated user from protected route to /login', () => {
    expect(getRedirectPath(false, false, '/dashboard')).toBe('/login')
  })

  it('does not redirect unauthenticated user on /login', () => {
    expect(getRedirectPath(false, false, '/login')).toBeNull()
  })

  it('does not redirect unauthenticated user on /signup', () => {
    expect(getRedirectPath(false, false, '/signup')).toBeNull()
  })

  it('redirects authenticated user without onboarding to /onboarding from any app route', () => {
    expect(getRedirectPath(true, false, '/dashboard')).toBe('/onboarding')
  })

  it('does not redirect authenticated user without onboarding if already on /onboarding', () => {
    expect(getRedirectPath(true, false, '/onboarding')).toBeNull()
  })

  it('redirects authenticated + onboarded user from /login to /dashboard', () => {
    expect(getRedirectPath(true, true, '/login')).toBe('/dashboard')
  })

  it('redirects authenticated + onboarded user from /signup to /dashboard', () => {
    expect(getRedirectPath(true, true, '/signup')).toBe('/dashboard')
  })

  it('does not redirect authenticated + onboarded user on a protected route', () => {
    expect(getRedirectPath(true, true, '/dashboard')).toBeNull()
    expect(getRedirectPath(true, true, '/wardrobe')).toBeNull()
  })

  it('redirects authenticated + onboarded user away from /onboarding to /dashboard', () => {
    expect(getRedirectPath(true, true, '/onboarding')).toBe('/dashboard')
  })
})
