'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FunFacts } from '@/lib/calculations'
import { useT } from '@/lib/i18n/client'

interface Props {
  funFacts: FunFacts
}

const FACT_COUNT = 4

export default function FunFact({ funFacts }: Props) {
  const t = useT()
  const facts = [
    {
      icon: '🚶',
      text: t.funFact.facts.caminoText,
      highlight: t.funFact.facts.caminoHighlight(funFacts.caminoLaps),
    },
    {
      icon: '🌋',
      text: t.funFact.facts.teideText,
      highlight: t.funFact.facts.teideHighlight(funFacts.teideLaps),
    },
    {
      icon: '🏃',
      text: t.funFact.facts.marathonsText,
      highlight: t.funFact.facts.marathonsHighlight(funFacts.marathons),
    },
    {
      icon: '🌳',
      text: t.funFact.facts.retiroText,
      highlight: t.funFact.facts.retiroHighlight(funFacts.retiroLaps),
    },
  ]

  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
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
        {t.funFact.title}
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
