'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { StravaAthlete } from '@/types/strava'
import type { YearlyChallengeState } from '@/lib/yearlyChallenge'

interface Props {
  athlete: StravaAthlete
  primarySport: string
  athleteSince: string
  yearlyChallenge: YearlyChallengeState
}

const RING_SIZE = 96
const RING_RADIUS = 44
const HALF_CIRC = Math.PI * RING_RADIUS  // ≈ 138.23

export default function ProfileCard({ athlete, primarySport, athleteSince, yearlyChallenge }: Props) {
  const [hovered, setHovered] = useState(false)

  const location = [athlete.city, athlete.country].filter(Boolean).join(', ')
  const fullName = `${athlete.firstname} ${athlete.lastname}`
  const ringColor = yearlyChallenge.allCompleted ? '#FFD700' : '#FC4C02'

  // Top semi-circle path: sweep-flag=0 (counterclockwise) from left to right = top arc
  const cx = RING_SIZE / 2
  const cy = RING_SIZE / 2
  const arcPath = `M ${cx - RING_RADIUS},${cy} A ${RING_RADIUS},${RING_RADIUS} 0 0,0 ${cx + RING_RADIUS},${cy}`
  const progressDash = yearlyChallenge.progress * HALF_CIRC

  const label = yearlyChallenge.allCompleted
    ? '🏆 ¡Año completo!'
    : hovered
    ? `${Math.round(yearlyChallenge.ytdKm)} km / ${yearlyChallenge.nextMilestone} km`
    : `${yearlyChallenge.icon} ${Math.round(yearlyChallenge.progress * 100)}% → ${yearlyChallenge.nextMilestone} km`

  return (
    <div
      className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo with top semi-circle SVG ring */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        >
          {/* Background track */}
          <path
            d={arcPath}
            fill="none"
            stroke="#333"
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={ringColor}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${progressDash} ${HALF_CIRC}`}
            strokeDashoffset={0}
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

      {/* Yearly challenge label — toggles on hover */}
      <p
        className="text-sm font-bold transition-all duration-200"
        style={{ color: yearlyChallenge.allCompleted ? '#FFD700' : '#FC4C02' }}
      >
        {label}
      </p>
    </div>
  )
}
