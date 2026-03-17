import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
} from '../calculations'
import type { StravaSummaryActivity } from '@/types/strava'

const makeActivity = (
  overrides: Partial<StravaSummaryActivity>
): StravaSummaryActivity => ({
  id: 1,
  name: 'Test Run',
  distance: 5000,
  moving_time: 1500,
  elapsed_time: 1600,
  total_elevation_gain: 50,
  sport_type: 'Run',
  start_date: '2024-01-15T08:00:00Z',
  start_date_local: '2024-01-15T09:00:00+01:00',
  ...overrides,
})

describe('formatPace', () => {
  it('formats seconds and meters to min/km string', () => {
    // 1500s for 5000m = 300 s/km = 5'00"/km
    expect(formatPace(1500, 5000)).toBe("5'00\"/km")
  })

  it('returns — when distance is 0', () => {
    expect(formatPace(1000, 0)).toBe('—')
  })
})

describe('formatTime', () => {
  it('formats seconds to Xh Ym for times over 1 hour', () => {
    expect(formatTime(3661)).toBe('1h 1m')
  })

  it('formats minutes only for times under 1 hour', () => {
    expect(formatTime(1800)).toBe('30m')
  })
})

describe('formatElevation', () => {
  it('formats meters below 1000 as meters', () => {
    expect(formatElevation(850)).toBe('850 m')
  })

  it('formats 1000+ meters as km with 1 decimal', () => {
    expect(formatElevation(12500)).toBe('12.5 km')
  })
})

describe('getPrimarySport', () => {
  it('returns the most frequent sport_type', () => {
    const activities = [
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Ride' }),
    ]
    expect(getPrimarySport(activities)).toBe('Run')
  })

  it('returns — for empty array', () => {
    expect(getPrimarySport([])).toBe('—')
  })
})

describe('getBestForDistance', () => {
  it('finds activity with lowest moving_time in distance range', () => {
    const activities = [
      makeActivity({ id: 1, distance: 5050, moving_time: 1600 }),
      makeActivity({ id: 2, distance: 5010, moving_time: 1450 }),
      makeActivity({ id: 3, distance: 4700, moving_time: 1400 }), // outside range
    ]
    const best = getBestForDistance(activities, 4800, 5200)
    expect(best?.id).toBe(2)
  })

  it('returns null when no activity falls in range', () => {
    expect(getBestForDistance([], 4800, 5200)).toBeNull()
  })
})

describe('getBestWeek', () => {
  it('returns the ISO week with highest summed distance', () => {
    const activities = [
      // Week 3, 2024 (Jan 15): 5 km
      makeActivity({ id: 1, distance: 5000, start_date_local: '2024-01-15T09:00:00' }),
      // Week 3, 2024 (Jan 17): 6 km — same week total = 11 km
      makeActivity({ id: 2, distance: 6000, start_date_local: '2024-01-17T09:00:00' }),
      // Week 4, 2024 (Jan 22): 8 km
      makeActivity({ id: 3, distance: 8000, start_date_local: '2024-01-22T09:00:00' }),
    ]
    const best = getBestWeek(activities)
    expect(best.totalKm).toBeCloseTo(11, 1)
    expect(best.label).toContain('2024')
  })

  it('returns totalKm=0 for empty array', () => {
    expect(getBestWeek([]).totalKm).toBe(0)
  })
})

describe('getBestMonth', () => {
  it('returns the calendar month with highest summed distance', () => {
    const activities = [
      makeActivity({ id: 1, distance: 5000, start_date_local: '2024-01-15T09:00:00' }),
      makeActivity({ id: 2, distance: 6000, start_date_local: '2024-01-20T09:00:00' }),
      makeActivity({ id: 3, distance: 8000, start_date_local: '2024-02-10T09:00:00' }),
    ]
    const best = getBestMonth(activities)
    expect(best.totalKm).toBeCloseTo(11, 1)
    expect(best.label).toBe('Enero 2024')
  })
})

describe('computeFunFacts', () => {
  it('computes all four equivalences', () => {
    const facts = computeFunFacts(780, 3718)
    expect(facts.caminoLaps).toBeCloseTo(1, 1)
    expect(facts.teideLaps).toBeCloseTo(1, 1)
    expect(facts.marathons).toBeCloseTo(780 / 42.195, 1)
    expect(facts.retiroLaps).toBe(Math.round(780 / 3.2))
  })
})
