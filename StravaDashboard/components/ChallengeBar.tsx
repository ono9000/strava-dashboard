import type { ChallengeState } from '@/lib/challenges'

interface Props {
  challenge: ChallengeState
}

export default function ChallengeBar({ challenge }: Props) {
  if (challenge.allCompleted) {
    return (
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Reto Geográfico
        </h2>
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 text-center space-y-3">
          <div className="text-5xl">🏆</div>
          <p className="text-white font-bold text-lg">
            ¡Has completado toda la ruta Madrid → Moscú!
          </p>
          <p className="text-white/60 text-sm">
            Has recorrido el equivalente a{' '}
            <span className="text-[#FC4C02] font-bold">
              {challenge.laps.toFixed(1)} vueltas completas
            </span>
          </p>
        </div>
      </section>
    )
  }

  const progressPercent = Math.round(challenge.progress * 100)
  const coveredKm = (challenge.current.km - challenge.remainingKm).toFixed(0)

  return (
    <section>
      <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Reto Geográfico
      </h2>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 space-y-4">
        {challenge.completed.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {challenge.completed.map((m) => (
              <span
                key={m.destination}
                className="text-xs bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/30 rounded-full px-3 py-1"
              >
                ✓ {m.destination}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold text-lg">
              Madrid → {challenge.current.destination}
            </span>
            <span className="text-[#FC4C02] font-bold text-lg">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FC4C02] rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>{coveredKm} km recorridos en este tramo</span>
            <span>Te faltan {Math.round(challenge.remainingKm)} km</span>
          </div>
        </div>
      </div>
    </section>
  )
}
