import {
  formatPace,
  formatTime,
  formatElevation,
  getPrimarySport,
  getBestForDistance,
  getBestWeek,
  getBestMonth,
  computeFunFacts,
  getActivityHeatmap,
  getMonthlyKm,
  getTopPerformances,
  getSportBreakdown,
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
  map: null,
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

describe('getActivityHeatmap', () => {
  const TODAY = new Date('2026-03-17')  // Tuesday

  it('returns 52×7 grid of zeros for empty activities', () => {
    const grid = getActivityHeatmap([], TODAY)
    expect(grid).toHaveLength(52)
    grid.forEach((week) => {
      expect(week).toHaveLength(7)
      week.forEach((day) => expect(day.km).toBe(0))
    })
  })

  it('places a run on the correct cell', () => {
    const run = makeActivity({ distance: 10000, start_date_local: '2026-03-16T09:00:00' })
    const grid = getActivityHeatmap([run], TODAY)
    // With today=2026-03-17 (Tue), recentMonday=2026-03-16
    // grid[51][0] = Mon 2026-03-16
    expect(grid[51][0].date).toBe('2026-03-16')
    expect(grid[51][0].km).toBeCloseTo(10, 1)
  })

  it('sums multiple runs on the same day', () => {
    const a1 = makeActivity({ distance: 5000, start_date_local: '2026-03-16T08:00:00' })
    const a2 = makeActivity({ distance: 3000, start_date_local: '2026-03-16T18:00:00' })
    const grid = getActivityHeatmap([a1, a2], TODAY)
    expect(grid[51][0].km).toBeCloseTo(8, 1)
  })

  it('excludes non-Run activities', () => {
    const ride = makeActivity({ sport_type: 'Ride', distance: 50000, start_date_local: '2026-03-16T09:00:00' })
    const grid = getActivityHeatmap([ride], TODAY)
    expect(grid[51][0].km).toBe(0)
  })

  it('partial week: future days after today are zero', () => {
    // today = Tuesday 2026-03-17; grid[51] = Mon 16 through Sun 22
    // Wed 2026-03-18 is in the future → km = 0
    const futureRun = makeActivity({ distance: 8000, start_date_local: '2026-03-18T09:00:00' })
    const grid = getActivityHeatmap([futureRun], TODAY)
    // grid[51][0] = Mon Mar 16, grid[51][1] = Tue Mar 17, grid[51][2] = Wed Mar 18 (future)
    expect(grid[51][2].date).toBe('2026-03-18')
    expect(grid[51][2].km).toBe(0)
    // grid[51][3..6] are also future
    expect(grid[51][3].km).toBe(0)
  })
})

describe('getMonthlyKm', () => {
  const TODAY = new Date('2026-03-17')  // currentYear=2026, prevYear=2025

  it('returns 12 entries all zero for empty activities', () => {
    const data = getMonthlyKm([], TODAY)
    expect(data).toHaveLength(12)
    data.forEach((d) => {
      expect(d.currentYear).toBe(0)
      expect(d.prevYear).toBe(0)
    })
  })

  it('places a current-year run in the correct month', () => {
    const run = makeActivity({ distance: 15000, start_date_local: '2026-02-15T09:00:00' })
    const data = getMonthlyKm([run], TODAY)
    expect(data[1].currentYear).toBeCloseTo(15, 1)  // February = index 1
    expect(data[1].prevYear).toBe(0)
  })

  it('places a prev-year run in the correct month', () => {
    const run = makeActivity({ distance: 10000, start_date_local: '2025-06-10T09:00:00' })
    const data = getMonthlyKm([run], TODAY)
    expect(data[5].prevYear).toBeCloseTo(10, 1)  // June = index 5
    expect(data[5].currentYear).toBe(0)
  })

  it('excludes non-Run activities', () => {
    const ride = makeActivity({ sport_type: 'Ride', distance: 100000, start_date_local: '2026-02-15T09:00:00' })
    const data = getMonthlyKm([ride], TODAY)
    expect(data[1].currentYear).toBe(0)
  })
})

describe('getTopPerformances', () => {
  it('returns empty array for empty activities', () => {
    expect(getTopPerformances([])).toHaveLength(0)
  })

  it('returns longest run card', () => {
    const short = makeActivity({ id: 1, distance: 3000 })
    const long_ = makeActivity({ id: 2, distance: 21000 })
    const perfs = getTopPerformances([short, long_])
    const longest = perfs.find((p) => p.label === 'Carrera más larga')
    expect(longest).toBeDefined()
    expect(longest!.value).toBe('21.0 km')
  })

  it('omits pace card when no run is >= 5km', () => {
    const run = makeActivity({ distance: 3000, moving_time: 900 })
    const perfs = getTopPerformances([run])
    expect(perfs.find((p) => p.label === 'Mejor ritmo')).toBeUndefined()
  })

  it('returns pace card for the fastest run >= 5km by pace', () => {
    // run1: 5km in 25min = 5'00"/km
    // run2: 5km in 22min = 4'24"/km  ← faster
    const run1 = makeActivity({ id: 1, distance: 5000, moving_time: 1500 })
    const run2 = makeActivity({ id: 2, distance: 5000, moving_time: 1320 })
    const perfs = getTopPerformances([run1, run2])
    const pace = perfs.find((p) => p.label === 'Mejor ritmo')
    expect(pace).toBeDefined()
    expect(pace!.value).toBe("4'24\"/km")
  })

  it('returns elevation card', () => {
    const run = makeActivity({ total_elevation_gain: 500, distance: 10000 })
    const perfs = getTopPerformances([run])
    const elev = perfs.find((p) => p.label === 'Más desnivel')
    expect(elev).toBeDefined()
    expect(elev!.value).toBe('500 m')
  })
})

describe('getSportBreakdown', () => {
  it('returns empty array for empty activities', () => {
    expect(getSportBreakdown([])).toHaveLength(0)
  })

  it('returns empty array when all activities are Run', () => {
    const runs = [makeActivity({}), makeActivity({})]
    expect(getSportBreakdown(runs)).toHaveLength(0)
  })

  it('groups non-Run activities by sport_type and excludes Run', () => {
    const activities = [
      makeActivity({ sport_type: 'Run' }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Basketball', moving_time: 5400 }),
    ]
    const result = getSportBreakdown(activities)
    expect(result).toHaveLength(2)
    expect(result[0].sportType).toBe('Tennis')
    expect(result[0].count).toBe(2)
    expect(result[0].icon).toBe('🎾')
    expect(result[1].sportType).toBe('Basketball')
  })

  it('sorts by count descending', () => {
    const activities = [
      makeActivity({ sport_type: 'Swim', moving_time: 1800 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
      makeActivity({ sport_type: 'Tennis', moving_time: 3600 }),
    ]
    const result = getSportBreakdown(activities)
    expect(result[0].sportType).toBe('Tennis')
    expect(result[0].count).toBe(3)
  })
})
