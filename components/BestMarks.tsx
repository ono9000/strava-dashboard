import type { StravaSummaryActivity } from '@/types/strava'
import type { PeriodBest } from '@/lib/calculations'
import { formatPace } from '@/lib/calculations'

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
  const noData = value === 'Sin datos'
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

function activityPace(a: StravaSummaryActivity | null): string {
  if (!a) return 'Sin datos'
  return formatPace(a.moving_time, a.distance)
}

export default function BestMarks({ bestMarks }: Props) {
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Mejores Marcas
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BestCard
          label="5K"
          value={activityPace(bestMarks.best5k)}
          sublabel={bestMarks.best5k ? `${(bestMarks.best5k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="10K"
          value={activityPace(bestMarks.best10k)}
          sublabel={bestMarks.best10k ? `${(bestMarks.best10k.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Media Maratón"
          value={activityPace(bestMarks.bestHalf)}
          sublabel={bestMarks.bestHalf ? `${(bestMarks.bestHalf.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Maratón"
          value={activityPace(bestMarks.bestMarathon)}
          sublabel={bestMarks.bestMarathon ? `${(bestMarks.bestMarathon.distance / 1000).toFixed(2)} km` : undefined}
        />
        <BestCard
          label="Actividad más larga"
          value={bestMarks.longest ? `${(bestMarks.longest.distance / 1000).toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.longest?.name}
        />
        <BestCard
          label="Semana récord"
          value={bestMarks.bestWeek.totalKm > 0 ? `${bestMarks.bestWeek.totalKm.toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.bestWeek.label || undefined}
        />
        <BestCard
          label="Mes récord"
          value={bestMarks.bestMonth.totalKm > 0 ? `${bestMarks.bestMonth.totalKm.toFixed(1)} km` : 'Sin datos'}
          sublabel={bestMarks.bestMonth.label || undefined}
        />
      </div>
    </section>
  )
}
