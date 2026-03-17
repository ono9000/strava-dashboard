'use client'

import type { StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'
import { formatPace } from '@/lib/calculations'
import { useT } from '@/lib/i18n/client'

interface BestMarksData {
  best5k:       StravaSummaryActivity | null
  best10k:      StravaSummaryActivity | null
  bestHalf:     StravaSummaryActivity | null
  bestMarathon: StravaSummaryActivity | null
  longest:      StravaSummaryActivity | null
  bestWeek:     PeriodBest
  bestMonth:    PeriodBest
}

interface Props {
  bestMarks: BestMarksData
}

function BestCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  const t = useT()
  const noData = value === t.common.noData
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider truncate">{label}</span>
      <span className={`text-xl font-bold ${noData ? 'text-white/30' : 'text-[#FC4C02]'}`}>
        {value}
      </span>
      {sublabel && (
        <span className="text-xs text-white/30 truncate">{sublabel}</span>
      )}
    </div>
  )
}

function activityPace(a: StravaSummaryActivity | null, noData: string): string {
  if (!a) return noData
  return formatPace(a.moving_time, a.distance)
}

export default function BestMarks({ bestMarks }: Props) {
  const t = useT()
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        {t.bestMarks.title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BestCard
          label="5K"
          value={activityPace(bestMarks.best5k, t.common.noData)}
          sublabel={bestMarks.best5k ? `${(bestMarks.best5k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="10K"
          value={activityPace(bestMarks.best10k, t.common.noData)}
          sublabel={bestMarks.best10k ? `${(bestMarks.best10k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label={t.bestMarks.labels.half}
          value={activityPace(bestMarks.bestHalf, t.common.noData)}
          sublabel={bestMarks.bestHalf ? `${(bestMarks.bestHalf.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label={t.bestMarks.labels.marathon}
          value={activityPace(bestMarks.bestMarathon, t.common.noData)}
          sublabel={bestMarks.bestMarathon ? `${(bestMarks.bestMarathon.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label={t.bestMarks.labels.longest}
          value={bestMarks.longest ? `${(bestMarks.longest.distance / 1000).toFixed(1)} km` : t.common.noData}
          sublabel={bestMarks.longest?.name}
        />
        <BestCard
          label={t.bestMarks.labels.bestWeek}
          value={bestMarks.bestWeek.totalKm > 0 ? `${bestMarks.bestWeek.totalKm.toFixed(1)} km` : t.common.noData}
          sublabel={bestMarks.bestWeek.label || undefined}
        />
        <BestCard
          label={t.bestMarks.labels.bestMonth}
          value={bestMarks.bestMonth.totalKm > 0 ? `${bestMarks.bestMonth.totalKm.toFixed(1)} km` : t.common.noData}
          sublabel={bestMarks.bestMonth.label || undefined}
        />
      </div>
    </section>
  )
}
