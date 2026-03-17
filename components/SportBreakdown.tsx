import { getSportBreakdown } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

export default function SportBreakdown({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const sports = getSportBreakdown(activities)
  if (sports.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {sports.map((s) => (
        <div
          key={s.sportType}
          className="bg-[#1a1a1a] border border-white/10 rounded-full px-4 py-2 text-sm flex items-center gap-2"
        >
          <span>{s.icon}</span>
          <span className="text-white/80">{s.sportType}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/60">
            {s.count} {s.count === 1 ? 'vez' : 'veces'}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/40">{s.totalHours.toFixed(1)} h</span>
        </div>
      ))}
    </div>
  )
}
