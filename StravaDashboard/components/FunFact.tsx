'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FunFacts } from '@/lib/calculations'

interface Props {
  funFacts: FunFacts
}

const FACT_COUNT = 4

export default function FunFact({ funFacts }: Props) {
  const facts = [
    {
      icon: '🚶',
      text: 'Has recorrido el equivalente a',
      highlight: `${funFacts.caminoLaps} veces el Camino de Santiago`,
    },
    {
      icon: '🌋',
      text: 'Has subido el equivalente a',
      highlight: `${funFacts.teideLaps} veces el Teide`,
    },
    {
      icon: '🏃',
      text: 'Has completado el equivalente a',
      highlight: `${funFacts.marathons} maratones`,
    },
    {
      icon: '🌳',
      text: 'Has dado',
      highlight: `${funFacts.retiroLaps} vueltas al Parque del Retiro`,
    },
  ]

  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startInterval = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % FACT_COUNT)
        setVisible(true)
      }, 300)
    }, 5000)
  }, [])

  useEffect(() => {
    startInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startInterval])

  const handleMouseEnter = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const handleMouseLeave = () => {
    startInterval()
  }

  const current = facts[index]

  return (
    <section className="pb-10">
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Dato Curioso
      </h2>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`flex items-center gap-4 transition-opacity duration-300 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-4xl flex-shrink-0">{current.icon}</span>
          <div>
            <p className="text-white/60 text-sm">{current.text}</p>
            <p className="text-white font-bold text-xl">{current.highlight}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-5">
          {facts.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-[#FC4C02]' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
