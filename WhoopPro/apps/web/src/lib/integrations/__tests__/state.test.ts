import { describe, it, expect } from 'vitest'
import {
  createOAuthStatePayload,
  encodeStatePayload,
  decodeStatePayload,
} from '@/lib/integrations/state'

describe('createOAuthStatePayload', () => {
  it('creates payload without returnTo', () => {
    const p = createOAuthStatePayload('whoop', 'user-123')
    expect(p.provider).toBe('whoop')
    expect(p.userId).toBe('user-123')
    expect(p.returnTo).toBeUndefined()
    expect(typeof p.state).toBe('string')
    expect(typeof p.issuedAt).toBe('number')
  })

  it('creates payload with returnTo=onboarding', () => {
    const p = createOAuthStatePayload('google', 'user-abc', 'onboarding')
    expect(p.returnTo).toBe('onboarding')
  })

  it('creates payload with returnTo=settings', () => {
    const p = createOAuthStatePayload('whoop', 'user-abc', 'settings')
    expect(p.returnTo).toBe('settings')
  })
})

describe('decodeStatePayload round-trip', () => {
  it('preserves returnTo=onboarding through encode/decode', () => {
    const payload = createOAuthStatePayload('whoop', 'user-1', 'onboarding')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.returnTo).toBe('onboarding')
  })

  it('preserves returnTo=settings through encode/decode', () => {
    const payload = createOAuthStatePayload('google', 'user-2', 'settings')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded!.returnTo).toBe('settings')
  })

  it('drops unknown returnTo values', () => {
    const payload = createOAuthStatePayload('whoop', 'user-3')
    const raw = { ...payload, returnTo: 'evil' }
    const encoded = Buffer.from(JSON.stringify(raw)).toString('base64url')
    const decoded = decodeStatePayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.returnTo).toBeUndefined()
  })

  it('returns null for missing value', () => {
    expect(decodeStatePayload(undefined)).toBeNull()
    expect(decodeStatePayload('')).toBeNull()
  })

  it('decodes payload without returnTo (backwards compat)', () => {
    const payload = createOAuthStatePayload('oura', 'user-4')
    const encoded = encodeStatePayload(payload)
    const decoded = decodeStatePayload(encoded)
    expect(decoded!.returnTo).toBeUndefined()
  })
})
