import { describe, it, expect } from 'vitest'
import { getDefaultMaxWears } from '../defaults'

describe('getDefaultMaxWears', () => {
  it('returns 1 for t-shirt', () => expect(getDefaultMaxWears('t-shirt')).toBe(1))
  it('returns 1 for shirt', () => expect(getDefaultMaxWears('shirt')).toBe(1))
  it('returns 1 for blouse', () => expect(getDefaultMaxWears('blouse')).toBe(1))
  it('returns 2 for polo', () => expect(getDefaultMaxWears('polo')).toBe(2))
  it('returns 3 for jeans', () => expect(getDefaultMaxWears('jeans')).toBe(3))
  it('returns 4 for sweater', () => expect(getDefaultMaxWears('sweater')).toBe(4))
  it('returns 8 for jacket', () => expect(getDefaultMaxWears('jacket')).toBe(8))
  it('returns 8 for coat', () => expect(getDefaultMaxWears('coat')).toBe(8))
  it('returns 1 for unknown category (safe default)', () => {
    expect(getDefaultMaxWears('unknown-category')).toBe(1)
  })
  it('is case-insensitive', () => {
    expect(getDefaultMaxWears('T-Shirt')).toBe(1)
    expect(getDefaultMaxWears('JACKET')).toBe(8)
  })
})
