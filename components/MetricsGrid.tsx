'use client'

import { useT } from '@/lib/i18n/client'

interface Metrics {
  totalKm: string
  totalActivities: number
  totalTime: string
  elevation: string
  avgPace: string
  avgDistance: string
}

interface Props {
  metrics: Metrics
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className="text-4xl font-bold text-white leading-none mt-1">{value}</span>
    </div>
  )
}

export default function MetricsGrid({ metrics }: Props) {
  const t = useT()
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        {t.metrics.title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label={t.metrics.labels.totalKm} value={`${metrics.totalKm} km`} />
        <MetricCard label={t.metrics.labels.activities} value={metrics.totalActivities} />
        <MetricCard label={t.metrics.labels.totalTime} value={metrics.totalTime} />
        <MetricCard label={t.metrics.labels.elevation} value={metrics.elevation} />
        <MetricCard label={t.metrics.labels.avgPace} value={metrics.avgPace} />
        <MetricCard label={t.metrics.labels.avgDistance} value={metrics.avgDistance} />
      </div>
    </section>
  )
}
