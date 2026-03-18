'use client'

import type { SummaryAthlete } from '@/types/strava'
import { useT } from '@/lib/i18n/client'
import AthleteAvatar from '@/components/AthleteAvatar'

interface RunningPartnersProps {
  partners: { athlete: SummaryAthlete; count: number }[]
}

export default function RunningPartners({ partners }: RunningPartnersProps) {
  const t = useT()
  if (partners.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {partners.map(({ athlete, count }) => (
        <div
          key={athlete.id}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center gap-2"
        >
          <AthleteAvatar
            src={athlete.profile}
            name={`${athlete.firstname} ${athlete.lastname}`}
            size={48}
          />
          <span className="text-sm font-semibold text-white">
            {athlete.firstname} {athlete.lastname}
          </span>
          <span className="text-xs text-white/40">
            {t.partners.together(count)}
          </span>
        </div>
      ))}
    </div>
  )
}
