import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'
import type { ChallengeState } from '@/lib/challenges'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
  challenge: ChallengeState
}

const RING_SIZE = 96
const RING_RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS  // 276.46

export default function ProfileCard({ athlete, primarySport, athleteSince, challenge }: Props) {
  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`
  const dashOffset = CIRCUMFERENCE * (1 - challenge.progress)
  const ringColor = challenge.allCompleted ? '#FFD700' : '#FC4C02'

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center gap-3">

      {/* Photo with SVG ring overlay */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="#333"
            strokeWidth={5}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={5}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            width: 76,
            height: 76,
          }}
        >
          <Image
            src={athlete.profile}
            alt={fullName}
            fill
            className="rounded-full object-cover"
            unoptimized
          />
        </div>
      </div>

      {/* Name and location */}
      <div>
        <h1 className="text-2xl font-bold text-white">{fullName}</h1>
        {location && <p className="text-white/60 text-sm mt-0.5">{location}</p>}
      </div>

      {/* Sport / year tags */}
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
          {primarySport}
        </span>
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/50">
          Atleta desde {athleteSince}
        </span>
      </div>

      {/* Challenge progress label */}
      {challenge.allCompleted ? (
        <p className="text-sm font-bold" style={{ color: '#FFD700' }}>
          🏆 ¡Ruta completa!
        </p>
      ) : (
        <p className="text-sm font-bold" style={{ color: '#FC4C02' }}>
          {Math.round(challenge.progress * 100)}% → {challenge.current.destination}
        </p>
      )}

    </div>
  )
}
