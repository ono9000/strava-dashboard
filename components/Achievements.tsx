'use client'

import type { StravaActivityTotals, StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'
import { useT } from '@/lib/i18n/client'

interface Props {
  totals: StravaActivityTotals
  activities: StravaSummaryActivity[]
  bestMarks: {
    bestWeek: PeriodBest
    bestMonth: PeriodBest
    [key: string]: unknown
  }
}

function Badge({
  label,
  icon,
  unlocked,
  threshold,
  currentKm,
}: {
  label: string
  icon: string
  unlocked: boolean
  threshold?: number
  currentKm?: number
}) {
  const t = useT()
  const showProgress =
    !unlocked &&
    threshold !== undefined &&
    currentKm !== undefined &&
    currentKm < threshold

  return (
    <div
      className={`bg-[#1a1a1a] border rounded-2xl p-3 flex flex-col items-center gap-2 text-center ${
        unlocked
          ? 'border-[#FC4C02]/30'
          : 'border-white/10 opacity-40 grayscale'
      }`}
    >
      <span className="text-2xl">{unlocked ? icon : '🔒'}</span>
      <span className="text-xs font-medium text-white leading-tight">{label}</span>
      {showProgress && (
        <div className="w-full space-y-1">
          <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FC4C02] rounded-full"
              style={{ width: `${Math.min((currentKm / threshold) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-white/40">
            {t.achievements.remainingKm(Math.ceil(threshold - currentKm))}
          </span>
        </div>
      )}
    </div>
  )
}

export default function Achievements({ totals, activities, bestMarks }: Props) {
  const totalKm   = totals.distance / 1000
  const hasHalf    = activities.some((a) => a.distance >= 20900)
  const hasMarathon = activities.some((a) => a.distance >= 42000)
  const t = useT()

  const badges = [
    { label: t.achievements.badges.first100,  icon: '🌱', unlocked: totalKm >= 100,  threshold: 100 },
    { label: t.achievements.badges.first500,  icon: '⚡', unlocked: totalKm >= 500,  threshold: 500 },
    { label: t.achievements.badges.first1000, icon: '🔥', unlocked: totalKm >= 1000, threshold: 1000 },
    { label: t.achievements.badges.first5000, icon: '🚀', unlocked: totalKm >= 5000, threshold: 5000 },
    { label: t.achievements.badges.firstHalf, icon: '🏅', unlocked: hasHalf },
    { label: t.achievements.badges.firstMarathon, icon: '🏆', unlocked: hasMarathon },
    { label: t.achievements.badges.recordWeek, icon: '📅', unlocked: bestMarks.bestWeek.totalKm > 0 },
    { label: t.achievements.badges.recordMonth, icon: '📆', unlocked: bestMarks.bestMonth.totalKm > 0 },
  ]

  const unlockedCount = badges.filter((b) => b.unlocked).length

  return (
    <section>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs text-white/40 uppercase tracking-wider">{t.achievements.title}</h2>
        <span className="text-xs text-white/40">{unlockedCount}/{badges.length}</span>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {badges.map((b) => (
          <Badge key={b.label} {...b} currentKm={totalKm} />
        ))}
      </div>
    </section>
  )
}
