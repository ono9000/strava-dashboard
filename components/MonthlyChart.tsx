'use client'

import { getMonthlyKm } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'
import { useLang } from '@/lib/i18n/client'

export default function MonthlyChart({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const { lang } = useLang()
  const today = new Date()
  const currentYear = today.getFullYear()
  const prevYear = currentYear - 1
  const data = getMonthlyKm(activities, today)

  const allValues = data.flatMap((d) => [d.currentYear, d.prevYear])
  const maxKm = Math.max(...allValues, 1)

  const VW = 600
  const VH = 180
  const PAD_L = 40
  const PAD_R = 16
  const PAD_T = 16
  const PAD_B = 28
  const CHART_W = VW - PAD_L - PAD_R  // 544
  const CHART_H = VH - PAD_T - PAD_B  // 136

  const slotW = CHART_W / 12
  const pairW = slotW * 0.6
  const barW = (pairW - 2) / 2

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      aria-label={`${prevYear} / ${currentYear}`}
    >
      {/* Y-axis guide lines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD_T + CHART_H * (1 - frac)
        return (
          <g key={frac}>
            <line
              x1={PAD_L}
              y1={y}
              x2={VW - PAD_R}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 4}
              y={y + 3}
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
              textAnchor="end"
            >
              {Math.round(maxKm * frac)}
            </text>
          </g>
        )
      })}

      {/* Bars + labels */}
      {data.map((d, i) => {
        const pairX = PAD_L + i * slotW + (slotW - pairW) / 2
        const prevH = (d.prevYear / maxKm) * CHART_H
        const currH = (d.currentYear / maxKm) * CHART_H
        const labelX = PAD_L + i * slotW + slotW / 2
        const monthLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-ES', {
          month: 'short',
        }).format(new Date(2000, d.month, 1))
        return (
          <g key={i}>
            {d.prevYear > 0 && (
              <rect
                x={pairX}
                y={PAD_T + CHART_H - prevH}
                width={barW}
                height={prevH}
                fill="rgba(255,255,255,0.12)"
                rx={2}
              />
            )}
            {d.currentYear > 0 && (
              <rect
                x={pairX + barW + 2}
                y={PAD_T + CHART_H - currH}
                width={barW}
                height={currH}
                fill="#FC4C02"
                rx={2}
              />
            )}
            <text
              x={labelX}
              y={VH - 8}
              fontSize={10}
              fill="rgba(255,255,255,0.5)"
              textAnchor="middle"
            >
              {monthLabel}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <rect x={VW - PAD_R - 100} y={4} width={8} height={8} fill="rgba(255,255,255,0.12)" rx={1} />
      <text x={VW - PAD_R - 88} y={12} fontSize={9} fill="rgba(255,255,255,0.4)">
        {prevYear}
      </text>
      <rect x={VW - PAD_R - 55} y={4} width={8} height={8} fill="#FC4C02" rx={1} />
      <text x={VW - PAD_R - 43} y={12} fontSize={9} fill="rgba(255,255,255,0.4)">
        {currentYear}
      </text>
    </svg>
  )
}
