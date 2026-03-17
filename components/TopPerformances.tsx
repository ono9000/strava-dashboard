import { getTopPerformances } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'

export default function TopPerformances({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const perfs = getTopPerformances(activities)
  if (perfs.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {perfs.map((p) => (
        <div
          key={p.label}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-1"
        >
          <span className="text-2xl">{p.icon}</span>
          <span className="text-xs text-white/40 uppercase tracking-wider mt-1">
            {p.label}
          </span>
          <span className="text-xl font-bold text-[#FC4C02]">{p.value}</span>
          <span className="text-xs text-white/40">{p.sub}</span>
        </div>
      ))}
    </div>
  )
}
