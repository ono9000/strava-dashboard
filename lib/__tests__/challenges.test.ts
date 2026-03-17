import { MILESTONES, getCurrentChallenge } from '../challenges'

describe('MILESTONES', () => {
  it('is sorted by distance ascending', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].km).toBeGreaterThan(MILESTONES[i - 1].km)
    }
  })

  it('has Madrid → Moscú as final milestone at 4900 km', () => {
    const last = MILESTONES[MILESTONES.length - 1]
    expect(last.destination).toBe('Moscú')
    expect(last.km).toBe(4900)
  })
})

describe('getCurrentChallenge', () => {
  it('returns first milestone when user has 0 km', () => {
    const result = getCurrentChallenge(0)
    expect(result.current.destination).toBe('Segovia')
    expect(result.progress).toBe(0)
    expect(result.completed).toHaveLength(0)
    expect(result.allCompleted).toBe(false)
  })

  it('marks milestone as completed when user exactly meets the distance', () => {
    const result = getCurrentChallenge(88)
    expect(result.completed).toHaveLength(1)
    expect(result.completed[0].destination).toBe('Segovia')
    expect(result.current.destination).toBe('Valencia')
  })

  it('computes correct progress within current segment', () => {
    // Between Segovia (88) and Valencia (356): range = 268 km
    // User at 200 km: (200 - 88) / (356 - 88) = 112 / 268 ≈ 0.418
    const result = getCurrentChallenge(200)
    expect(result.progress).toBeCloseTo(0.418, 2)
    expect(result.remainingKm).toBeCloseTo(156, 0)
  })

  it('returns allCompleted=true when user exceeds final milestone', () => {
    const result = getCurrentChallenge(5000)
    expect(result.allCompleted).toBe(true)
    expect(result.laps).toBeCloseTo(5000 / 4900, 1)
  })
})
