import { describe, it, expect, afterEach, vi } from 'vitest'

describe('resolveUserIdFromRequest - DEV_USER_ID guard', () => {
  afterEach(() => {
    delete process.env.DEV_USER_ID
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('throws when DEV_USER_ID is set outside development', async () => {
    vi.resetModules()
    process.env.DEV_USER_ID = 'some-user-id'
    vi.stubEnv('NODE_ENV', 'production')

    const { resolveUserIdFromRequest } = await import('@/lib/auth/request-user')
    const fakeReq = new Request('http://localhost/api/test') as any

    await expect(resolveUserIdFromRequest(fakeReq)).rejects.toThrow(
      'DEV_USER_ID must not be set outside local development'
    )
  })

  it('returns DEV_USER_ID when set in development', async () => {
    vi.resetModules()
    process.env.DEV_USER_ID = 'dev-user-id'
    vi.stubEnv('NODE_ENV', 'development')

    const { resolveUserIdFromRequest } = await import('@/lib/auth/request-user')
    const fakeReq = new Request('http://localhost/api/test') as any

    await expect(resolveUserIdFromRequest(fakeReq)).resolves.toBe('dev-user-id')
  })
})
