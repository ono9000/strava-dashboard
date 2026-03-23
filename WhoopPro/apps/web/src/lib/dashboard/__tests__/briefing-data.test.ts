import { describe, it, expect } from 'vitest'
import { rowToBriefing, isBriefingStale } from '@/lib/dashboard/briefing-data'

const stubRow = {
  signal_date: '2026-03-23',
  day_mode: 'Strategic',
  synopsis: 'High-clarity day.',
  primary_recommendation: 'Protect the first window.',
  warning: 'Afternoon is vulnerable.',
  scores: {
    deepWorkReadiness: 80,
    meetingReadiness: 72,
    executionCapacity: 75,
    physicalReadiness: 68,
    recoveryProtection: 30,
  },
  windows: [],
  suggested_moves: ['Do the hard thing first.'],
  recalibration_triggers: ['Unexpected conflict.'],
  end_of_day_prompts: ['What worked?'],
}

describe('rowToBriefing', () => {
  it('maps snake_case DB row to camelCase DailyBriefing', () => {
    const briefing = rowToBriefing(stubRow)
    expect(briefing.dayMode).toBe('Strategic')
    expect(briefing.primaryRecommendation).toBe('Protect the first window.')
    expect(briefing.suggestedMoves).toEqual(['Do the hard thing first.'])
    expect(briefing.recalibrationTriggers).toEqual(['Unexpected conflict.'])
    expect(briefing.endOfDayPrompts).toEqual(['What worked?'])
    expect(briefing.scores.deepWorkReadiness).toBe(80)
  })
})

describe('isBriefingStale', () => {
  it('returns false when signal_date equals today', () => {
    expect(isBriefingStale('2026-03-23', '2026-03-23')).toBe(false)
  })

  it('returns true when signal_date is before today', () => {
    expect(isBriefingStale('2026-03-22', '2026-03-23')).toBe(true)
  })

  it('returns false when signal_date is today (same day, different check)', () => {
    expect(isBriefingStale('2026-03-23', '2026-03-23')).toBe(false)
  })
})
