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
  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Métricas de Running
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Kilómetros totales"   value={`${metrics.totalKm} km`} />
        <MetricCard label="Actividades"           value={metrics.totalActivities} />
        <MetricCard label="Tiempo entrenado"      value={metrics.totalTime} />
        <MetricCard label="Desnivel acumulado"    value={metrics.elevation} />
        <MetricCard label="Ritmo medio"           value={metrics.avgPace} />
        <MetricCard label="Distancia media"       value={metrics.avgDistance} />
      </div>
    </section>
  )
}
