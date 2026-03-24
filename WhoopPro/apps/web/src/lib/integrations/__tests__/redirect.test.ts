import { describe, it, expect } from 'vitest'
import { resolveCallbackDestination } from '@/lib/integrations/redirect'

describe('resolveCallbackDestination', () => {
  it('success + onboarding → /onboarding?connected=whoop', () => {
    expect(resolveCallbackDestination('success', 'onboarding', 'whoop'))
      .toBe('/onboarding?connected=whoop')
  })

  it('success + settings → /settings/integrations?connected=google', () => {
    expect(resolveCallbackDestination('success', 'settings', 'google'))
      .toBe('/settings/integrations?connected=google')
  })

  it('success + undefined returnTo → defaults to settings', () => {
    expect(resolveCallbackDestination('success', undefined, 'whoop'))
      .toBe('/settings/integrations?connected=whoop')
  })

  it('error + onboarding → /onboarding?error=connect_failed', () => {
    expect(resolveCallbackDestination('error', 'onboarding', 'whoop'))
      .toBe('/onboarding?error=connect_failed')
  })

  it('error + settings → /settings/integrations?error=connect_failed', () => {
    expect(resolveCallbackDestination('error', 'settings', 'whoop'))
      .toBe('/settings/integrations?error=connect_failed')
  })

  it('error + undefined returnTo → defaults to /settings/integrations', () => {
    expect(resolveCallbackDestination('error', undefined, 'whoop'))
      .toBe('/settings/integrations?error=connect_failed')
  })
})
