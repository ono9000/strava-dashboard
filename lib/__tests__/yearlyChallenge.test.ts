import { getYearlyChallenge } from '../yearlyChallenge'

describe('getYearlyChallenge', () => {
  it('returns progress=0 and next=100 at 0 km', () => {
    const result = getYearlyChallenge(0)
    expect(result.progress).toBe(0)
    expect(result.nextMilestone).toBe(100)
    expect(result.prevMilestone).toBe(0)
    expect(result.allCompleted).toBe(false)
  })

  it('computes correct progress mid-segment', () => {
    const result = getYearlyChallenge(175)
    expect(result.progress).toBeCloseTo(0.5, 2)
    expect(result.nextMilestone).toBe(250)
    expect(result.prevMilestone).toBe(100)
  })

  it('advances to next milestone when exactly at boundary', () => {
    const result = getYearlyChallenge(100)
    expect(result.prevMilestone).toBe(100)
    expect(result.nextMilestone).toBe(250)
    expect(result.progress).toBe(0)
  })

  it('returns allCompleted=true at 3000+ km', () => {
    const result = getYearlyChallenge(3000)
    expect(result.allCompleted).toBe(true)
    expect(result.progress).toBe(1)
  })

  it('clamps progress to 1 above max milestone', () => {
    const result = getYearlyChallenge(5000)
    expect(result.allCompleted).toBe(true)
    expect(result.progress).toBe(1)
  })
})
