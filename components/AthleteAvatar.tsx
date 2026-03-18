'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  src: string | null | undefined
  name: string
  size: number
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export default function AthleteAvatar({ src, name, size }: Props) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        className="rounded-full bg-[#FC4C02] flex items-center justify-center text-white font-bold select-none shrink-0"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
        aria-label={name}
      >
        {getInitials(name)}
      </div>
    )
  }

  return (
    <div className="relative rounded-full overflow-hidden shrink-0" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={name}
        fill
        className="object-cover"
        unoptimized
        onError={() => setError(true)}
      />
    </div>
  )
}
