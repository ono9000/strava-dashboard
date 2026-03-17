import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
}

export default function ProfileCard({ athlete, primarySport, athleteSince }: Props) {
  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`

  return (
    <div className="flex items-center gap-6 bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
      <div className="relative w-20 h-20 flex-shrink-0">
        <Image
          src={athlete.profile}
          alt={fullName}
          fill
          className="rounded-full object-cover"
          unoptimized
        />
      </div>
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-bold text-white truncate">{fullName}</h1>
        {location && (
          <p className="text-white/60 text-sm">{location}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
            {primarySport}
          </span>
          <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
            Atleta desde {athleteSince}
          </span>
        </div>
      </div>
    </div>
  )
}
