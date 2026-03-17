'use client'

import { useMemo } from 'react'
import { getActivityHeatmap } from '@/lib/calculations'
import type { StravaSummaryActivity } from '@/types/strava'
import { useLang, useT } from '@/lib/i18n/client'

function cellColor(km: number): string {
  if (km === 0) return '#1a1a1a'
  if (km <= 5) return '#FC4C0240'
  if (km <= 15) return '#FC4C0280'
  return '#FC4C02'
}

export default function ActivityHeatmap({
  activities,
}: {
  activities: StravaSummaryActivity[]
}) {
  const { lang } = useLang()
  const t = useT()
  const grid = useMemo(() => getActivityHeatmap(activities), [activities])
  const locale = lang === 'en' ? 'en-US' : 'es-ES'

  // Build month labels: show label at the first week whose Monday is in a new month
  const monthLabels: { label: string; col: number; year: number }[] = []
  for (let w = 0; w < 52; w++) {
    const d = new Date(grid[w][0].date + 'T12:00:00')
    if (d.getDate() <= 7) {
      const label = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)
      const last = monthLabels[monthLabels.length - 1]
      if (!last || last.label !== label || last.year !== d.getFullYear()) {
        monthLabels.push({ label, col: w, year: d.getFullYear() })
      }
    }
  }

  const CELL = 11
  const GAP = 2
  const LEFT = 16
  const TOP = 20

  return (
    <div className="overflow-x-auto">
      <svg
        width={LEFT + 52 * (CELL + GAP)}
        height={TOP + 7 * (CELL + GAP) + 4}
        aria-label={t.heatmap.ariaLabel}
      >
        {/* Month labels */}
        {monthLabels.map(({ label, col }) => (
          <text
            key={`m-${label}-${col}`}
            x={LEFT + col * (CELL + GAP)}
            y={12}
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
          >
            {label}
          </text>
        ))}
        {/* Day labels (only odd rows to avoid crowding) */}
        {t.heatmap.dayLetters.map((lbl, row) =>
          row % 2 === 1 ? (
            <text
              key={`d-${row}`}
              x={0}
              y={TOP + row * (CELL + GAP) + CELL - 1}
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
            >
              {lbl}
            </text>
          ) : null
        )}
        {/* Cells */}
        {grid.map((week, w) =>
          week.map((day, d) => {
            const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
            const tooltip = day.km > 0
              ? t.heatmap.tooltip.withKm(day.km, dateLabel)
              : t.heatmap.tooltip.noActivity(dateLabel)
            return (
              <rect
                key={`${w}-${d}`}
                x={LEFT + w * (CELL + GAP)}
                y={TOP + d * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={cellColor(day.km)}
              >
                <title>{tooltip}</title>
              </rect>
            )
          })
        )}
      </svg>
    </div>
  )
}
