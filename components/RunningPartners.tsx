import type { SummaryAthlete } from '@/types/strava'

interface RunningPartnersProps {
  partners: { athlete: SummaryAthlete; count: number }[]
}

export default function RunningPartners({ partners }: RunningPartnersProps) {
  if (partners.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {partners.map(({ athlete, count }) => (
        <div
          key={athlete.id}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center gap-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={athlete.profile}
            alt={`${athlete.firstname} ${athlete.lastname}`}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
          <span className="text-sm font-semibold text-white">
            {athlete.firstname} {athlete.lastname}
          </span>
          <span className="text-xs text-white/40">
            {count} carrera{count === 1 ? '' : 's'} juntos
          </span>
        </div>
      ))}
    </div>
  )
}
