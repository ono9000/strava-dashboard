export interface YearlyChallengeState {
  ytdKm: number
  nextMilestone: number
  prevMilestone: number
  progress: number
  icon: string
  allCompleted: boolean
}

const YEARLY_MILESTONES = [
  { km: 100,  icon: '🌱' },
  { km: 250,  icon: '🌿' },
  { km: 500,  icon: '⚡' },
  { km: 750,  icon: '🔥' },
  { km: 1000, icon: '💪' },
  { km: 1500, icon: '🚀' },
  { km: 2000, icon: '⭐' },
  { km: 3000, icon: '🏆' },
]

export function getYearlyChallenge(ytdKm: number): YearlyChallengeState {
  const maxMilestone = YEARLY_MILESTONES[YEARLY_MILESTONES.length - 1]

  if (ytdKm >= maxMilestone.km) {
    return {
      ytdKm,
      nextMilestone: maxMilestone.km,
      prevMilestone: YEARLY_MILESTONES[YEARLY_MILESTONES.length - 2].km,
      progress: 1,
      icon: maxMilestone.icon,
      allCompleted: true,
    }
  }

  const nextIdx = YEARLY_MILESTONES.findIndex((m) => m.km > ytdKm)
  const next = YEARLY_MILESTONES[nextIdx]
  const prevKm = nextIdx === 0 ? 0 : YEARLY_MILESTONES[nextIdx - 1].km
  const progress = (ytdKm - prevKm) / (next.km - prevKm)

  return {
    ytdKm,
    nextMilestone: next.km,
    prevMilestone: prevKm,
    progress: Math.max(0, Math.min(1, progress)),
    icon: next.icon,
    allCompleted: false,
  }
}
