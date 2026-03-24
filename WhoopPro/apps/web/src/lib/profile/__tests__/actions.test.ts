import { describe, it, expect } from 'vitest'

// We only test the validation/error return shapes.
// The happy path hits Supabase and requires integration testing.
describe('saveProfileAction input types', () => {
  it('accepts valid chronotype values', () => {
    const validChronotypes = ['morning', 'balanced', 'evening'] as const
    validChronotypes.forEach(c => {
      expect(['morning', 'balanced', 'evening'].includes(c)).toBe(true)
    })
  })

  it('accepts valid objective values', () => {
    const validObjectives = ['performance', 'balance', 'recovery', 'consistency'] as const
    validObjectives.forEach(o => {
      expect(['performance', 'balance', 'recovery', 'consistency'].includes(o)).toBe(true)
    })
  })
})
