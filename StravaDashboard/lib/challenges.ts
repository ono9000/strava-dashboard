export interface Milestone {
  destination: string
  km: number
}

export const MILESTONES: Milestone[] = [
  { destination: 'Segovia',   km: 88 },
  { destination: 'Valencia',  km: 356 },
  { destination: 'Barcelona', km: 621 },
  { destination: 'París',     km: 1276 },
  { destination: 'Londres',   km: 1706 },
  { destination: 'Roma',      km: 1950 },
  { destination: 'Berlín',    km: 2320 },
  { destination: 'Estambul',  km: 3432 },
  { destination: 'Moscú',     km: 4900 },
]

export interface ChallengeState {
  completed: Milestone[]
  current: Milestone
  progress: number       // 0–1, progress within the current segment
  remainingKm: number
  allCompleted: boolean
  laps: number           // only meaningful when allCompleted is true
}

export function getCurrentChallenge(userKm: number): ChallengeState {
  const lastMilestone = MILESTONES[MILESTONES.length - 1]

  if (userKm >= lastMilestone.km) {
    return {
      completed: MILESTONES,
      current: lastMilestone,
      progress: 1,
      remainingKm: 0,
      allCompleted: true,
      laps: userKm / lastMilestone.km,
    }
  }

  const currentIndex = MILESTONES.findIndex((m) => userKm < m.km)
  const current = MILESTONES[currentIndex]
  const prevKm = currentIndex === 0 ? 0 : MILESTONES[currentIndex - 1].km
  const completed = MILESTONES.slice(0, currentIndex)
  const progress = (userKm - prevKm) / (current.km - prevKm)
  const remainingKm = current.km - userKm

  return {
    completed,
    current,
    progress,
    remainingKm,
    allCompleted: false,
    laps: 0,
  }
}
